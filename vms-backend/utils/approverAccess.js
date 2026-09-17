const DepartmentMaster = require('../models/DepartmentMaster');

/**
 * Department IDs a person is allowed to act as approver for — every
 * department if admin (returns null = "no restriction"), or only the
 * department(s) where their own Emp Id matches that department's HOD
 * Employee Code or Delegation Employee Code.
 *
 * Shared by controllers/hodController.js (HOD Approval list/decide) and
 * controllers/visitorController.js (single-record access check), so both
 * stay consistent about who counts as "the approver" for a department.
 */
async function approverDepartmentIds(user) {
  if (user.role === 'admin') return null;
  if (!user.empId) return [];
  const depts = await DepartmentMaster.find({
    $or: [{ hodEmpCode: user.empId }, { delegationEmpCode: user.empId }],
  }).select('_id');
  return depts.map((d) => String(d._id));
}

/** Whether `user` may view/approve requests for the given department id. */
async function isApproverForDepartment(user, departmentId) {
  if (!departmentId) return false;
  if (user.role === 'admin') return true;
  const deptIds = await approverDepartmentIds(user);
  return deptIds !== null && deptIds.includes(String(departmentId));
}

module.exports = { approverDepartmentIds, isApproverForDepartment };
