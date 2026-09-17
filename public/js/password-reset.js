(function init() {
  const auth = requireRole('admin', 'user', 'security', 'hod');
  if (!auth) return;

  renderShell({ active: 'password-reset', title: 'Password Reset', subtitle: 'Update your account password' });

  const form = document.getElementById('pr-form');
  const errorBox = document.getElementById('pr-error');
  const successBox = document.getElementById('pr-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('show');
    successBox.classList.remove('show');

    const current = document.getElementById('pr-current').value;
    const next = document.getElementById('pr-new').value;
    const confirm = document.getElementById('pr-confirm').value;

    if (next !== confirm) {
      errorBox.textContent = 'New password and confirmation do not match';
      errorBox.classList.add('show');
      return;
    }

    const btn = document.getElementById('pr-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Updating…';

    try {
      await api('/auth/change-password', { method: 'PUT', body: { currentPassword: current, newPassword: next } });
      successBox.textContent = 'Password updated successfully.';
      successBox.classList.add('show');
      form.reset();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  });
})();
