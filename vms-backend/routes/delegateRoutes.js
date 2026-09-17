const express = require('express');
const { listMyDepartments, listCandidates, setDelegate } = require('../controllers/delegateController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, authorize('admin', 'hod'));

router.get('/', listMyDepartments);
router.get('/:departmentId/candidates', listCandidates);
router.put('/:departmentId', setDelegate);

module.exports = router;
