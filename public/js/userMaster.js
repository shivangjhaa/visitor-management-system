/* Master > User Master — admin manages system login accounts. These are the
   company's employees who get access to sign in to the VMS: a "user" role
   can Request for Visitor, a "security" role can do Visitor Entry / Out
   Pending List, and "admin" has access to everything.

   Layout intentionally mirrors the legacy ASP.NET User Master screen: a
   single always-visible form at the top (Save creates OR updates,
   depending on whether a row is currently selected) and a "User Details"
   table below with a "Select" link that loads that row back into the form
   for editing. */
const UserMaster = (() => {
  let editingId = null;
  let cachedItems = [];

  function markup() {
    return `
      <div class="card">
        <div class="card-header"><h2>User Master</h2></div>
        <div class="card-body">
          <form id="um-form">
            <div class="grid-2" style="align-items:start;">
              <div>
                <div class="field"><label for="uf-empId">Emp Id</label><input type="text" id="uf-empId" placeholder="e.g. 40034080" /></div>
                <div class="field"><label for="uf-location">Location</label><select id="uf-location"></select></div>
                <div class="field"><label for="uf-role">User Role</label>
                  <select id="uf-role">
                    <option value="user">User — can request visitor appointments</option>
                    <option value="hod">HOD — user rights + approves requests for their department</option>
                    <option value="security">Security — visitor entry &amp; out</option>
                    <option value="admin">Admin — full access</option>
                  </select>
                </div>
                <div class="field"><label for="uf-mobile">Mobile</label><input type="text" id="uf-mobile" placeholder="10-digit number" /></div>
                <div class="field" id="uf-password-field"><label for="uf-password">Password</label><input type="password" id="uf-password" placeholder="Minimum 6 characters" /></div>
              </div>
              <div>
                <div class="field"><label for="uf-name">Name</label><input type="text" id="uf-name" required /></div>
                <div class="field"><label for="uf-division">Division</label><select id="uf-division"></select></div>
                <div class="field"><label for="uf-department">Department</label><select id="uf-department"></select></div>
                <div class="field"><label for="uf-email">Email</label><input type="email" id="uf-email" required /></div>
                <div class="field">
                  <label>Active</label>
                  <div class="flex gap-12" style="padding-top:6px;">
                    <label class="flex items-center gap-4" style="text-transform:none;font-weight:400;font-size:14px;"><input type="radio" name="uf-active" id="uf-active-yes" value="yes" checked /> Yes</label>
                    <label class="flex items-center gap-4" style="text-transform:none;font-weight:400;font-size:14px;"><input type="radio" name="uf-active" id="uf-active-no" value="no" /> No</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="um-reset-btn" style="display:none;">Reset Password</button>
              <button type="button" class="btn btn-secondary" id="um-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary" id="um-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>

      <div class="card mt-24">
        <div class="card-header">
          <h2>User Details</h2>
          <input type="text" id="um-search" placeholder="Search name, email, mobile, emp id…" style="width:240px;" />
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Seq</th><th>Emp Id</th><th>User Name</th><th>Location</th><th>Division</th><th>User Role</th><th>Department</th><th>Mobile</th><th>Email</th><th>Active</th><th>Select</th><th>Delete</th></tr>
            </thead>
            <tbody id="um-body"><tr class="empty-row"><td colspan="12">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="modal-backdrop" id="um-reset-modal">
        <div class="modal">
          <div class="card-header"><h2>Reset Password</h2><button class="link-btn" id="um-reset-close">Close ✕</button></div>
          <div class="card-body">
            <form id="um-reset-form">
              <div class="field"><label>New Password</label><input type="password" id="uf-new-password" placeholder="Minimum 6 characters" required /></div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="um-reset-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-primary" id="um-reset-save-btn">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function roleLabel(role) {
    return { admin: 'Admin', user: 'User', security: 'Security', hod: 'HOD' }[role] || role;
  }

  async function loadDropdowns() {
    await Promise.all([
      fillSelect(document.getElementById('uf-location'), '/master/locations', { labelKey: 'locationName', placeholder: 'None' }),
      fillSelect(document.getElementById('uf-division'), '/master/divisions', { labelKey: 'divisionName', placeholder: 'None' }),
      fillSelect(document.getElementById('uf-department'), '/master/departments', { labelKey: 'departmentName', placeholder: 'None' }),
    ]);
  }

  function debounceLocal(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function loadRows() {
    const body = document.getElementById('um-body');
    const search = document.getElementById('um-search').value.trim();
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      const { items } = await api(`/users${qs}`);
      cachedItems = items;
      if (!items.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="12">No users yet. Fill in the form above and click Save.</td></tr>`;
        return;
      }
      body.innerHTML = items
        .map(
          (u, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${u.empId || '—'}</td>
          <td>${u.name}</td>
          <td>${u.location?.locationName || '—'}</td>
          <td>${u.division?.divisionName || '—'}</td>
          <td>${roleLabel(u.role)}</td>
          <td>${u.department?.departmentName || '—'}</td>
          <td>${u.mobile || '—'}</td>
          <td>${u.email}</td>
          <td>${u.isActive ? 'Y' : 'N'}</td>
          <td><button class="link-btn" data-select-id="${u._id}">Select</button></td>
          <td><button class="link-btn" style="color:var(--danger);" data-delete-id="${u._id}" data-delete-name="${u.name}">Delete</button></td>
        </tr>`
        )
        .join('');

      body.querySelectorAll('[data-select-id]').forEach((btn) => btn.addEventListener('click', () => selectRow(btn.dataset.selectId)));
      body.querySelectorAll('[data-delete-id]').forEach((btn) => btn.addEventListener('click', () => deleteUser(btn.dataset.deleteId, btn.dataset.deleteName)));
    } catch (err) {
      body.innerHTML = `<tr class="empty-row"><td colspan="12">Failed to load: ${err.message}</td></tr>`;
    }
  }

  async function deleteUser(id, name) {
    if (!confirm(`Delete user "${name}"? This cannot be undone — they will no longer be able to sign in.`)) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      toast('User deleted', 'success');
      if (editingId === id) resetForm();
      loadRows();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function resetForm() {
    editingId = null;
    document.getElementById('um-form').reset();
    document.getElementById('uf-active-yes').checked = true;
    document.getElementById('uf-password-field').style.display = 'block';
    document.getElementById('uf-password').required = true;
    document.getElementById('um-reset-btn').style.display = 'none';
    document.getElementById('um-save-btn').textContent = 'Save';
    document.querySelectorAll('#um-body tr').forEach((tr) => tr.classList.remove('selected-row'));
  }

  function selectRow(id) {
    const record = cachedItems.find((i) => i._id === id);
    if (!record) return;
    editingId = id;

    document.getElementById('uf-empId').value = record.empId || '';
    document.getElementById('uf-name').value = record.name || '';
    document.getElementById('uf-email').value = record.email || '';
    document.getElementById('uf-mobile').value = record.mobile || '';
    document.getElementById('uf-location').value = record.location?._id || '';
    document.getElementById('uf-division').value = record.division?._id || '';
    document.getElementById('uf-department').value = record.department?._id || '';
    document.getElementById('uf-role').value = record.role || 'user';
    document.getElementById('uf-active-yes').checked = !!record.isActive;
    document.getElementById('uf-active-no').checked = !record.isActive;

    // Password is never editable directly from this form — use the
    // dedicated Reset Password action instead (same as the legacy system,
    // which never displays or re-collects an existing password).
    document.getElementById('uf-password-field').style.display = 'none';
    document.getElementById('uf-password').required = false;
    document.getElementById('uf-password').value = '';

    document.getElementById('um-reset-btn').style.display = 'inline-flex';
    document.getElementById('um-save-btn').textContent = 'Update';

    document.querySelectorAll('#um-body tr').forEach((tr) => tr.classList.remove('selected-row'));
    const btn = document.querySelector(`[data-select-id="${id}"]`);
    if (btn) btn.closest('tr').classList.add('selected-row');

    document.getElementById('um-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('um-save-btn');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const payload = {
      empId: document.getElementById('uf-empId').value.trim(),
      name: document.getElementById('uf-name').value.trim(),
      email: document.getElementById('uf-email').value.trim(),
      mobile: document.getElementById('uf-mobile').value.trim(),
      location: document.getElementById('uf-location').value || null,
      division: document.getElementById('uf-division').value || null,
      department: document.getElementById('uf-department').value || null,
      role: document.getElementById('uf-role').value,
      isActive: document.getElementById('uf-active-yes').checked,
    };
    if (!editingId) payload.password = document.getElementById('uf-password').value;

    try {
      if (editingId) {
        await api(`/users/${editingId}`, { method: 'PUT', body: payload });
        toast('User updated', 'success');
      } else {
        await api('/users', { method: 'POST', body: payload });
        toast('User created', 'success');
      }
      resetForm();
      loadRows();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  function openResetModal() {
    if (!editingId) return;
    document.getElementById('uf-new-password').value = '';
    document.getElementById('um-reset-modal').classList.add('open');
  }
  function closeResetModal() {
    document.getElementById('um-reset-modal').classList.remove('open');
  }
  async function onResetSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('um-reset-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Resetting…';
    try {
      await api(`/users/${editingId}/reset-password`, {
        method: 'PATCH',
        body: { password: document.getElementById('uf-new-password').value },
      });
      toast('Password reset successfully', 'success');
      closeResetModal();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Reset Password';
    }
  }

  async function mount(container) {
    container.innerHTML = markup();
    await loadDropdowns();
    await loadRows();
    resetForm();

    document.getElementById('um-form').addEventListener('submit', onSubmit);
    document.getElementById('um-cancel-btn').addEventListener('click', resetForm);
    document.getElementById('um-reset-btn').addEventListener('click', openResetModal);
    document.getElementById('um-search').addEventListener('input', debounceLocal(loadRows, 300));

    document.getElementById('um-reset-close').addEventListener('click', closeResetModal);
    document.getElementById('um-reset-cancel-btn').addEventListener('click', closeResetModal);
    document.getElementById('um-reset-form').addEventListener('submit', onResetSubmit);
    document.getElementById('um-reset-modal').addEventListener('click', (e) => { if (e.target.id === 'um-reset-modal') closeResetModal(); });
  }

  return { mount };
})();
