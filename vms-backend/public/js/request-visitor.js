(async function init() {
  const auth = requireRole('admin', 'user', 'hod');
  if (!auth) return;

  const usesTransactionDropdown = ['admin', 'hod'].includes(auth.user.role);
  renderShell({
    active: usesTransactionDropdown ? 'transaction' : 'request-visitor',
    activeChild: usesTransactionDropdown ? 'transaction:request-visitor' : undefined,
    title: 'Request for Visitor',
    subtitle: 'Enter visitor details to generate an inward number — sent for HOD approval first',
  });

  const content = document.getElementById('rv-content');
  await VisitorMaster.mount(content);
})();
