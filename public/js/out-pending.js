(async function init() {
  const auth = requireRole('security', 'admin');
  if (!auth) return;

  renderShell({
    active: auth.user.role === 'admin' ? 'transaction' : 'out-pending',
    activeChild: 'transaction:out-pending',
    title: 'Out Pending List',
    subtitle: 'Visitors currently onsite — record their exit',
  });

  document.getElementById('refresh-onsite').addEventListener('click', loadOnsite);
  await loadOnsite();
})();

async function loadOnsite() {
  const body = document.getElementById('onsite-body');
  try {
    const { visitors } = await api('/security/onsite');
    if (!visitors.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="9">No visitors currently onsite.</td></tr>`;
      return;
    }
    body.innerHTML = visitors
      .map(
        (v) => `
      <tr>
        <td class="mono">${v.inwardNumber}</td>
        <td>${v.visitorName}</td>
        <td>${v.visitorCompany || '—'}</td>
        <td>${v.mobile}</td>
        <td>${v.createdBy?.name || '—'}</td>
        <td>${v.purpose || '—'}</td>
        <td>${fmtDateTime(v.appointmentDate)}</td>
        <td>${fmtDateTime(v.entryTime)}</td>
        <td><button class="btn btn-primary" style="padding:6px 14px;" data-token="${v.inwardNumber}">Out</button></td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-token]').forEach((btn) => btn.addEventListener('click', () => checkOut(btn.dataset.token, btn)));
  } catch (err) {
    body.innerHTML = `<tr class="empty-row"><td colspan="9">Failed to load: ${err.message}</td></tr>`;
  }
}

async function checkOut(inwardNumber, btn) {
  if (!confirm(`Record exit for ${inwardNumber} now?`)) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    await api(`/security/checkout/${encodeURIComponent(inwardNumber)}`, { method: 'PUT' });
    toast(`Exit recorded for ${inwardNumber}`, 'success');
    loadOnsite();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Out';
  }
}
