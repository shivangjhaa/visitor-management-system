const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const generateToken = require('../utils/generateToken');
const User = require('../models/User');

// @desc    Create a login account for an employee (admin only — this is the
//          same action as Master > User Master > Add New; kept as a
//          dedicated auth endpoint too since it also issues no token here,
//          the created user logs in separately via /login).
// @route   POST /api/auth/register
// @access  Private (admin)
const register = asyncHandler(async (req, res) => {
  const { empId, name, email, password, role, mobile, division, department, location } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are required');
  }

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'A user with this email already exists');

  const user = await User.create({
    empId,
    name,
    email,
    password,
    role: role || 'user', // Mongoose validates this against User.role's enum
    mobile,
    division: division || null,
    department: department || null,
    location: location || null,
  });

  res.status(201).json({
    success: true,
    message: 'User account created successfully',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// @desc    Login and receive JWT
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid credentials');

  const token = generateToken({ id: user._id, role: user.role });

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile,
      department: user.department,
    },
  });
});

// @desc    Get currently authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @desc    Change the logged-in user's own password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }
  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { register, login, getMe, changePassword };
