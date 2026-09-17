/* Shared "create visitor + appointment history" UI, mounted into a given
   container element. This is the "Request for Visitor" screen — used by:
   - public/request-visitor.html ('user' role, and 'admin' via Transaction)
*/
const VisitorMaster = (() => {
  function markup() {
    return `
      <div class="grid-2" style="align-items:start;">
        <div class="card">
          <div class="card-header"><h2>Request for Visitor</h2></div>
          <div class="card-body">
            <form id="vm-form">
              <div class="section-title">Visitor Details</div>
              <div class="grid-2">
                <div class="field">
                  <label for="vm-visitorName">Visitor Name</label>
                  <input type="text" id="vm-visitorName" placeholder="Full name" required />
                </div>
                <div class="field">
                  <label for="vm-mobile">Mobile Number</label>
                  <input type="tel" id="vm-mobile" placeholder="10-digit number" pattern="[0-9]{10}" required />
                </div>
                <div class="field">
                  <label for="vm-email">Email <span class="hint">(required — appointment confirmation is sent here once approved)</span></label>
                  <input type="email" id="vm-email" placeholder="visitor@company.com" required />
                </div>
                <div class="field">
                  <label for="vm-visitorCompany">Visitor's Company</label>
                  <input type="text" id="vm-visitorCompany" placeholder="Company / organisation" />
                </div>
                <div class="field">
                  <label for="vm-address">Address <span class="hint">(optional)</span></label>
                  <input type="text" id="vm-address" placeholder="Visitor's company / correspondence address" />
                </div>
                <div class="field">
                  <label for="vm-visitorCategory">Visitor Category</label>
                  <select id="vm-visitorCategory" required></select>
                </div>
                <div class="field">
                  <label for="vm-numberOfVisitors">No. of Visitors</label>
                  <input type="number" id="vm-numberOfVisitors" min="1" value="1" />
                </div>
              </div>

              <div class="section-title">Appointment Details</div>
              <div class="grid-2">
                <div class="field">
                  <label for="vm-personToMeet">Person to Meet</label>
                  <input type="text" id="vm-personToMeet" placeholder="Name of the employee being visited" required />
                </div>
                <div class="field">
                  <label for="vm-department">Department <span class="hint">(routes this request to the right HOD for approval)</span></label>
                  <select id="vm-department" required></select>
                </div>
                <div class="field">
                  <label for="vm-plant">Plant</label>
                  <select id="vm-plant"></select>
                </div>
                <div class="field">
                  <label for="vm-division">Division</label>
                  <select id="vm-division"></select>
                </div>
                <div class="field">
                  <label for="vm-location">Location</label>
                  <select id="vm-location"></select>
                </div>
                <div class="field">
                  <label for="vm-appointmentDate">Appointment Date &amp; Time</label>
                  <input type="datetime-local" id="vm-appointmentDate" required />
                </div>
              </div>
              <div class="field">
                <label for="vm-purpose">Purpose of Visit</label>
                <textarea id="vm-purpose" placeholder="Brief reason for the visit" required></textarea>
              </div>

              <button type="submit" class="btn btn-primary btn-block" id="vm-submit-btn">Generate Inward Number</button>
            </form>
          </div>
        </div>

        <div>
          <div class="card" id="vm-ticket-card" style="display:none;">
            <div class="card-header"><h2>Request Submitted</h2></div>
            <div class="card-body">
              <div class="ticket">
                <div class="ticket-label">Inward Number</div>
                <div class="ticket-number" id="vm-ticket-number">—</div>
              </div>
              <p class="small text-muted mt-16">
                This request has been sent to the department's HOD for approval. The visitor will only be emailed their appointment confirmation once it's approved.
              </p>
            </div>
          </div>
          <div class="card mt-24">
            <div class="card-header"><h2>How it works</h2></div>
            <div class="card-body small text-muted" style="line-height:1.7;">
              1. Fill in visitor and appointment details (email and department are required).<br/>
              2. A unique inward number is generated instantly.<br/>
              3. The department's HOD (or their delegate) is emailed to review it under HOD Approval.<br/>
              4. If approved, the visitor is emailed the inward number. If rejected, you're notified by email with the HOD's remark.<br/>
              5. Security verifies the number at the gate and issues a gate pass.<br/>
              6. Entry and exit times are logged automatically.
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-24">
        <div class="card-header">
          <h2>Appointment History</h2>
          <div class="flex gap-8">
            <input type="text" id="vm-search-input" placeholder="Search name, mobile, inward no." style="width:220px;" />
            <select id="vm-status-filter" style="width:170px;">
              <option value="">All statuses</option>
              <option>PendingApproval</option>
              <option>Pending</option>
              <option>Rejected</option>
              <option>CheckedIn</option>
              <option>CheckedOut</option>
              <option>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Inward No.</th><th>Visitor</th><th>Category</th><th>Meeting</th><th>Appointment</th><th>Status</th><th></th></tr>
            </thead>
            <tbody id="vm-history-body"><tr class="empty-row"><td colspan="7">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="modal-backdrop" id="vm-detail-modal">
        <div class="modal">
          <div class="card-header"><h2>Visitor Details</h2><button class="link-btn" id="vm-close-modal">Close ✕</button></div>
          <div class="card-body" id="vm-detail-body"></div>
        </div>
      </div>
    `;
  }

  function val(id) { return document.getElementById(id).value.trim(); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function loadDropdowns() {
    await Promise.all([
      fillSelect(document.getElementById('vm-visitorCategory'), '/master/visitor-categories', { labelKey: 'categoryName', placeholder: 'Select category' }),
      fillSelect(document.getElementById('vm-department'), '/master/departments', { labelKey: 'departmentName', placeholder: 'Select department' }),
      fillSelect(document.getElementById('vm-plant'), '/master/plants', { labelKey: 'plantName', placeholder: 'None' }),
      fillSelect(document.getElementById('vm-division'), '/master/divisions', { labelKey: 'divisionName', placeholder: 'None' }),
      fillSelect(document.getElementById('vm-location'), '/master/locations', { labelKey: 'locationName', placeholder: 'None' }),
    ]);
  }

  async function loadHistory() {
    const body = document.getElementById('vm-history-body');
    const search = val('vm-search-input');
    const status = document.getElementById('vm-status-filter').value;
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);

    try {
      const { visitors } = await api(`/visitors?${qs.toString()}`);
      if (!visitors.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="7">No appointments found. Create one using the form above.</td></tr>`;
        return;
      }
      body.innerHTML = visitors
        .map(
          (v) => `
        <tr>
          <td class="mono">${v.inwardNumber}</td>
          <td>${v.visitorName}<div class="small text-muted">${v.mobile}</div></td>
          <td>${v.visitorCategory?.categoryName || '—'}</td>
          <td>${v.personToMeet || '—'}${v.department?.departmentName ? `<div class="small text-muted">${v.department.departmentName}</div>` : ''}</td>
          <td>${fmtDate(v.appointmentDate)}</td>
          <td>${chip(v.status)}</td>
          <td><button class="link-btn" data-id="${v._id}">View</button></td>
        </tr>`
        )
        .join('');

      body.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', () => showDetail(btn.dataset.id)));
    } catch (err) {
      body.innerHTML = `<tr class="empty-row"><td colspan="7">Failed to load: ${err.message}</td></tr>`;
    }
  }

  function detailRow(label, value) {
    return `<div><div class="small text-muted" style="text-transform:uppercase;letter-spacing:.05em;">${label}</div><div style="margin-top:2px;">${value}</div></div>`;
  }

  async function showDetail(id) {
    try {
      const { visitor: v } = await api(`/visitors/${id}`);
      document.getElementById('vm-detail-body').innerHTML = `
        <div class="ticket mt-8">
          <div class="ticket-label">Inward Number</div>
          <div class="ticket-number">${v.inwardNumber}</div>
        </div>
        <div class="grid-2 mt-24">
          ${detailRow('Visitor', v.visitorName)}
          ${detailRow('Mobile', v.mobile)}
          ${detailRow('Email', v.email)}
          ${detailRow('Category', v.visitorCategory?.categoryName || '—')}
          ${detailRow('Company', v.visitorCompany || '—')}
          ${detailRow('Address', v.address || '—')}
          ${detailRow('Person to Meet', v.personToMeet || '—')}
          ${detailRow('Department', v.department?.departmentName || '—')}
          ${detailRow('Plant', v.plant?.plantName || '—')}
          ${detailRow('Division', v.division?.divisionName || '—')}
          ${detailRow('Location', v.location?.locationName || '—')}
          ${detailRow('Appointment', fmtDateTime(v.appointmentDate))}
          ${detailRow('Status', chip(v.status))}
          ${detailRow('Entry Time', fmtDateTime(v.entryTime))}
          ${detailRow('Exit Time', fmtDateTime(v.exitTime))}
          ${detailRow('Access Card', v.assignedCard?.cardNumber || '—')}
        </div>
        <div class="mt-16"><b>Purpose:</b> <span class="text-muted">${v.purpose}</span></div>
        ${v.approvalRemark ? `<div class="mt-16"><b>HOD Remark:</b> <span class="text-muted">${v.approvalRemark}</span></div>` : ''}
        ${['PendingApproval', 'Pending'].includes(v.status) ? `<button class="btn btn-danger mt-16" id="vm-cancel-btn" data-id="${v._id}">Cancel Appointment</button>` : ''}
      `;
      const cancelBtn = document.getElementById('vm-cancel-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', () => cancelVisitor(v._id));
      document.getElementById('vm-detail-modal').classList.add('open');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function cancelVisitor(id) {
    if (!confirm('Cancel this appointment? This cannot be undone.')) return;
    try {
      await api(`/visitors/${id}/cancel`, { method: 'PUT' });
      toast('Appointment cancelled', 'success');
      document.getElementById('vm-detail-modal').classList.remove('open');
      loadHistory();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    const btn = document.getElementById('vm-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating…';

    const payload = {
      visitorName: val('vm-visitorName'),
      mobile: val('vm-mobile'),
      email: val('vm-email'),
      visitorCompany: val('vm-visitorCompany'),
      address: val('vm-address'),
      visitorCategory: val('vm-visitorCategory'),
      numberOfVisitors: Number(val('vm-numberOfVisitors') || 1),
      personToMeet: val('vm-personToMeet'),
      department: val('vm-department'),
      plant: val('vm-plant'),
      division: val('vm-division'),
      location: val('vm-location'),
      appointmentDate: val('vm-appointmentDate'),
      purpose: val('vm-purpose'),
    };

    try {
      const { visitor } = await api('/visitors', { method: 'POST', body: payload });
      document.getElementById('vm-ticket-number').textContent = visitor.inwardNumber;
      document.getElementById('vm-ticket-card').style.display = 'block';
      toast(`Inward number ${visitor.inwardNumber} generated — sent for HOD approval`, 'success');
      document.getElementById('vm-form').reset();
      document.getElementById('vm-numberOfVisitors').value = 1;
      loadHistory();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Inward Number';
    }
  }

  async function mount(container) {
    container.innerHTML = markup();
    await loadDropdowns();
    await loadHistory();

    document.getElementById('vm-form').addEventListener('submit', onCreate);
    document.getElementById('vm-search-input').addEventListener('input', debounce(loadHistory, 350));
    document.getElementById('vm-status-filter').addEventListener('change', loadHistory);
    document.getElementById('vm-close-modal').addEventListener('click', () => document.getElementById('vm-detail-modal').classList.remove('open'));
    document.getElementById('vm-detail-modal').addEventListener('click', (e) => {
      if (e.target.id === 'vm-detail-modal') e.target.classList.remove('open');
    });
  }

  return { mount };
})();
