(async function init() {
  const auth = requireRole('admin');
  if (!auth) return;

  renderShell({ active: 'report', activeChild: 'report:visitor-receipt', title: 'Visitor Receipt', subtitle: 'Every gate pass receipt issued at check-in' });

  document.getElementById('vr-search').addEventListener('input', debounce(loadReceipts, 350));
  await loadReceipts();
})();

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

async function loadReceipts() {
  const body = document.getElementById('vr-body');
  const search = document.getElementById('vr-search').value.trim();
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';

  try {
    const { gatePasses } = await api(`/gatepass${qs}`);
    if (!gatePasses.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="8">No receipts issued yet.</td></tr>`;
      return;
    }
    body.innerHTML = gatePasses
      .map(
        (g) => `
      <tr>
        <td class="mono">${g.gatePassNumber}</td>
        <td class="mono">${g.visitor?.inwardNumber || '—'}</td>
        <td>${g.visitor?.visitorName || '—'}<div class="small text-muted">${g.visitor?.mobile || ''}</div></td>
        <td>${g.visitor?.visitorCategory?.categoryName || '—'}</td>
        <td>${g.visitor?.personToMeet || '—'}</td>
        <td>${g.generatedBy?.name || '—'}</td>
        <td>${fmtDateTime(g.createdAt)}</td>
        <td><a class="link-btn" style="display:inline;color:var(--info);text-decoration:underline;" href="/api/gatepass/download/${g.gatePassNumber}?token=${encodeURIComponent(Auth.token())}" target="_blank">Download</a></td>
      </tr>`
      )
      .join('');
  } catch (err) {
    body.innerHTML = `<tr class="empty-row"><td colspan="8">Failed to load: ${err.message}</td></tr>`;
  }
}
