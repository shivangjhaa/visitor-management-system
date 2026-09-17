(async function init() {
  const auth = requireRole('admin', 'user', 'security', 'hod');
  if (!auth) return;

  renderShell({ active: 'home', title: 'Home', subtitle: `Welcome back, ${auth.user.name.split(' ')[0]}` });

  await loadHomeStats();
  await loadRecent();

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    await loadHomeStats();
    await loadRecent();
  });
})();

async function loadRecent() {
  const body = document.getElementById('recent-body');
  try {
    const { visitors } = await api('/visitors?');
    const recent = visitors.slice(0, 10);
    if (!recent.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="6">No visitor activity yet.</td></tr>`;
      return;
    }
    body.innerHTML = recent
      .map(
        (v) => `
      <tr>
        <td class="mono">${v.inwardNumber}</td>
        <td>${v.visitorName}<div class="small text-muted">${v.mobile}</div></td>
        <td>${v.visitorCategory?.categoryName || '—'}</td>
        <td>${v.personToMeet || '—'}</td>
        <td>${fmtDate(v.appointmentDate)}</td>
        <td>${chip(v.status)}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">Failed to load: ${err.message}</td></tr>`;
  }
}
