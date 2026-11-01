import {
  auth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  googleProvider,
  facebookProvider
} from './firebase.js';

const registerForm = document.getElementById('registerForm');
const fullnameInput = document.getElementById('fullname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
const googleButton = document.querySelector('.btn-social.google');
const facebookButton = document.querySelector('.btn-social.facebook');

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

function validatePassword(password) {
  return password.length >= 6 && /[^A-Za-z0-9\s]/.test(password);
}

async function registerWithProvider(provider, providerName) {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = './index.html';
  } catch (error) {
    console.error(`Lỗi đăng ký bằng ${providerName}:`, error);
    const message = error.code === 'auth/unauthorized-domain'
      ? 'Domain hiện tại chưa được cấp quyền trong Firebase Authorized domains.'
      : error.code === 'auth/popup-closed-by-user'
        ? 'Bạn đã đóng cửa sổ đăng nhập.'
        : error.message || `Đăng ký bằng ${providerName} thất bại. Vui lòng thử lại.`;
    showToast(message);
  }
}

if (googleButton) {
  googleButton.addEventListener('click', () => registerWithProvider(googleProvider, 'Google'));
}

if (facebookButton) {
  facebookButton.addEventListener('click', () => registerWithProvider(facebookProvider, 'Facebook'));
}

if (registerForm) {
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullname = (fullnameInput && fullnameInput.value) ? fullnameInput.value.trim() : '';
    const email = (emailInput && emailInput.value) ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const confirm = confirmInput ? confirmInput.value : '';

    if (!fullname) {
      showToast('Vui lòng nhập họ và tên.');
      fullnameInput && fullnameInput.focus();
      return;
    }

    if (!email || !validateEmail(email)) {
      showToast('Vui lòng nhập email hợp lệ.');
      emailInput && emailInput.focus();
      return;
    }

    if (!validatePassword(password)) {
      showToast('Mật khẩu phải có ít nhất 6 ký tự và chứa ít nhất 1 ký tự đặc biệt như @, # hoặc !.');
      passwordInput && passwordInput.focus();
      return;
    }

    if (password !== confirm) {
      showToast('Mật khẩu và xác nhận mật khẩu không khớp.');
      confirmInput && confirmInput.focus();
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: fullname });
      showToast('Đăng ký thành công! Chuyển sang trang Đăng nhập...');
      setTimeout(() => {
        window.location.href = './login.html';
      }, 1200);
    } catch (error) {
      console.error('Lỗi đăng ký:', error);
      showToast(error.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    }
  });
}
