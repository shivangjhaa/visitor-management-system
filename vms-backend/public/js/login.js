(function init() {
  // Already signed in? skip the login screen.
  const auth = Auth.get();
  if (auth && auth.token) {
    window.location.href = roleHome();
    return;
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('show');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      Auth.set({ token, user });
      window.location.href = roleHome();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
})();
