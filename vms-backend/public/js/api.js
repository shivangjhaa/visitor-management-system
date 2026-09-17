/* Shared helpers used across every page: API fetch wrapper, auth guard,
   toast notifications, and small formatting utilities. */

const AUTH_KEY = 'vms-auth'; // { token, user }

const Auth = {
  get() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }
    catch { return null; }
  },
  set(data) { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); },
  clear() { localStorage.removeItem(AUTH_KEY); },
  token() { return this.get()?.token; },
  user() { return this.get()?.user; },
};

/** Redirects to login if not authenticated, or to their home page if wrong role. */
function requireRole(...roles) {
  const auth = Auth.get();
  if (!auth || !auth.token) {
    window.location.href = '/index.html';
    return null;
  }
  if (roles.length && !roles.includes(auth.user.role)) {
    window.location.href = roleHome(auth.user.role);
    return null;
  }
  return auth;
}

function roleHome() {
  return '/home.html';
}

async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const token = Auth.token();
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    cache: 'no-store',
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (res.status === 401) {
    Auth.clear();
    window.location.href = '/index.html';
    throw new Error(data.message || 'Session expired');
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data;
}

/* ---------------- Toast notifications ---------------- */
function ensureToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function toast(message, type = 'info', ms = 4000) {
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ---------------- Formatting helpers ---------------- */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function chip(status) {
  return `<span class="chip chip-${status}">${status.replace(/([A-Z])/g, ' $1').trim()}</span>`;
}
function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

async function fillSelect(selectEl, path, { labelKey, valueKey = '_id', placeholder = 'Select…', activeOnly = true } = {}) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  try {
    const sep = path.includes('?') ? '&' : '?';
    const qs = activeOnly ? `${sep}isActive=true` : '';
    const { items } = await api(`${path}${qs}`);
    items.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item[valueKey];
      opt.textContent = typeof labelKey === 'function' ? labelKey(item) : item[labelKey];
      selectEl.appendChild(opt);
    });
  } catch (err) {
    console.error(`Failed to load options for ${path}:`, err.message);
  }
}

/* ---------------- Home stats loader (shared by home.js) ---------------- */
async function loadHomeStats(mountId = 'stat-row') {
  try {
    const { stats } = await api('/visitors/stats/summary');
    const mount = document.getElementById(mountId);
    if (!mount) return stats;
    mount.innerHTML = `
      <div class="stat-tile"><div class="num">${stats.total}</div><div class="label">Total</div></div>
      <div class="stat-tile"><div class="num">${stats.totalLeaves}</div><div class="label">Total Leaves</div></div>
      <div class="stat-tile"><div class="num">${stats.totalInsidePremises}</div><div class="label">Total Inside Premises</div></div>
      <div class="stat-tile"><div class="num">${stats.today}</div><div class="label">Today</div></div>
      <div class="stat-tile"><div class="num">${stats.todayLeave}</div><div class="label">Today Leave</div></div>
      <div class="stat-tile"><div class="num">${stats.todayInsidePremises}</div><div class="label">Today Inside Premises</div></div>
    `;
    return stats;
  } catch (err) {
    toast(err.message, 'error');
    return null;
  }
}
const MASTER_SECTIONS = [
  { key: 'user', label: 'User Master' },
  { key: 'card', label: 'Card Master' },
  { key: 'category', label: 'Visitor Category' },
  { key: 'plant', label: 'Plant Master' },
  { key: 'department', label: 'Department Master' },
  { key: 'division', label: 'Division Master' },
  { key: 'location', label: 'Location Master' },
  { key: 'delegate-updation', label: 'Delegate Updation', href: '/delegate-updation.html' },
];

const TRANSACTION_SECTIONS = [
  { key: 'request-visitor', label: 'Request for Visitor', href: '/request-visitor.html' },
  { key: 'hod-approval', label: 'HOD Approval', href: '/hod-approval.html' },
  { key: 'visitor-entry', label: 'Visitor Entry', href: '/visitor-entry.html' },
  { key: 'out-pending', label: 'Out Pending List', href: '/out-pending.html' },
];

const REPORT_SECTIONS = [
  { key: 'visitor-report', label: 'Visitor Report', href: '/report-visitor.html' },
  { key: 'visitor-receipt', label: 'Visitor Receipt', href: '/visitor-receipt.html' },
];

function navConfigForRole(role) {
  const base = [{ key: 'home', label: 'Home', href: '/home.html', icon: '🏠' }];

  if (role === 'admin') {
    base.push({ key: 'master', label: 'Master', icon: '🗂️', children: MASTER_SECTIONS.map((s) => ({ key: `master:${s.key}`, label: s.label, href: s.href || `/master.html?section=${s.key}` })) });
    base.push({ key: 'transaction', label: 'Transaction', icon: '🔁', children: TRANSACTION_SECTIONS.map((s) => ({ key: `transaction:${s.key}`, label: s.label, href: s.href })) });
    base.push({ key: 'report', label: 'Report', icon: '📊', children: REPORT_SECTIONS.map((s) => ({ key: `report:${s.key}`, label: s.label, href: s.href })) });
  } else if (role === 'user') {
    base.push({ key: 'request-visitor', label: 'Request for Visitor', href: '/request-visitor.html', icon: '📝' });
  } else if (role === 'hod') {
    // A HOD keeps every "user" capability, plus HOD Approval for their
    // department(s), plus managing their own delegate.
    base.push({
      key: 'transaction',
      label: 'Transaction',
      icon: '🔁',
      children: [
        { key: 'transaction:request-visitor', label: 'Request for Visitor', href: '/request-visitor.html' },
        { key: 'transaction:hod-approval', label: 'HOD Approval', href: '/hod-approval.html' },
      ],
    });
    base.push({ key: 'delegate-updation', label: 'Delegate Updation', href: '/delegate-updation.html', icon: '🧑‍🤝‍🧑' });
  } else if (role === 'security') {
    base.push({ key: 'visitor-entry', label: 'Visitor Entry', href: '/visitor-entry.html', icon: '🛡️' });
    base.push({ key: 'out-pending', label: 'Out Pending List', href: '/out-pending.html', icon: '🚪' });
  }

  base.push({ key: 'password-reset', label: 'Password Reset', href: '/password-reset.html', icon: '🔑' });
  return base;
}

function renderShell({ active, activeChild, title, subtitle }) {
  const auth = Auth.get();
  if (!auth) return;
  const { user } = auth;
  const nav = navConfigForRole(user.role);

  const renderItem = (item) => {
    if (item.children) {
      const isOpen = item.key === active;
      return `
        <div class="nav-group">
          <button class="nav-parent ${isOpen ? 'open' : ''}" data-toggle="${item.key}">
            <span class="nav-parent-label"><span>${item.icon}</span><span>${item.label}</span></span>
            <span class="chev">▶</span>
          </button>
          <div class="nav-children ${isOpen ? 'open' : ''}" id="children-${item.key}">
            ${item.children
              .map(
                (c) => `<a class="nav-child ${c.key === activeChild ? 'active' : ''}" href="${c.href}">${c.label}</a>`
              )
              .join('')}
          </div>
        </div>`;
    }
    return `<a class="nav-item ${item.key === active ? 'active' : ''}" href="${item.href}"><span>${item.icon}</span><span>${item.label}</span></a>`;
  };

  document.getElementById('sidebar-mount').innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="company">${window.APP_COMPANY || 'Alok Industries'}</div>
        <div class="sub">Visitor Management</div>
      </div>
      <nav class="sidebar-nav">
        ${nav.map(renderItem).join('')}
      </nav>
      <div class="sidebar-foot">
        <span class="user-name">${user.name}</span>
        <span class="small">${user.email}</span>
        <span class="role-chip">${user.role}</span>
        <button class="logout-btn" id="logout-btn">Sign out</button>
      </div>
    </aside>
  `;

  document.getElementById('topbar-mount').innerHTML = `
    <div class="topbar">
      <div>
        <h1>${title}</h1>
        ${subtitle ? `<div class="topbar-sub">${subtitle}</div>` : ''}
      </div>
      <div class="flex items-center gap-12">
        <button class="theme-toggle" data-theme-toggle aria-label="Toggle dark mode" aria-pressed="false">
          <span class="knob">☀️</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.clear();
    window.location.href = '/index.html';
  });

  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      const children = document.getElementById(`children-${key}`);
      const willOpen = !children.classList.contains('open');
      children.classList.toggle('open', willOpen);
      btn.classList.toggle('open', willOpen);
    });
  });

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => btn.addEventListener('click', window.toggleTheme));
  if (window.toggleTheme) {
    const t = document.documentElement.getAttribute('data-theme');
    document.querySelectorAll('[data-theme-toggle] .knob').forEach((k) => (k.textContent = t === 'dark' ? '🌙' : '☀️'));
  }
}
