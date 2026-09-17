let currentRequest = null;

(async function init() {
  const auth = requireRole('admin', 'hod');
  if (!auth) return;

  renderShell({
    active: 'transaction',
    activeChild: 'transaction:hod-approval',
    title: 'HOD Approval',
    subtitle: 'Review visitor requests raised for each department — approve or reject with a remark',
  });

  document.getElementById('ha-refresh').addEventListener('click', loadRequests);
  document.getElementById('ha-close-modal').addEventListener('click', closeModal);
  document.getElementById('ha-modal').addEventListener('click', (e) => { if (e.target.id === 'ha-modal') closeModal(); });

  await loadRequests();
})();

function closeModal() {
  document.getElementById('ha-modal').classList.remove('open');
  currentRequest = null;
}

async function loadRequests() {
  const body = document.getElementById('ha-body');
  try {
    const { visitors } = await api('/visitors/approvals');
    if (!visitors.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="8">No requests waiting for approval right now.</td></tr>`;
      return;
    }
    body.innerHTML = visitors
      .map(
        (v) => `
      <tr>
        <td class="mono">${v.inwardNumber}</td>
        <td>${v.visitorName}<div class="small text-muted">${v.mobile}</div></td>
        <td>${v.visitorCompany || '—'}</td>
        <td>${v.department?.departmentName || '—'}</td>
        <td>${v.personToMeet || '—'}</td>
        <td>${v.createdBy?.name || '—'}</td>
        <td>${fmtDateTime(v.appointmentDate)}</td>
        <td><button class="btn btn-primary" style="padding:6px 14px;" data-review-id="${v._id}">Review</button></td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-review-id]').forEach((btn) => btn.addEventListener('click', () => openReview(btn.dataset.reviewId)));
  } catch (err) {
    body.innerHTML = `<tr class="empty-row"><td colspan="8">Failed to load: ${err.message}</td></tr>`;
  }
}

function row(label, value) {
  return `<div><div class="small text-muted" style="text-transform:uppercase;letter-spacing:.05em;">${label}</div><div style="margin-top:2px;">${value}</div></div>`;
}

async function openReview(id) {
  try {
    const { visitor } = await api(`/visitors/${id}`);
    currentRequest = visitor;

    document.getElementById('ha-modal-body').innerHTML = `
      <div class="ticket mt-8">
        <div class="ticket-label">Inward Number</div>
        <div class="ticket-number">${visitor.inwardNumber}</div>
      </div>
      <div class="grid-2 mt-24">
        ${row('Visitor', visitor.visitorName)}
        ${row('Mobile', visitor.mobile)}
        ${row('Email', visitor.email)}
        ${row('Category', visitor.visitorCategory?.categoryName || '—')}
        ${row('Representing', visitor.visitorCompany || '—')}
        ${row('Address', visitor.address || '—')}
        ${row('Person to Meet', visitor.personToMeet || '—')}
        ${row('Department', visitor.department?.departmentName || '—')}
        ${row('Plant / Location', [visitor.plant?.plantName, visitor.location?.locationName].filter(Boolean).join(' · ') || '—')}
        ${row('Appointment', fmtDateTime(visitor.appointmentDate))}
        ${row('Requested By', `${visitor.createdBy?.name || '—'} (${visitor.createdBy?.email || '—'})`)}
      </div>
      <div class="mt-16"><b>Purpose:</b> <span class="text-muted">${visitor.purpose}</span></div>

      <div class="field mt-16">
        <label for="ha-remark">Remark <span class="hint">(required to reject; optional to approve)</span></label>
        <textarea id="ha-remark" placeholder="Add a note for the record…"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-danger" id="ha-reject-btn">Reject</button>
        <button type="button" class="btn btn-primary" id="ha-approve-btn">Approve</button>
      </div>
    `;

    document.getElementById('ha-approve-btn').addEventListener('click', () => decide('approve'));
    document.getElementById('ha-reject-btn').addEventListener('click', () => decide('reject'));

    document.getElementById('ha-modal').classList.add('open');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function decide(action) {
  if (!currentRequest) return;
  const remark = document.getElementById('ha-remark').value.trim();

  if (action === 'reject' && !remark) {
    toast('A remark is required to reject a request', 'error');
    return;
  }
  if (action === 'reject' && !confirm(`Reject the request for ${currentRequest.visitorName}? The requester will be notified by email.`)) return;
  if (action === 'approve' && !confirm(`Approve the request for ${currentRequest.visitorName}? The visitor will be emailed their inward number.`)) return;

  const approveBtn = document.getElementById('ha-approve-btn');
  const rejectBtn = document.getElementById('ha-reject-btn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  const activeBtn = action === 'approve' ? approveBtn : rejectBtn;
  activeBtn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    await api(`/visitors/${currentRequest._id}/${action}`, { method: 'PUT', body: { remark } });
    toast(action === 'approve' ? 'Request approved — visitor notified' : 'Request rejected — requester notified', 'success');
    closeModal();
    loadRequests();
  } catch (err) {
    toast(err.message, 'error');
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    approveBtn.textContent = 'Approve';
    rejectBtn.textContent = 'Reject';
  }
}
