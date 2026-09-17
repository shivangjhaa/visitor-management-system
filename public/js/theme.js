/* Applies the saved theme before first paint (avoids a flash of the wrong
   theme) and exposes window.toggleTheme for the topbar switch in api.js. */
(function () {
  const THEME_KEY = 'vms-theme';
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);

  window.toggleTheme = function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    document.querySelectorAll('[data-theme-toggle] .knob').forEach((k) => (k.textContent = next === 'dark' ? '🌙' : '☀️'));
  };
})();
