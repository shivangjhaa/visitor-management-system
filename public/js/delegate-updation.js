let currentDepartmentId = null;

(async function init() {
  const auth = requireRole('admin', 'hod');
  if (!auth) return;

  renderShell({
    active: auth.user.role === 'admin' ? 'master' : 'delegate-updation',
    activeChild: auth.user.role === 'admin' ? 'master:delegate-updation' : undefined,
    title: 'Delegate Updation',
    subtitle: 'Assign a backup approver for HOD Approval',
  });

  document.getElementById('du-close-modal').addEventListener('click', closeModal);
  document.getElementById('du-modal').addEventListener('click', (e) => { if (e.target.id === 'du-modal') closeModal(); });
  document.getElementById('du-save-btn').addEventListener('click', saveDelegate);
  document.getElementById('du-clear-btn').addEventListener('click', clearDelegate);

  await loadDepartments();
})();

function closeModal() {
  document.getElementById('du-modal').classList.remove('open');
  currentDepartmentId = null;
}

async function loadDepartments() {
  const body = document.getElementById('du-body');
  try {
    const { departments } = await api('/delegate-updation');
    if (!departments.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="5">No department is registered with you as HOD.</td></tr>`;
      return;
    }
    body.innerHTML = departments
      .map(
        (d, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${d.departmentName}</td>
        <td>${d.hodName || '—'}</td>
        <td>${d.delegationName || '—'}</td>
        <td><button class="link-btn" data-dept-id="${d._id}">Manage</button></td>
      </tr>`
      )
      .join('');

    body.querySelectorAll('[data-dept-id]').forEach((btn) => btn.addEventListener('click', () => openManage(btn.dataset.deptId)));
  } catch (err) {
    body.innerHTML = `<tr class="empty-row"><td colspan="5">Failed to load: ${err.message}</td></tr>`;
  }
}

async function openManage(departmentId) {
  currentDepartmentId = departmentId;
  const select = document.getElementById('du-select');
  const emptyNote = document.getElementById('du-empty-note');
  select.innerHTML = `<option value="">None</option>`;
  emptyNote.style.display = 'none';

  try {
    const { candidates } = await api(`/delegate-updation/${departmentId}/candidates`);
    if (!candidates.length) {
      emptyNote.style.display = 'block';
    } else {
      candidates.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c._id;
        opt.textContent = `${c.name} (${c.email})`;
        select.appendChild(opt);
      });
    }
    document.getElementById('du-modal').classList.add('open');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function saveDelegate() {
  const btn = document.getElementById('du-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';
  try {
    await api(`/delegate-updation/${currentDepartmentId}`, { method: 'PUT', body: { delegateUserId: document.getElementById('du-select').value || null } });
    toast('Delegate updated', 'success');
    closeModal();
    loadDepartments();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

async function clearDelegate() {
  document.getElementById('du-select').value = '';
  saveDelegate();
}
