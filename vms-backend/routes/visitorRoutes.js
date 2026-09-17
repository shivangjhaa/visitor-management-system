const express = require('express');
const {
  createVisitor,
  listVisitors,
  getVisitor,
  cancelVisitor,
  getStatsSummary,
} = require('../controllers/visitorController');
const { listApprovals, approveVisitor, rejectVisitor } = require('../controllers/hodController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

// Placed before '/:id' so they aren't swallowed by the param route.
router.get('/stats/summary', getStatsSummary);
router.get('/approvals', authorize('admin', 'hod'), listApprovals);

router.route('/')
  .get(listVisitors)
  .post(authorize('admin', 'user', 'hod'), createVisitor);

router.get('/:id', getVisitor);
router.put('/:id/cancel', cancelVisitor);
router.put('/:id/approve', authorize('admin', 'hod'), approveVisitor);
router.put('/:id/reject', authorize('admin', 'hod'), rejectVisitor);

module.exports = router;
