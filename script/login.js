import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  googleProvider,
  facebookProvider
} from './firebase.js';

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleBtn = document.querySelector('.btn-social.google');
const facebookBtn = document.querySelector('.btn-social.facebook');
const forgotLink = document.querySelector('.forgot-link');
const adminUid = 'tqwlmVOxlyWXZMDYH7OJDKhRVRI3';

function getPostLoginUrl(user) {
  return user.uid === adminUid ? './Administrator.html' : './index.html';
}

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
  button.textContent = 'OK';
  button.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  });

  toast.appendChild(text);
  toast.appendChild(button);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

if (forgotLink) {
  forgotLink.addEventListener('click', async function (event) {
    event.preventDefault();

    const email = (emailInput && emailInput.value) ? emailInput.value.trim() : '';
    const targetEmail = email || window.prompt('Nhập email của bạn để nhận liên kết đặt lại mật khẩu:');

    if (!targetEmail) {
      showToast('Vui lòng nhập email để đặt lại mật khẩu.');
      return;
    }

    if (!validateEmail(targetEmail)) {
      showToast('Vui lòng nhập email hợp lệ.');
      emailInput && emailInput.focus();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      showToast('Liên kết đặt lại mật khẩu đã được gửi tới email của bạn.');
    } catch (error) {
      console.error('Lỗi quên mật khẩu:', error);
      const message = error.code === 'auth/unauthorized-domain'
        ? 'Domain hiện tại chưa được cấp quyền trong Firebase. Vui lòng thêm localhost vào Authorized domains.'
        : error.message || 'Không thể gửi email đặt lại mật khẩu.';
      showToast(message);
    }
  });
}

if (googleBtn) {
  googleBtn.addEventListener('click', async function () {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Đăng nhập Google thành công:', result.user);
      window.location.href = getPostLoginUrl(result.user);
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error);
      const message = error.code === 'auth/popup-closed-by-user'
        ? 'Bạn đã đóng cửa sổ đăng nhập Google.'
        : error.code === 'auth/user-disabled'
          ? 'Tài khoản của bạn đã bị khóa!, nếu có sự nhầm lẫn? hãy gửi khiếu nại!'
          : error.code === 'auth/unauthorized-domain'
          ? 'Google login bị chặn vì domain chưa được cấp quyền. Hãy thêm localhost vào Authorized domains trong Firebase.'
          : error.message || 'Đăng nhập Google thất bại.';
      showToast(message);
    }
  });
}

if (facebookBtn) {
  facebookBtn.addEventListener('click', async function () {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      window.location.href = getPostLoginUrl(result.user);
    } catch (error) {
      console.error('Lỗi đăng nhập Facebook:', error);
      const message = error.code === 'auth/popup-closed-by-user'
        ? 'Bạn đã đóng cửa sổ đăng nhập Facebook.'
        : error.code === 'auth/user-disabled'
          ? 'Tài khoản của bạn đã bị khóa!, nếu có sự nhầm lẫn? hãy gửi khiếu nại!'
          : error.code === 'auth/unauthorized-domain'
          ? 'Facebook login bị chặn vì domain chưa được cấp quyền trong Firebase Authorized domains.'
          : error.message || 'Đăng nhập Facebook thất bại.';
      showToast(message);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = (emailInput && emailInput.value) ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !validateEmail(email)) {
      showToast('Vui lòng nhập email hợp lệ.');
      emailInput && emailInput.focus();
      return;
    }

    if (!password || password.length < 6) {
      showToast('Mật khẩu phải có ít nhất 6 ký tự.');
      passwordInput && passwordInput.focus();
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Đăng nhập thành công:', userCredential.user);
      window.location.href = getPostLoginUrl(userCredential.user);
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      const message = error.code === 'auth/user-disabled'
        ? 'Tài khoản của bạn đã bị khóa!, nếu có sự nhầm lẫn? hãy gửi khiếu nại!'
        : error.code === 'auth/unauthorized-domain'
          ? 'Domain hiện tại chưa được cấp quyền trong Firebase. Hãy thêm localhost vào Authorized domains.'
          : error.message || 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
      showToast(message);
    }
  });
}
