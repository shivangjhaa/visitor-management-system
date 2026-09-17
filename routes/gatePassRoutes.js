const express = require('express');
const { generateGatePass, downloadGatePass, listGatePasses } = require('../controllers/gatePassController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Visitor Receipt report (Report > Visitor Receipt) — admin only.
router.get('/', protect, authorize('admin'), listGatePasses);
router.post('/generate/:inwardNumber', protect, authorize('security', 'admin'), generateGatePass);
// Download is opened directly in a new browser tab with ?token=..., so auth
// is verified inside `protect` via the query param fallback.
router.get('/download/:gatePassNumber', protect, downloadGatePass);

module.exports = router;
