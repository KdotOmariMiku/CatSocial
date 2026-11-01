import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import firebase_admin
import google.auth.exceptions
from firebase_admin import auth, firestore
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.environ.get("ADMIN_ALLOWED_ORIGIN", "*")}})

if not firebase_admin._apps:
	firebase_admin.initialize_app(options={"projectId": "catsocial-3c3c9", "httpTimeout": 12})


def require_admin(handler):
	@wraps(handler)
	def wrapped(*args, **kwargs):
		admin_uid = os.environ.get("ADMIN_UID")
		if not admin_uid:
			return jsonify({"error": "Máy chủ chưa cấu hình ADMIN_UID."}), 503

		authorization = request.headers.get("Authorization", "")
		if not authorization.startswith("Bearer "):
			return jsonify({"error": "Vui lòng đăng nhập bằng tài khoản quản trị."}), 401

		try:
			decoded_token = auth.verify_id_token(authorization.removeprefix("Bearer "))
		except google.auth.exceptions.DefaultCredentialsError:
			app.logger.exception("Firebase Admin credentials are not configured")
			return jsonify({
				"error": (
					"Máy chủ chưa có Google Application Default Credentials. "
					"Cấu hình GOOGLE_APPLICATION_CREDENTIALS trỏ tới service-account JSON "
					"có quyền Firebase Authentication Admin rồi khởi động lại API."
				)
			}), 503
		except (auth.ExpiredIdTokenError, auth.InvalidIdTokenError,
				auth.RevokedIdTokenError, auth.UserDisabledError):
			return jsonify({"error": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."}), 401
		except auth.CertificateFetchError:
			app.logger.exception("Failed to fetch Firebase token verification certificates")
			return jsonify({"error": "Không thể xác minh phiên đăng nhập với Firebase. Kiểm tra kết nối mạng của máy chủ."}), 503
		except Exception:
			app.logger.exception("Unexpected Firebase ID token verification error")
			return jsonify({"error": "Máy chủ gặp lỗi khi xác minh phiên đăng nhập."}), 500

		if decoded_token.get("uid") != admin_uid:
			return jsonify({"error": "Tài khoản này không có quyền quản trị."}), 403

		request.admin_uid = admin_uid
		return handler(*args, **kwargs)

	return wrapped


def firestore_client():
	return firestore.client()


def serialize_value(value):
	if isinstance(value, datetime):
		return value.isoformat()
	if isinstance(value, dict):
		return {key: serialize_value(item) for key, item in value.items()}
	if isinstance(value, (list, tuple)):
		return [serialize_value(item) for item in value]
	return value


def get_document_date(data, *field_names):
	for field_name in field_names:
		value = data.get(field_name)
		if isinstance(value, datetime):
			return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
		if isinstance(value, str):
			try:
				parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
				return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
			except ValueError:
				continue
	return None


def user_creation_date(user):
	timestamp = user.user_metadata.creation_timestamp
	if timestamp is None:
		return None
	seconds = timestamp / 1000 if timestamp > 10**12 else timestamp
	return datetime.fromtimestamp(seconds, tz=timezone.utc)


def remove_profile_photo(uid):
	try:
		auth.update_user(uid, photo_url=auth.DELETE_ATTRIBUTE)
	except auth.UserNotFoundError:
		pass

	profile = firestore_client().collection("profiles").document(uid)
	snapshot = profile.get()
	if snapshot.exists:
		data = snapshot.to_dict() or {}
		photo_fields = [field for field in ("photoURL", "photoUrl", "imageUrl") if field in data]
		if photo_fields:
			profile.update({field: "" for field in photo_fields})


def write_admin_log(action, target_uid=None, details=None):
	firestore_client().collection("admin_logs").add({
		"adminUid": request.admin_uid,
		"action": action,
		"targetUid": target_uid,
		"details": details or {},
		"createdAt": datetime.now(timezone.utc),
	})


@app.get("/api/admin/users")
@require_admin
def list_users():
	try:
		users = [
			{
				"uid": user.uid,
				"name": user.display_name or "Chưa đặt tên",
				"email": user.email or "Không có email",
				"disabled": user.disabled,
				"createdAt": user_creation_date(user).isoformat() if user_creation_date(user) else None,
			}
			for user in auth.list_users().iterate_all()
		]
	except Exception:
		app.logger.exception("Failed to load users from Firebase Authentication")
		return jsonify({"error": "Không thể tải tài khoản từ Firebase. Kiểm tra kết nối mạng và cấu hình Firebase Admin."}), 502
	return jsonify(users)


@app.patch("/api/admin/users/<uid>")
@require_admin
def update_user(uid):
	payload = request.get_json(silent=True) or {}
	disabled = payload.get("disabled")
	if not isinstance(disabled, bool):
		return jsonify({"error": "Trạng thái tài khoản không hợp lệ."}), 400
	if uid == request.admin_uid and disabled:
		return jsonify({"error": "Không thể khóa tài khoản quản trị đang đăng nhập."}), 400

	try:
		user = auth.update_user(uid, disabled=disabled)
	except auth.UserNotFoundError:
		return jsonify({"error": "Không tìm thấy tài khoản."}), 404

	try:
		write_admin_log("lock_user" if disabled else "unlock_user", uid)
	except Exception:
		app.logger.exception("Account status changed but admin action could not be logged")
		return jsonify({"error": "Trạng thái tài khoản đã đổi nhưng không thể ghi nhật ký quản trị."}), 502

	return jsonify({"uid": user.uid, "disabled": user.disabled})


@app.delete("/api/admin/users/<uid>")
@require_admin
def delete_user(uid):
	if uid == request.admin_uid:
		return jsonify({"error": "Không thể xóa tài khoản quản trị đang đăng nhập."}), 400

	try:
		auth.delete_user(uid)
	except auth.UserNotFoundError:
		return jsonify({"error": "Không tìm thấy tài khoản."}), 404

	try:
		write_admin_log("delete_user", uid)
	except Exception:
		app.logger.exception("Account deleted but admin action could not be logged")
		return jsonify({"error": "Tài khoản đã bị xóa nhưng không thể ghi nhật ký quản trị."}), 502

	return jsonify({"uid": uid, "deleted": True})


@app.get("/api/admin/stats")
@require_admin
def admin_stats():
	period = request.args.get("period", "day")
	if period not in ("day", "week"):
		return jsonify({"error": "Khoảng thời gian không hợp lệ."}), 400

	try:
		users = list(auth.list_users().iterate_all())
		match_documents = list(firestore_client().collection("matches").stream())
		now = datetime.now(timezone.utc)
		if period == "week":
			start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
			buckets = [start - timedelta(weeks=index) for index in reversed(range(8))]
			labels = [bucket.strftime("%d/%m") for bucket in buckets]
			user_counts = [0] * len(buckets)
			match_counts = [0] * len(buckets)
			for user in users:
				created_at = user_creation_date(user)
				if created_at:
					index = (created_at - buckets[0]).days // 7
					if 0 <= index < len(buckets):
						user_counts[index] += 1
			for document in match_documents:
				created_at = get_document_date(document.to_dict() or {}, "createdAt", "created_at", "timestamp", "matchedAt")
				if created_at:
					index = (created_at - buckets[0]).days // 7
					if 0 <= index < len(buckets):
						match_counts[index] += 1
		else:
			today = now.replace(hour=0, minute=0, second=0, microsecond=0)
			buckets = [today - timedelta(days=index) for index in reversed(range(30))]
			labels = [bucket.strftime("%d/%m") for bucket in buckets]
			user_counts = [0] * len(buckets)
			match_counts = [0] * len(buckets)
			for user in users:
				created_at = user_creation_date(user)
				if created_at:
					index = (created_at.date() - buckets[0].date()).days
					if 0 <= index < len(buckets):
						user_counts[index] += 1
			for document in match_documents:
				created_at = get_document_date(document.to_dict() or {}, "createdAt", "created_at", "timestamp", "matchedAt")
				if created_at:
					index = (created_at.date() - buckets[0].date()).days
					if 0 <= index < len(buckets):
						match_counts[index] += 1
	except Exception:
		app.logger.exception("Failed to load admin statistics")
		return jsonify({"error": "Không thể tải thống kê. Kiểm tra cấu hình Firebase và dữ liệu Firestore."}), 502

	return jsonify({
		"totalUsers": len(users),
		"activeUsers": sum(not user.disabled for user in users),
		"lockedUsers": sum(user.disabled for user in users),
		"totalMatches": len(match_documents),
		"period": period,
		"labels": labels,
		"registrations": user_counts,
		"matches": match_counts,
	})


@app.get("/api/admin/profiles")
@require_admin
def list_profiles():
	try:
		users = list(auth.list_users().iterate_all())
		profile_documents = {
			document.id: document.to_dict() or {}
			for document in firestore_client().collection("profiles").stream()
		}
		profiles = []
		for user in users:
			data = profile_documents.pop(user.uid, {})
			profiles.append({
				"uid": user.uid,
				"name": data.get("name") or data.get("displayName") or user.display_name or "Chưa đặt tên",
				"email": user.email or data.get("email") or "Không có email",
				"photoURL": data.get("photoURL") or data.get("photoUrl") or data.get("imageUrl") or user.photo_url,
			})
		for uid, data in profile_documents.items():
			profiles.append({
				"uid": uid,
				"name": data.get("name") or data.get("displayName") or "Chưa đặt tên",
				"email": data.get("email") or "Không có email",
				"photoURL": data.get("photoURL") or data.get("photoUrl") or data.get("imageUrl"),
			})
	except Exception:
		app.logger.exception("Failed to load user profiles")
		return jsonify({"error": "Không thể tải hồ sơ. Kiểm tra collection profiles trong Firestore."}), 502
	return jsonify(profiles)


@app.delete("/api/admin/profiles/<uid>/photo")
@require_admin
def delete_profile_photo(uid):
	try:
		remove_profile_photo(uid)
	except Exception:
		app.logger.exception("Failed to remove profile photo")
		return jsonify({"error": "Không thể gỡ ảnh hồ sơ. Kiểm tra dữ liệu Firestore và tài khoản."}), 502
	try:
		write_admin_log("remove_profile_photo", uid)
	except Exception:
		app.logger.exception("Profile photo removed but admin action could not be logged")
		return jsonify({"error": "Ảnh đã được gỡ nhưng không thể ghi nhật ký quản trị."}), 502
	return jsonify({"uid": uid, "photoRemoved": True})


@app.get("/api/admin/reports")
@require_admin
def list_reports():
	try:
		reports = []
		for document in firestore_client().collection("reports").stream():
			data = document.to_dict() or {}
			reports.append({
				"id": document.id,
				**serialize_value(data),
			})
		reports.sort(key=lambda report: report.get("createdAt") or report.get("created_at") or "", reverse=True)
	except Exception:
		app.logger.exception("Failed to load user reports")
		return jsonify({"error": "Không thể tải báo cáo. Kiểm tra collection reports trong Firestore."}), 502
	return jsonify(reports[:200])


@app.patch("/api/admin/reports/<report_id>")
@require_admin
def update_report(report_id):
	payload = request.get_json(silent=True) or {}
	status = payload.get("status")
	if status not in ("resolved", "dismissed"):
		return jsonify({"error": "Trạng thái xử lý báo cáo không hợp lệ."}), 400

	try:
		report_ref = firestore_client().collection("reports").document(report_id)
		report_snapshot = report_ref.get()
		if not report_snapshot.exists:
			return jsonify({"error": "Không tìm thấy báo cáo."}), 404
		report = report_snapshot.to_dict() or {}
		target_uid = report.get("targetUid") or report.get("userId") or report.get("reportedUid")
		disable_user = payload.get("disableUser", False)
		remove_photo = payload.get("removePhoto", False)
		if not isinstance(disable_user, bool) or not isinstance(remove_photo, bool):
			return jsonify({"error": "Thao tác xử lý báo cáo không hợp lệ."}), 400
		if disable_user and (not target_uid or target_uid == request.admin_uid):
			return jsonify({"error": "Không thể khóa tài khoản báo cáo này."}), 400
		if remove_photo and not target_uid:
			return jsonify({"error": "Báo cáo không có mã tài khoản để gỡ ảnh."}), 400
		if disable_user:
			auth.update_user(target_uid, disabled=True)
		if remove_photo:
			remove_profile_photo(target_uid)
		report_ref.update({
			"status": status,
			"reviewedAt": datetime.now(timezone.utc),
			"reviewedBy": request.admin_uid,
		})
	except auth.UserNotFoundError:
		return jsonify({"error": "Không tìm thấy tài khoản được báo cáo."}), 404
	except Exception:
		app.logger.exception("Failed to process user report")
		return jsonify({"error": "Không thể xử lý báo cáo. Kiểm tra kết nối và dữ liệu Firebase."}), 502

	try:
		write_admin_log("process_report", target_uid, {
			"reportId": report_id,
			"status": status,
			"disableUser": disable_user,
			"removePhoto": remove_photo,
		})
	except Exception:
		app.logger.exception("Report processed but admin action could not be logged")
		return jsonify({"error": "Báo cáo đã xử lý nhưng không thể ghi nhật ký quản trị."}), 502
	return jsonify({"id": report_id, "status": status})


@app.get("/api/admin/logs")
@require_admin
def list_admin_logs():
	try:
		logs = []
		for document in firestore_client().collection("admin_logs").stream():
			data = document.to_dict() or {}
			logs.append({"id": document.id, **serialize_value(data)})
		logs.sort(key=lambda entry: entry.get("createdAt") or "", reverse=True)
	except Exception:
		app.logger.exception("Failed to load admin activity logs")
		return jsonify({"error": "Không thể tải nhật ký thao tác quản trị."}), 502
	return jsonify(logs[:100])


if __name__ == "__main__":
	print(f"Admin API source: {ascii(os.path.abspath(__file__))}", flush=True)
	admin_routes = sorted(
		rule.rule for rule in app.url_map.iter_rules()
		if rule.rule.startswith("/api/admin/")
	)
	print(f"Admin API routes: {', '.join(admin_routes)}", flush=True)
	app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
