const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Visitor = require('../models/Visitor');
const { approverDepartmentIds, isApproverForDepartment } = require('../utils/approverAccess');
const { sendAppointmentEmail, sendRejectionEmail } = require('../services/emailService');

const populateVisitor = (query) => {
  Visitor.POPULATE_FIELDS.forEach((p) => query.populate(p));
  return query;
};

// @desc    List every visitor request currently awaiting HOD approval
//          (Transaction > HOD Approval). Admin sees everything; a HOD (or
//          their delegate) only sees requests for department(s) they cover.
// @route   GET /api/visitors/approvals
// @access  Private (admin, hod)
const listApprovals = asyncHandler(async (req, res) => {
  const deptIds = await approverDepartmentIds(req.user);
  const filter = { status: 'PendingApproval' };
  if (deptIds) filter.department = { $in: deptIds };

  const visitors = await populateVisitor(Visitor.find(filter).sort({ createdAt: 1 }));
  res.json({ success: true, count: visitors.length, visitors });
});

async function assertCanDecide(user, visitor) {
  if (!(await isApproverForDepartment(user, visitor.department))) {
    throw new ApiError(403, 'You are not the HOD or delegate for this department');
  }
}

// @desc    Approve a pending request — the visitor is emailed their
//          appointment confirmation + inward number for the first time.
// @route   PUT /api/visitors/:id/approve
// @access  Private (admin, hod — scoped to their own department)
const approveVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) throw new ApiError(404, 'Visitor request not found');
  if (visitor.status !== 'PendingApproval') {
    throw new ApiError(400, `This request is already ${visitor.status} and cannot be approved again`);
  }
  await assertCanDecide(req.user, visitor);

  visitor.status = 'Pending'; // approved, awaiting security check-in
  visitor.approvalRemark = (req.body.remark || '').trim();
  visitor.approvedBy = req.user._id;
  visitor.approvedAt = new Date();
  await visitor.save();

  const populated = await populateVisitor(Visitor.findById(visitor._id));
  sendAppointmentEmail(populated);

  res.json({ success: true, message: 'Request approved — the visitor has been emailed their inward number', visitor: populated });
});

// @desc    Reject a pending request — the *requester* (not the visitor) is
//          emailed the rejection notice along with the HOD's remark.
// @route   PUT /api/visitors/:id/reject
// @access  Private (admin, hod — scoped to their own department)
const rejectVisitor = asyncHandler(async (req, res) => {
  const remark = (req.body.remark || '').trim();
  if (!remark) throw new ApiError(400, 'A remark explaining the rejection is required');

  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) throw new ApiError(404, 'Visitor request not found');
  if (visitor.status !== 'PendingApproval') {
    throw new ApiError(400, `This request is already ${visitor.status} and cannot be rejected`);
  }
  await assertCanDecide(req.user, visitor);

  visitor.status = 'Rejected';
  visitor.approvalRemark = remark;
  visitor.approvedBy = req.user._id;
  visitor.approvedAt = new Date();
  await visitor.save();

  const populated = await populateVisitor(Visitor.findById(visitor._id));
  sendRejectionEmail(populated, populated.createdBy?.email);

  res.json({ success: true, message: 'Request rejected — the requester has been notified', visitor: populated });
});

module.exports = { listApprovals, approveVisitor, rejectVisitor };
