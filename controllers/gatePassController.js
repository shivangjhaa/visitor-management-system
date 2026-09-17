const path = require('path');
const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Visitor = require('../models/Visitor');
const GatePass = require('../models/GatePass');
const { generateGatePassPDF } = require('../services/pdfService');

const OUTPUT_DIR = path.join(__dirname, '..', 'storage', 'gatepasses');

// @desc    Generate (or re-fetch, if already generated) the gate pass PDF
//          for a checked-in visitor.
// @route   POST /api/gatepass/generate/:inwardNumber
// @access  Private (security, admin)
const generateGatePass = asyncHandler(async (req, res) => {
  const inwardNumber = req.params.inwardNumber.trim().toUpperCase();
  let visitor = await Visitor.findOne({ inwardNumber });
  if (!visitor) throw new ApiError(404, `No appointment found for inward number "${inwardNumber}"`);
  if (!['CheckedIn', 'CheckedOut'].includes(visitor.status)) {
    throw new ApiError(400, 'A gate pass can only be generated after the visitor has been checked in');
  }

  visitor = await Visitor.findById(visitor._id).populate(Visitor.POPULATE_FIELDS);

  let gatePass = await GatePass.findOne({ visitor: visitor._id });

  if (!gatePass) {
    const gatePassNumber = `GP-${visitor.inwardNumber.replace('INW-', '')}`;
    const filePath = await generateGatePassPDF({ visitor, gatePassNumber, outputDir: OUTPUT_DIR });
    gatePass = await GatePass.create({
      gatePassNumber,
      visitor: visitor._id,
      filePath,
      generatedBy: req.user._id,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Gate pass generated',
    gatePass: {
      gatePassNumber: gatePass.gatePassNumber,
      downloadUrl: `/api/gatepass/download/${gatePass.gatePassNumber}`,
    },
  });
});

// @desc    Download the previously generated gate pass PDF.
// @route   GET /api/gatepass/download/:gatePassNumber
// @access  Private (any authenticated user — link is shared via ?token=)
const downloadGatePass = asyncHandler(async (req, res) => {
  const gatePass = await GatePass.findOne({ gatePassNumber: req.params.gatePassNumber });
  if (!gatePass) throw new ApiError(404, 'Gate pass not found');
  if (!fs.existsSync(gatePass.filePath)) throw new ApiError(404, 'Gate pass file is missing on the server');

  res.download(gatePass.filePath, `${gatePass.gatePassNumber}.pdf`);
});

// @desc    List every gate pass/receipt issued, for the "Visitor Receipt"
//          report screen (search by visitor name, mobile or inward number).
// @route   GET /api/gatepass
// @access  Private (admin)
const listGatePasses = asyncHandler(async (req, res) => {
  const { search } = req.query;

  let gatePasses = await GatePass.find()
    .sort({ createdAt: -1 })
    .populate({ path: 'visitor', select: 'inwardNumber visitorName mobile visitorCategory personToMeet', populate: [{ path: 'visitorCategory', select: 'categoryName' }] })
    .populate({ path: 'generatedBy', select: 'name' });

  if (search) {
    const re = new RegExp(search, 'i');
    gatePasses = gatePasses.filter(
      (g) => re.test(g.gatePassNumber) || re.test(g.visitor?.visitorName || '') || re.test(g.visitor?.mobile || '') || re.test(g.visitor?.inwardNumber || '')
    );
  }

  res.json({ success: true, count: gatePasses.length, gatePasses });
});

module.exports = { generateGatePass, downloadGatePass, listGatePasses };
