const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const DepartmentMaster = require('../models/DepartmentMaster');
const User = require('../models/User');

// @desc    List the department(s) this person can manage delegation for.
//          Admin sees every department; a HOD sees only the department(s)
//          whose HOD Employee Code matches their own Emp Id.
// @route   GET /api/delegate-updation
// @access  Private (admin, hod)
const listMyDepartments = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'hod' ? { hodEmpCode: req.user.empId || '__none__' } : {};
  const departments = await DepartmentMaster.find(filter).sort({ departmentName: 1 });
  res.json({ success: true, count: departments.length, departments });
});

// @desc    List candidate users who can stand in as a delegate for a given
//          department — active users belonging to that department, minus
//          whoever is already its HOD. Kept scoped (rather than exposing
//          the full user directory) since a HOD calls this too.
// @route   GET /api/delegate-updation/:departmentId/candidates
// @access  Private (admin, hod)
const listCandidates = asyncHandler(async (req, res) => {
  const department = await DepartmentMaster.findById(req.params.departmentId);
  if (!department) throw new ApiError(404, 'Department not found');

  if (req.user.role === 'hod' && department.hodEmpCode !== req.user.empId) {
    throw new ApiError(403, 'You are not the HOD of this department');
  }

  const candidates = await User.find({
    department: department._id,
    isActive: true,
    empId: { $ne: department.hodEmpCode || '__none__' },
  }).select('name email empId role');

  res.json({ success: true, count: candidates.length, candidates });
});

// @desc    Set (or clear) the delegation for a department — the backup
//          approver who can act on HOD Approval requests in the HOD's
//          absence. Admin can do this for any department; a HOD can only
//          do it for the department they themselves head. Writes the plain
//          Delegation Employee Code / Delegation Name fields on Department
//          Master, matching the original VMS's Department Master screen.
//
//          A delegate needs the 'hod' role for the HOD Approval nav item
//          and routes to be reachable at all (see api.js navConfigForRole
//          and authorize('admin','hod') on the approval routes) — so
//          assigning someone here promotes them to 'hod' if they're
//          currently a plain 'user', and clearing/replacing them demotes
//          them back to 'user' unless they still cover some OTHER
//          department as HOD or delegate.
// @route   PUT /api/delegate-updation/:departmentId
// @access  Private (admin, hod)
const setDelegate = asyncHandler(async (req, res) => {
  const department = await DepartmentMaster.findById(req.params.departmentId);
  if (!department) throw new ApiError(404, 'Department not found');

  if (req.user.role === 'hod' && department.hodEmpCode !== req.user.empId) {
    throw new ApiError(403, 'You are not the HOD of this department');
  }

  const previousDelegateEmpCode = department.delegationEmpCode;
  const { delegateUserId } = req.body;

  if (delegateUserId) {
    const candidate = await User.findById(delegateUserId);
    if (!candidate || !candidate.isActive) throw new ApiError(400, 'Selected delegate is not a valid active user');
    department.delegationEmpCode = candidate.empId || '';
    department.delegationName = candidate.name;

    if (candidate.role === 'user') {
      candidate.role = 'hod';
      await candidate.save();
    }
  } else {
    department.delegationEmpCode = '';
    department.delegationName = '';
  }

  await department.save();

  // Demote whoever was previously the delegate, but only if removing them
  // from this department leaves them covering nothing else.
  if (previousDelegateEmpCode && previousDelegateEmpCode !== department.delegationEmpCode) {
    const stillCovers = await DepartmentMaster.exists({
      $or: [{ hodEmpCode: previousDelegateEmpCode }, { delegationEmpCode: previousDelegateEmpCode }],
    });
    if (!stillCovers) {
      await User.updateOne({ empId: previousDelegateEmpCode, role: 'hod' }, { role: 'user' });
    }
  }

  res.json({ success: true, message: delegateUserId ? 'Delegate assigned' : 'Delegate cleared', department });
});

module.exports = { listMyDepartments, listCandidates, setDelegate };
