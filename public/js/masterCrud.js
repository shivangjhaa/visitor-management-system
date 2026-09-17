/* Generic, config-driven CRUD table+modal for simple master entities
   (Card, Visitor Category, Plant, Department, Division, Location, Delegate).
   One implementation, seven configs — see MASTER_ENTITY_CONFIG below. */

const MASTER_ENTITY_CONFIG = {
  category: {
    label: 'Visitor Category',
    apiPath: '/master/visitor-categories',
    columns: [{ key: 'categoryName', label: 'Category Name' }, { key: 'description', label: 'Description' }],
    fields: [
      { key: 'categoryName', label: 'Category Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'text' },
    ],
  },
  card: {
    label: 'Card Master',
    apiPath: '/master/cards',
    columns: [
      { key: 'cardNumber', label: 'Card Number' },
      { key: 'cardType', label: 'Type' },
      { key: 'status', label: 'Status', render: (v) => `<span class="chip chip-${v.status === 'Available' ? 'CheckedOut' : v.status === 'Issued' ? 'CheckedIn' : 'Cancelled'}">${v.status}</span>` },
    ],
    fields: [
      { key: 'cardNumber', label: 'Card Number', type: 'text', required: true, placeholder: 'e.g. CARD006' },
      { key: 'cardType', label: 'Card Type', type: 'select', options: ['RFID', 'Manual', 'Barcode'] },
    ],
  },
  plant: {
    label: 'Plant Master',
    apiPath: '/master/plants',
    columns: [{ key: 'plantName', label: 'Plant Name' }, { key: 'plantCode', label: 'Code' }, { key: 'address', label: 'Address' }],
    fields: [
      { key: 'plantName', label: 'Plant Name', type: 'text', required: true },
      { key: 'plantCode', label: 'Plant Code', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
    ],
  },
  department: {
    label: 'Department Master',
    intro: 'HOD Employee Code / Name identify who approves visitor requests raised for this department (Transaction > HOD Approval) — matched against that person\'s Emp Id in User Master. Delegation Employee Code / Name is the backup approver for when the HOD is away; the HOD can also update just their own delegate from Master > Delegate Updation without needing admin access.',
    apiPath: '/master/departments',
    columns: [
      { key: 'departmentName', label: 'Department' },
      { key: 'departmentCode', label: 'Code' },
      { key: 'plant', label: 'Plant', render: (v) => v.plant?.plantName || '—' },
      { key: 'hodEmpCode', label: 'HOD Emp Code' },
      { key: 'hodName', label: 'HOD Name' },
      { key: 'delegationEmpCode', label: 'Delegation Emp Code' },
      { key: 'delegationName', label: 'Delegation Name' },
    ],
    fields: [
      { key: 'departmentName', label: 'Department', type: 'text', required: true },
      { key: 'departmentCode', label: 'Department Code', type: 'text' },
      { key: 'plant', label: 'Plant', type: 'masterSelect', masterPath: '/master/plants', labelKey: 'plantName' },
      { key: 'hodEmpCode', label: 'HOD Employee Code', type: 'text', placeholder: 'Must match the HOD\'s Emp Id in User Master' },
      { key: 'hodName', label: 'HOD Name', type: 'text' },
      { key: 'delegationEmpCode', label: 'Delegation Employee Code', type: 'text', placeholder: 'Optional — backup approver\'s Emp Id' },
      { key: 'delegationName', label: 'Delegation Name', type: 'text' },
    ],
  },
  division: {
    label: 'Division Master',
    apiPath: '/master/divisions',
    columns: [{ key: 'divisionName', label: 'Division Name' }, { key: 'divisionCode', label: 'Code' }],
    fields: [
      { key: 'divisionName', label: 'Division Name', type: 'text', required: true },
      { key: 'divisionCode', label: 'Division Code', type: 'text' },
    ],
  },
  location: {
    label: 'Location Master',
    apiPath: '/master/locations',
    columns: [{ key: 'locationName', label: 'Location Name' }, { key: 'locationCode', label: 'Code' }, { key: 'address', label: 'Address' }],
    fields: [
      { key: 'locationName', label: 'Location Name', type: 'text', required: true },
      { key: 'locationCode', label: 'Location Code', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
    ],
  },
};

const MasterCrud = (() => {
  let currentConfig = null;
  let editingId = null;

  function fieldInput(field, value = '') {
    if (field.type === 'select') {
      return `<select id="mf-${field.key}">${field.options.map((o) => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    }
    if (field.type === 'masterSelect') {
      return `<select id="mf-${field.key}" data-master-path="${field.masterPath}" data-label-key="${field.labelKey}" data-selected="${value || ''}"><option value="">None</option></select>`;
    }
    return `<input type="${field.type}" id="mf-${field.key}" value="${value ?? ''}" ${field.placeholder ? `placeholder="${field.placeholder}"` : ''} />`;
  }

  function markup(config) {
    return `
      <div class="card">
        <div class="card-header">
          <h2>${config.label}</h2>
          <div class="flex gap-8">
            <input type="text" id="mc-search" placeholder="Search…" style="width:200px;" />
            <button class="btn btn-primary" id="mc-add-btn">+ Add New</button>
          </div>
        </div>
        ${config.intro ? `<div class="card-body" style="padding-bottom:0;"><p class="small text-muted">${config.intro}</p></div>` : ''}
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>${config.columns.map((c) => `<th>${c.label}</th>`).join('')}<th>Status</th><th></th></tr>
            </thead>
            <tbody id="mc-body"><tr class="empty-row"><td colspan="${config.columns.length + 2}">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="modal-backdrop" id="mc-modal">
        <div class="modal">
          <div class="card-header"><h2 id="mc-modal-title">Add ${config.label}</h2><button class="link-btn" id="mc-modal-close">Close ✕</button></div>
          <div class="card-body">
            <form id="mc-form">
              ${config.fields.map((f) => `<div class="field"><label>${f.label}${f.required ? '' : ' <span class="hint">(optional)</span>'}</label>${fieldInput(f)}</div>`).join('')}
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="mc-cancel-btn">Cancel</button>
                <button type="submit" class="btn btn-primary" id="mc-save-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  async function hydrateMasterSelects() {
    const selects = document.querySelectorAll('#mc-form select[data-master-path]');
    for (const sel of selects) {
      await fillSelect(sel, sel.dataset.masterPath, { labelKey: sel.dataset.labelKey, placeholder: 'None' });
      if (sel.dataset.selected) sel.value = sel.dataset.selected;
    }
  }

  async function loadRows() {
    const body = document.getElementById('mc-body');
    const search = document.getElementById('mc-search').value.trim();
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      const { items } = await api(`${currentConfig.apiPath}${qs}`);
      if (!items.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="${currentConfig.columns.length + 2}">No records yet. Click "Add New" to create one.</td></tr>`;
        return;
      }
      body.innerHTML = items
        .map(
          (item) => `
        <tr>
          ${currentConfig.columns.map((c) => `<td>${c.render ? c.render(item) : (item[c.key] ?? '—')}</td>`).join('')}
          <td>
            <button class="pill-toggle ${item.isActive ? 'on' : ''}" data-toggle-id="${item._id}">
              <span class="track"></span><span class="pill-label">${item.isActive ? 'Active' : 'Inactive'}</span>
            </button>
          </td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" title="Edit" data-edit-id="${item._id}">✎</button>
              <button class="icon-btn danger" title="Delete" data-delete-id="${item._id}">🗑</button>
            </div>
          </td>
        </tr>`
        )
        .join('');

      body.querySelectorAll('[data-toggle-id]').forEach((btn) => btn.addEventListener('click', () => toggleActive(btn.dataset.toggleId)));
      body.querySelectorAll('[data-edit-id]').forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.editId, items)));
      body.querySelectorAll('[data-delete-id]').forEach((btn) => btn.addEventListener('click', () => remove(btn.dataset.deleteId)));
    } catch (err) {
      body.innerHTML = `<tr class="empty-row"><td colspan="${currentConfig.columns.length + 2}">Failed to load: ${err.message}</td></tr>`;
    }
  }

  async function toggleActive(id) {
    try {
      await api(`${currentConfig.apiPath}/${id}/toggle`, { method: 'PATCH' });
      loadRows();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove(id) {
    if (!confirm(`Delete this ${currentConfig.label.toLowerCase()} record? This cannot be undone.`)) return;
    try {
      await api(`${currentConfig.apiPath}/${id}`, { method: 'DELETE' });
      toast(`${currentConfig.label} deleted`, 'success');
      loadRows();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function openModal(id, cachedItems) {
    editingId = id || null;
    document.getElementById('mc-modal-title').textContent = id ? `Edit ${currentConfig.label}` : `Add ${currentConfig.label}`;

    let record = {};
    if (id) {
      const found = cachedItems && cachedItems.find((i) => i._id === id);
      record = found || {};
    }

    currentConfig.fields.forEach((f) => {
      const el = document.getElementById(`mf-${f.key}`);
      if (!el) return;
      const rawVal = record[f.key];
      const fieldVal = f.type === 'masterSelect' ? (rawVal?._id || rawVal || '') : (rawVal ?? '');
      if (f.type === 'select') el.value = fieldVal || f.options[0];
      else if (f.type === 'masterSelect') el.dataset.selected = fieldVal;
      else el.value = fieldVal;
    });

    await hydrateMasterSelects();
    document.getElementById('mc-modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('mc-modal').classList.remove('open');
    document.getElementById('mc-form').reset();
    editingId = null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('mc-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    const payload = {};
    currentConfig.fields.forEach((f) => {
      const el = document.getElementById(`mf-${f.key}`);
      payload[f.key] = el.value || (f.type === 'masterSelect' ? null : '');
    });

    try {
      if (editingId) {
        await api(`${currentConfig.apiPath}/${editingId}`, { method: 'PUT', body: payload });
        toast(`${currentConfig.label} updated`, 'success');
      } else {
        await api(currentConfig.apiPath, { method: 'POST', body: payload });
        toast(`${currentConfig.label} created`, 'success');
      }
      closeModal();
      loadRows();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }

  function debounceLocal(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function mount(container, entityKey) {
    currentConfig = MASTER_ENTITY_CONFIG[entityKey];
    if (!currentConfig) {
      container.innerHTML = `<div class="card"><div class="card-body">Unknown master section.</div></div>`;
      return;
    }
    container.innerHTML = markup(currentConfig);
    await loadRows();

    document.getElementById('mc-add-btn').addEventListener('click', () => openModal(null));
    document.getElementById('mc-search').addEventListener('input', debounceLocal(loadRows, 300));
    document.getElementById('mc-modal-close').addEventListener('click', closeModal);
    document.getElementById('mc-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('mc-form').addEventListener('submit', onSubmit);
    document.getElementById('mc-modal').addEventListener('click', (e) => { if (e.target.id === 'mc-modal') closeModal(); });
  }

  return { mount };
})();
