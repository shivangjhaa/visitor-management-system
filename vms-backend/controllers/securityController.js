const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Visitor = require('../models/Visitor');
const CardMaster = require('../models/CardMaster');

const populateVisitor = (query) => {
  Visitor.POPULATE_FIELDS.forEach((p) => query.populate(p));
  return query;
};

// @desc    Look up an appointment by inward number at the gate.
// @route   GET /api/security/verify/:inwardNumber
// @access  Private (security, admin)
const verifyByInward = asyncHandler(async (req, res) => {
  const visitor = await populateVisitor(Visitor.findOne({ inwardNumber: req.params.inwardNumber.trim().toUpperCase() }));
  if (!visitor) throw new ApiError(404, `No appointment found for inward number "${req.params.inwardNumber}"`);

  // A request that hasn't cleared HOD approval (or was rejected) is not
  // yet a valid appointment as far as the gate is concerned — it should
  // look exactly like an inward number that was never generated.
  if (['PendingApproval', 'Rejected'].includes(visitor.status)) {
    throw new ApiError(404, `No appointment found for inward number "${req.params.inwardNumber}"`);
  }
  if (visitor.status === 'Cancelled') throw new ApiError(400, 'This appointment was cancelled and is no longer valid');

  res.json({ success: true, visitor });
});

// @desc    Capture arrival details (vehicle, ID proof, photo, card) and
//          check the visitor in.
// @route   PUT /api/security/checkin/:inwardNumber
// @access  Private (security, admin)
const checkIn = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findOne({ inwardNumber: req.params.inwardNumber.trim().toUpperCase() });
  if (!visitor) throw new ApiError(404, `No appointment found for inward number "${req.params.inwardNumber}"`);
  if (!['Pending', 'Verified'].includes(visitor.status)) {
    throw new ApiError(400, `Cannot check in an appointment that is already ${visitor.status}`);
  }

  const { vehicleType, vehicleNumber, materialCarried, idProofType, idProofNumber, securityRemarks, cardNumber } = req.body;

  if (vehicleType) visitor.vehicleType = vehicleType;
  if (vehicleNumber !== undefined) visitor.vehicleNumber = vehicleNumber;
  if (materialCarried !== undefined) visitor.materialCarried = materialCarried;
  if (idProofType) visitor.idProofType = idProofType;
  if (idProofNumber !== undefined) visitor.idProofNumber = idProofNumber;
  if (securityRemarks !== undefined) visitor.securityRemarks = securityRemarks;
  if (req.file) visitor.photoUrl = req.file.path;

  if (cardNumber) {
    const card = await CardMaster.findOne({ cardNumber: cardNumber.trim().toUpperCase() });
    if (!card) throw new ApiError(404, `Card "${cardNumber}" not found`);
    if (!card.isActive) throw new ApiError(400, `Card "${cardNumber}" is inactive`);
    if (card.status !== 'Available') throw new ApiError(400, `Card "${cardNumber}" is not available (status: ${card.status})`);

    card.status = 'Issued';
    await card.save();
    visitor.assignedCard = card._id;
  }

  visitor.entryTime = new Date();
  visitor.status = 'CheckedIn';
  visitor.verifiedBy = req.user._id;
  await visitor.save();

  const populated = await populateVisitor(Visitor.findById(visitor._id));
  res.json({ success: true, message: 'Visitor checked in', visitor: populated });
});

// @desc    Record exit time and release the assigned card, if any.
// @route   PUT /api/security/checkout/:inwardNumber
// @access  Private (security, admin)
const checkOut = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findOne({ inwardNumber: req.params.inwardNumber.trim().toUpperCase() });
  if (!visitor) throw new ApiError(404, `No appointment found for inward number "${req.params.inwardNumber}"`);
  if (visitor.status !== 'CheckedIn') {
    throw new ApiError(400, `Cannot check out an appointment that is not currently checked in (status: ${visitor.status})`);
  }

  visitor.exitTime = new Date();
  visitor.status = 'CheckedOut';

  if (visitor.assignedCard) {
    await CardMaster.findByIdAndUpdate(visitor.assignedCard, { status: 'Available' });
  }

  await visitor.save();

  const populated = await populateVisitor(Visitor.findById(visitor._id));
  res.json({ success: true, message: 'Exit recorded', visitor: populated });
});

// @desc    List everyone currently checked in (onsite board at the checkpoint).
// @route   GET /api/security/onsite
// @access  Private (security, admin)
const listOnsite = asyncHandler(async (req, res) => {
  const visitors = await populateVisitor(Visitor.find({ status: 'CheckedIn' }).sort({ entryTime: -1 }));

  // Frontend onsite table reads `personToMeet` directly (see security.js).
  const shaped = visitors.map((v) => ({
    ...v.toJSON(),
    personToMeet: v.personToMeet || '—',
  }));

  res.json({ success: true, count: shaped.length, visitors: shaped });
});

module.exports = { verifyByInward, checkIn, checkOut, listOnsite };
