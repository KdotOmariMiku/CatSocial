import { auth, onAuthStateChanged } from './firebase.js';

const apiBaseUrl = window.ADMIN_API_URL || 'http://127.0.0.1:5000';
const tableBody = document.getElementById('userTableBody');
const searchInput = document.getElementById('searchInput');
const adminMessage = document.getElementById('adminMessage');
const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const lockedUsers = document.getElementById('lockedUsers');
const totalMatches = document.getElementById('totalMatches');
const profileTableBody = document.getElementById('profileTableBody');
const reportTableBody = document.getElementById('reportTableBody');
const logTableBody = document.getElementById('logTableBody');
const chartCanvas = document.getElementById('growthChart');
const chartPeriod = document.getElementById('chartPeriod');
const chartMessage = document.getElementById('chartMessage');
const profileMessage = document.getElementById('profileMessage');
const reportMessage = document.getElementById('reportMessage');
const logMessage = document.getElementById('logMessage');

let users = [];
let adminUser;
let chartData;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

async function callAdminApi(path, options = {}) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Máy chủ phản hồi quá lâu. Kiểm tra kết nối tới Firebase và API.'));
    }, 20000);
  });

  const request = (async () => {
    const token = await adminUser.getIdToken();
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Không thể thực hiện yêu cầu.');
    return result;
  })();

  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Không nhận được phản hồi hợp lệ từ API tại http://127.0.0.1:5000. ' +
        'API có thể đang chạy bản main.py cũ, gặp lỗi CORS hoặc chưa khởi động. ' +
        'Kiểm tra cửa sổ start-admin-api.bat và các route API được in khi khởi động.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function appendEmptyRow(body, columnCount, message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = columnCount;
  cell.className = 'empty-cell';
  cell.textContent = message;
  row.appendChild(cell);
  body.appendChild(row);
}

function safeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function appendPhoto(cell, value, alt) {
  const url = safeImageUrl(value);
  if (!url) {
    cell.textContent = 'Không có ảnh';
    return;
  }
  const image = document.createElement('img');
  image.className = 'profile-photo';
  image.src = url;
  image.alt = alt;
  image.loading = 'lazy';
  image.referrerPolicy = 'no-referrer';
  cell.appendChild(image);
}

function renderUsers() {
  const keyword = searchInput.value.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLocaleLowerCase().includes(keyword)
  );

  tableBody.replaceChildren();
  for (const user of filteredUsers) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const emailCell = document.createElement('td');
    const statusCell = document.createElement('td');
    const actionsCell = document.createElement('td');
    const toggleButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    nameCell.textContent = user.name;
    emailCell.textContent = user.email;
    statusCell.className = `status ${user.disabled ? 'locked' : 'active'}`;
    statusCell.textContent = user.disabled ? 'Đã khóa' : 'Hoạt động';

    toggleButton.type = 'button';
    toggleButton.dataset.action = 'toggle';
    toggleButton.dataset.uid = user.uid;
    toggleButton.textContent = user.disabled ? 'Mở khóa' : 'Khóa tài khoản';
    toggleButton.disabled = user.uid === adminUser.uid;

    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.uid = user.uid;
    deleteButton.textContent = 'Xóa';
    deleteButton.disabled = user.uid === adminUser.uid;

    actionsCell.className = 'actions';
    actionsCell.append(toggleButton, deleteButton);
    row.append(nameCell, emailCell, statusCell, actionsCell);
    tableBody.append(row);
  }

  if (!filteredUsers.length) appendEmptyRow(tableBody, 4, 'Không tìm thấy tài khoản phù hợp.');
  setMessage(adminMessage, `${filteredUsers.length} / ${users.length} tài khoản hiển thị.`);
}

async function loadUsers() {
  setMessage(adminMessage, 'Đang tải tài khoản Firebase...');
  try {
    users = await callAdminApi('/api/admin/users');
    renderUsers();
  } catch (error) {
    setMessage(adminMessage, error.message, true);
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function renderChart(data) {
  chartData = data;
  const context = chartCanvas.getContext('2d');
  if (!context) {
    setMessage(chartMessage, 'Trình duyệt không hỗ trợ biểu đồ.', true);
    return;
  }

  const width = chartCanvas.clientWidth;
  const height = 280;
  const ratio = window.devicePixelRatio || 1;
  chartCanvas.width = width * ratio;
  chartCanvas.height = height * ratio;
  chartCanvas.style.height = `${height}px`;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  const padding = { top: 18, right: 18, bottom: 38, left: 42 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const values = [...data.registrations, ...data.matches];
  const maxValue = Math.max(1, ...values);
  const pointX = (index) => padding.left + (data.labels.length < 2
    ? plotWidth / 2
    : (index / (data.labels.length - 1)) * plotWidth);
  const pointY = (value) => padding.top + plotHeight - (value / maxValue) * plotHeight;

  context.font = '12px Nunito, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.strokeStyle = '#f2e6e2';
  context.fillStyle = '#7f7a84';
  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (plotHeight * index) / 4;
    const value = Math.round(maxValue * (4 - index) / 4);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(String(value), padding.left - 8, y);
  }

  const labelStep = Math.max(1, Math.ceil(data.labels.length / 6));
  context.textAlign = 'center';
  context.textBaseline = 'top';
  data.labels.forEach((label, index) => {
    if (index % labelStep === 0 || index === data.labels.length - 1) {
      context.fillText(label, pointX(index), height - padding.bottom + 12);
    }
  });

  const drawLine = (series, color) => {
    if (!series.length) return;
    context.beginPath();
    series.forEach((value, index) => {
      const x = pointX(index);
      const y = pointY(value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
    series.forEach((value, index) => {
      context.beginPath();
      context.arc(pointX(index), pointY(value), 3, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    });
  };

  drawLine(data.registrations, '#ff5864');
  drawLine(data.matches, '#5598d1');
  setMessage(chartMessage, 'Số liệu đăng ký mới và Match mới theo thời gian.');
}

async function loadStats() {
  setMessage(chartMessage, 'Đang tải thống kê...');
  try {
    const data = await callAdminApi(`/api/admin/stats?period=${chartPeriod.value}`);
    totalUsers.textContent = data.totalUsers.toLocaleString('vi-VN');
    activeUsers.textContent = data.activeUsers.toLocaleString('vi-VN');
    lockedUsers.textContent = data.lockedUsers.toLocaleString('vi-VN');
    totalMatches.textContent = data.totalMatches.toLocaleString('vi-VN');
    renderChart(data);
  } catch (error) {
    setMessage(chartMessage, error.message, true);
  }
}

async function loadProfiles() {
  setMessage(profileMessage, 'Đang tải hồ sơ...');
  try {
    const profiles = await callAdminApi('/api/admin/profiles');
    profileTableBody.replaceChildren();
    for (const profile of profiles) {
      const row = document.createElement('tr');
      const photoCell = document.createElement('td');
      const nameCell = document.createElement('td');
      const emailCell = document.createElement('td');
      const actionsCell = document.createElement('td');
      const removeButton = document.createElement('button');

      appendPhoto(photoCell, profile.photoURL, `Ảnh đại diện của ${profile.name}`);
      nameCell.textContent = profile.name;
      emailCell.textContent = profile.email;
      removeButton.type = 'button';
      removeButton.className = 'danger';
      removeButton.dataset.action = 'remove-photo';
      removeButton.dataset.uid = profile.uid;
      removeButton.textContent = 'Gỡ ảnh';
      removeButton.disabled = !profile.photoURL;
      actionsCell.appendChild(removeButton);
      row.append(photoCell, nameCell, emailCell, actionsCell);
      profileTableBody.appendChild(row);
    }
    if (!profiles.length) appendEmptyRow(profileTableBody, 4, 'Chưa có hồ sơ trong collection profiles.');
    setMessage(profileMessage, `${profiles.length} hồ sơ được tải.`);
  } catch (error) {
    setMessage(profileMessage, error.message, true);
  }
}

async function loadReports() {
  setMessage(reportMessage, 'Đang tải báo cáo...');
  try {
    const reports = await callAdminApi('/api/admin/reports');
    reportTableBody.replaceChildren();
    for (const report of reports) {
      const row = document.createElement('tr');
      const targetCell = document.createElement('td');
      const reasonCell = document.createElement('td');
      const photoCell = document.createElement('td');
      const statusCell = document.createElement('td');
      const actionsCell = document.createElement('td');
      const resolveButton = document.createElement('button');
      const dismissButton = document.createElement('button');
      const moderateButton = document.createElement('button');
      const targetUid = report.targetUid || report.userId || report.reportedUid || '';
      const isPending = !report.status || report.status === 'pending';

      targetCell.textContent = report.targetName || report.reportedName || targetUid || 'Chưa xác định';
      reasonCell.textContent = report.reason || report.description || 'Không có nội dung';
      appendPhoto(photoCell, report.photoUrl || report.imageUrl, 'Ảnh được báo cáo');
      statusCell.className = `status ${isPending ? 'pending' : 'resolved'}`;
      statusCell.textContent = isPending ? 'Chờ xử lý' : report.status === 'dismissed' ? 'Đã bỏ qua' : 'Đã xử lý';

      resolveButton.type = 'button';
      resolveButton.dataset.action = 'resolve-report';
      resolveButton.dataset.id = report.id;
      resolveButton.textContent = 'Đã xử lý';
      resolveButton.disabled = !isPending;

      dismissButton.type = 'button';
      dismissButton.className = 'secondary-button';
      dismissButton.dataset.action = 'dismiss-report';
      dismissButton.dataset.id = report.id;
      dismissButton.textContent = 'Bỏ qua';
      dismissButton.disabled = !isPending;

      moderateButton.type = 'button';
      moderateButton.className = 'danger';
      moderateButton.dataset.action = 'moderate-report';
      moderateButton.dataset.id = report.id;
      moderateButton.dataset.uid = targetUid;
      moderateButton.textContent = 'Khóa + gỡ ảnh';
      moderateButton.disabled = !isPending || !targetUid || targetUid === adminUser.uid;

      actionsCell.className = 'actions';
      actionsCell.append(resolveButton, dismissButton, moderateButton);
      row.append(targetCell, reasonCell, photoCell, statusCell, actionsCell);
      reportTableBody.appendChild(row);
    }
    if (!reports.length) appendEmptyRow(reportTableBody, 5, 'Chưa có báo cáo trong collection reports.');
    setMessage(reportMessage, `${reports.length} báo cáo được tải.`);
  } catch (error) {
    setMessage(reportMessage, error.message, true);
  }
}

const actionLabels = {
  lock_user: 'Khóa tài khoản',
  unlock_user: 'Mở khóa tài khoản',
  delete_user: 'Xóa tài khoản',
  remove_profile_photo: 'Gỡ ảnh hồ sơ',
  process_report: 'Xử lý báo cáo'
};

async function loadLogs() {
  setMessage(logMessage, 'Đang tải nhật ký...');
  try {
    const logs = await callAdminApi('/api/admin/logs');
    logTableBody.replaceChildren();
    for (const log of logs) {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      const actionCell = document.createElement('td');
      const targetCell = document.createElement('td');
      const detailsCell = document.createElement('td');
      dateCell.textContent = formatDate(log.createdAt);
      actionCell.textContent = actionLabels[log.action] || log.action || '—';
      targetCell.textContent = log.targetUid || '—';
      detailsCell.textContent = log.details?.reportId
        ? `Báo cáo ${log.details.reportId} · ${log.details.status || ''}`
        : '—';
      row.append(dateCell, actionCell, targetCell, detailsCell);
      logTableBody.appendChild(row);
    }
    if (!logs.length) appendEmptyRow(logTableBody, 4, 'Chưa có nhật ký thao tác.');
    setMessage(logMessage, `${logs.length} thao tác gần đây.`);
  } catch (error) {
    setMessage(logMessage, error.message, true);
  }
}

async function refreshData() {
  await Promise.all([loadUsers(), loadStats(), loadProfiles(), loadReports(), loadLogs()]);
}

tableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const user = users.find((account) => account.uid === button.dataset.uid);
  if (!user) return;
  if (button.dataset.action === 'delete' &&
      !window.confirm(`Xóa vĩnh viễn tài khoản ${user.email}?`)) return;

  button.disabled = true;
  try {
    if (button.dataset.action === 'toggle') {
      await callAdminApi(`/api/admin/users/${encodeURIComponent(user.uid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: !user.disabled })
      });
    } else {
      await callAdminApi(`/api/admin/users/${encodeURIComponent(user.uid)}`, {
        method: 'DELETE'
      });
    }
    await Promise.all([loadUsers(), loadStats(), loadLogs()]);
  } catch (error) {
    setMessage(adminMessage, error.message, true);
    button.disabled = false;
  }
});

profileTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="remove-photo"]');
  if (!button || !window.confirm('Gỡ ảnh đại diện của tài khoản này?')) return;
  button.disabled = true;
  try {
    await callAdminApi(`/api/admin/profiles/${encodeURIComponent(button.dataset.uid)}/photo`, {
      method: 'DELETE'
    });
    await Promise.all([loadProfiles(), loadLogs()]);
  } catch (error) {
    setMessage(profileMessage, error.message, true);
    button.disabled = false;
  }
});

reportTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const payload = {
    status: action === 'dismiss-report' ? 'dismissed' : 'resolved',
    disableUser: action === 'moderate-report',
    removePhoto: action === 'moderate-report'
  };
  if (action === 'moderate-report' &&
      !window.confirm('Xác nhận khóa tài khoản và gỡ ảnh hồ sơ người bị báo cáo?')) return;

  button.disabled = true;
  try {
    await callAdminApi(`/api/admin/reports/${encodeURIComponent(button.dataset.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    await Promise.all([loadReports(), loadUsers(), loadStats(), loadProfiles(), loadLogs()]);
  } catch (error) {
    setMessage(reportMessage, error.message, true);
    button.disabled = false;
  }
});

searchInput.addEventListener('input', renderUsers);
chartPeriod.addEventListener('change', loadStats);
window.addEventListener('resize', () => {
  if (chartData) renderChart(chartData);
});
document.getElementById('refreshProfiles').addEventListener('click', loadProfiles);
document.getElementById('refreshReports').addEventListener('click', loadReports);
document.getElementById('refreshLogs').addEventListener('click', loadLogs);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = './admin-login.html';
    return;
  }
  adminUser = user;
  refreshData();
});
