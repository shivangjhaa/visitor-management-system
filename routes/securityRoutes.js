const express = require('express');
const { verifyByInward, checkIn, checkOut, listOnsite } = require('../controllers/securityController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(protect, authorize('security', 'admin'));

router.get('/onsite', listOnsite);
router.get('/verify/:inwardNumber', verifyByInward);
router.put('/checkin/:inwardNumber', upload.single('photo'), checkIn);
router.put('/checkout/:inwardNumber', checkOut);

module.exports = router;
