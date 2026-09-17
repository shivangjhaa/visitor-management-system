const MASTER_TITLES = {
  user: 'User Master',
  card: 'Card Master',
  category: 'Visitor Category',
  plant: 'Plant Master',
  department: 'Department Master',
  division: 'Division Master',
  location: 'Location Master',
};

(async function init() {
  const auth = requireRole('admin');
  if (!auth) return;

  const params = new URLSearchParams(window.location.search);
  const section = params.get('section') || 'user';

  renderShell({
    active: 'master',
    activeChild: `master:${section}`,
    title: MASTER_TITLES[section] || 'Master',
    subtitle: 'Manage reference data used across the system',
  });

  await loadSection(section);
})();

async function loadSection(key) {
  const content = document.getElementById('master-content');
  content.innerHTML = `<div class="center-loading"><span class="spinner"></span> Loading…</div>`;

  if (key === 'user') {
    await UserMaster.mount(content);
  } else {
    await MasterCrud.mount(content, key);
  }
}
