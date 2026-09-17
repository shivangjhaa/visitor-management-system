const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Visitor = require('../models/Visitor');
const DepartmentMaster = require('../models/DepartmentMaster');
const User = require('../models/User');
const { isApproverForDepartment, approverDepartmentIds } = require('../utils/approverAccess');
const generateInwardNumber = require('../utils/generateInwardNumber');
const { sendHodApprovalRequestEmail } = require('../services/emailService');

const populateVisitor = (query) => {
  Visitor.POPULATE_FIELDS.forEach((p) => query.populate(p));
  return query;
};

// @desc    Create a visitor appointment. Generates the inward number and
//          routes it to the department's HOD (+ their delegate, if any) for
//          approval — the visitor is NOT emailed at this point.
// @route   POST /api/visitors
// @access  Private (admin, user, hod)
const createVisitor = asyncHandler(async (req, res) => {
  const inwardNumber = await generateInwardNumber();

  const visitor = await Visitor.create({
    ...req.body,
    inwardNumber,
    status: 'PendingApproval',
    createdBy: req.user._id,
  });

  const populated = await populateVisitor(Visitor.findById(visitor._id));

  // Notify the department's HOD, plus their delegate (if one is
  // registered) so someone is always reachable even if the HOD is away.
  // HOD/Delegation on Department Master are plain Employee Codes — match
  // them against User Master's Emp Id to find who to email.
  const department = await DepartmentMaster.findById(visitor.department);
  const empCodes = [department?.hodEmpCode, department?.delegationEmpCode].filter(Boolean);
  const approvers = empCodes.length ? await User.find({ empId: { $in: empCodes } }).select('email') : [];
  const toEmails = approvers.map((u) => u.email).filter(Boolean);

  // Fire-and-forget: appointment creation should not fail if mail delivery fails.
  sendHodApprovalRequestEmail(populated, toEmails);

  res.status(201).json({
    success: true,
    message: `Inward number ${inwardNumber} generated — sent for HOD approval`,
    visitor: populated,
  });
});

// @desc    List visitor appointments with search/status filters.
//          Users only see appointments they created; admins see all;
//          security uses the dedicated /api/security endpoints instead.
// @route   GET /api/visitors
// @access  Private
const listVisitors = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const filter = {};

  if (['user', 'hod'].includes(req.user.role)) {
    filter.createdBy = req.user._id;
  }
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { visitorName: new RegExp(search, 'i') },
      { mobile: new RegExp(search, 'i') },
      { inwardNumber: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
  }

  const visitors = await populateVisitor(Visitor.find(filter).sort({ createdAt: -1 }));
  res.json({ success: true, count: visitors.length, visitors });
});

// @desc    Get a single visitor appointment by Mongo _id.
// @route   GET /api/visitors/:id
// @access  Private
const getVisitor = asyncHandler(async (req, res) => {
  const visitor = await populateVisitor(Visitor.findById(req.params.id));
  if (!visitor) throw new ApiError(404, 'Visitor appointment not found');

  if (req.user.role === 'admin') {
    return res.json({ success: true, visitor });
  }

  const isCreator = String(visitor.createdBy?._id || visitor.createdBy) === String(req.user._id);
  if (isCreator) {
    return res.json({ success: true, visitor });
  }

  // Not the creator — a HOD (or their delegate) still needs to open
  // requests raised by other people, since that's the entire point of
  // reviewing them from Transaction > HOD Approval. Allow it when the
  // request belongs to a department they cover.
  if (req.user.role === 'hod') {
    const departmentId = visitor.department?._id || visitor.department;
    if (await isApproverForDepartment(req.user, departmentId)) {
      return res.json({ success: true, visitor });
    }
  }

  throw new ApiError(403, 'You do not have access to this appointment');
});

// @desc    Cancel a request that hasn't been checked in yet (either while
//          still awaiting HOD approval, or after approval but before entry).
// @route   PUT /api/visitors/:id/cancel
// @access  Private
const cancelVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) throw new ApiError(404, 'Visitor appointment not found');

  if (['user', 'hod'].includes(req.user.role) && String(visitor.createdBy) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this appointment');
  }
  if (!['PendingApproval', 'Pending'].includes(visitor.status)) {
    throw new ApiError(400, `Cannot cancel an appointment that is already ${visitor.status}`);
  }

  visitor.status = 'Cancelled';
  await visitor.save();

  res.json({ success: true, message: 'Appointment cancelled', visitor });
});

// @desc    Dashboard summary counts for the Home page.
// @route   GET /api/visitors/stats/summary
// @access  Private
const getStatsSummary = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // A plain 'user' only cares about appointments they personally raised.
  // A 'hod' is reviewing/hosting for their department(s), so their
  // dashboard should reflect that department's visitor activity instead —
  // scoping it by createdBy (like a 'user') left it empty, since a HOD
  // rarely raises requests themselves.
  let scopeFilter = {};
  if (req.user.role === 'user') {
    scopeFilter = { createdBy: req.user._id };
  } else if (req.user.role === 'hod') {
    const deptIds = await approverDepartmentIds(req.user);
    scopeFilter = { department: { $in: deptIds || [] } };
  }

  const [total, totalLeaves, totalInsidePremises, today, todayLeave, todayInsidePremises] = await Promise.all([
    Visitor.countDocuments({ ...scopeFilter }),
    Visitor.countDocuments({ ...scopeFilter, status: 'CheckedOut' }),
    Visitor.countDocuments({ ...scopeFilter, status: 'CheckedIn' }),
    Visitor.countDocuments({ ...scopeFilter, appointmentDate: { $gte: startOfDay, $lte: endOfDay } }),
    Visitor.countDocuments({ ...scopeFilter, exitTime: { $gte: startOfDay, $lte: endOfDay } }),
    Visitor.countDocuments({ ...scopeFilter, status: 'CheckedIn', entryTime: { $gte: startOfDay, $lte: endOfDay } }),
  ]);

  res.json({
    success: true,
    stats: { total, totalLeaves, totalInsidePremises, today, todayLeave, todayInsidePremises },
  });
});

module.exports = { createVisitor, listVisitors, getVisitor, cancelVisitor, getStatsSummary };
