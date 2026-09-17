let rpRows = [];

(async function init() {
  const auth = requireRole('admin');
  if (!auth) return;

  renderShell({ active: 'report', activeChild: 'report:visitor-report', title: 'Visitor Report', subtitle: 'All recorded visits — filter by category, mobile and date range' });

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  document.getElementById('rp-from').value = monthAgo;
  document.getElementById('rp-to').value = today;

  await fillSelect(document.getElementById('rp-type'), '/master/visitor-categories', { labelKey: 'categoryName', placeholder: 'All' });

  document.getElementById('rp-filter-btn').addEventListener('click', loadReport);
  document.getElementById('rp-export-btn').addEventListener('click', exportCSV);

  await loadReport();
})();

async function loadReport() {
  const body = document.getElementById('rp-body');
  const from = document.getElementById('rp-from').value;
  const to = document.getElementById('rp-to').value;
  const type = document.getElementById('rp-type').value;
  const mobile = document.getElementById('rp-mobile').value.trim();

  try {
    const qs = mobile ? `?search=${encodeURIComponent(mobile)}` : '';
    const { visitors } = await api(`/visitors${qs}`);

    // The report is the gate register: only visits that actually entered.
    rpRows = visitors.filter((v) => {
      if (!v.entryTime) return false;
      const d = new Date(v.entryTime).toISOString().slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (type && v.visitorCategory?._id !== type) return false;
      return true;
    });

    renderSummary(rpRows);

    if (!rpRows.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="13">No visits match these filters.</td></tr>`;
      return;
    }

    body.innerHTML = rpRows
      .map((v) => {
        const entry = v.entryTime ? new Date(v.entryTime) : null;
        return `
      <tr>
        <td class="mono">${v.inwardNumber}</td>
        <td class="mono">${v.assignedCard?.cardNumber || '—'}</td>
        <td>${entry ? entry.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
        <td>${entry ? entry.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td>${v.purpose || '—'}</td>
        <td>${v.visitorName}</td>
        <td>${v.visitorCompany || '—'}</td>
        <td>${v.address || '—'}</td>
        <td>${v.mobile}</td>
        <td>${v.personToMeet || '—'}</td>
        <td>${v.department?.departmentName || '—'}</td>
        <td>${v.visitorCategory?.categoryName || '—'}</td>
        <td>${chip(v.status)}</td>
      </tr>`;
      })
      .join('');
  } catch (err) {
    body.innerHTML = `<tr class="empty-row"><td colspan="13">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderSummary(rows) {
  const counts = rows.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});
  const mount = document.getElementById('rp-summary');
  mount.innerHTML = `
    <div class="stat-tile"><div class="num">${rows.length}</div><div class="label">Total Visits in Range</div></div>
    <div class="stat-tile"><div class="num">${counts.CheckedIn || 0}</div><div class="label">Currently Inside</div></div>
    <div class="stat-tile"><div class="num">${counts.CheckedOut || 0}</div><div class="label">Checked Out</div></div>
  `;
}

function exportCSV() {
  if (!rpRows.length) {
    toast('Nothing to export for this range', 'info');
    return;
  }
  const header = ['Token No', 'Card No', 'In Date', 'In Time', 'Reason for Visit', 'Visitor Name', 'Representing', 'Address', 'Mobile', 'Contact Person', 'Department', 'Category', 'Status'];
  const lines = rpRows.map((v) => {
    const entry = v.entryTime ? new Date(v.entryTime) : null;
    return [
      v.inwardNumber,
      v.assignedCard?.cardNumber || '',
      entry ? entry.toLocaleDateString('en-IN') : '',
      entry ? entry.toLocaleTimeString('en-IN') : '',
      v.purpose || '',
      v.visitorName,
      v.visitorCompany || '',
      v.address || '',
      v.mobile,
      v.personToMeet || '',
      v.department?.departmentName || '',
      v.visitorCategory?.categoryName || '',
      v.status,
    ]
      .map((f) => `"${String(f).replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visitor-report-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
