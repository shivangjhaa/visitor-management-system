const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
  toggleUser,
  resetPassword,
  removeUser,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, authorize('admin'));

router.route('/').get(listUsers).post(createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle', toggleUser);
router.patch('/:id/reset-password', resetPassword);
router.delete('/:id', removeUser);

module.exports = router;
