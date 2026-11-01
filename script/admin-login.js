import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  googleProvider
} from './firebase.js';

const adminUid = 'tqwlmVOxlyWXZMDYH7OJDKhRVRI3';
const loginForm = document.getElementById('adminLoginForm');
const emailInput = document.getElementById('adminEmail');
const passwordInput = document.getElementById('adminPassword');
const googleButton = document.querySelector('.btn-social.google');
const forgotLink = document.querySelector('.forgot-link');

function showToast(message) {
  const existingToast = document.querySelector('.custom-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.setAttribute('role', 'alert');

  const text = document.createElement('div');
  text.className = 'custom-toast-text';
  text.textContent = message;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-toast-btn';
  button.textContent = 'Đóng';
  button.addEventListener('click', () => toast.remove());

  toast.append(text, button);
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.remove(), 4500);
}

function showAuthError(error) {
  if (error.code === 'auth/invalid-credential') {
    showToast('Email hoặc mật khẩu không đúng. Hãy dùng thông tin của tài khoản admin.');
  } else if (error.code === 'auth/unauthorized-domain') {
    showToast('Domain hiện tại chưa được cấp quyền trong Firebase Authorized domains.');
  } else {
    showToast(error.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
  }
}

async function finishAdminSignIn(user) {
  if (user.uid !== adminUid) {
    await signOut(auth);
    showToast('Tài khoản này không có quyền quản trị.');
    return;
  }

  window.location.replace('./Administrator.html');
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  if (user.uid === adminUid) {
    window.location.replace('./Administrator.html');
  } else {
    showToast('Phiên hiện tại không có quyền quản trị. Hãy đăng nhập bằng tài khoản admin.');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast('Vui lòng nhập email và mật khẩu.');
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await finishAdminSignIn(credential.user);
  } catch (error) {
    showAuthError(error);
  }
});

googleButton.addEventListener('click', async () => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    await finishAdminSignIn(credential.user);
  } catch (error) {
    showAuthError(error);
  }
});

forgotLink.addEventListener('click', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  if (!email) {
    showToast('Nhập email admin trước khi đặt lại mật khẩu.');
    emailInput.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Đã gửi liên kết đặt lại mật khẩu nếu email tồn tại.');
  } catch (error) {
    showAuthError(error);
  }
});