const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const populate = (query) =>
  query
    .populate({ path: 'division', select: 'divisionName' })
    .populate({ path: 'department', select: 'departmentName' })
    .populate({ path: 'location', select: 'locationName' });

// @desc    List system user accounts (Master > User Master table).
// @route   GET /api/users
// @access  Private (admin)
const listUsers = asyncHandler(async (req, res) => {
  const { search, role, isActive } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive === 'true' || isActive === 'false') filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { mobile: new RegExp(search, 'i') },
      { empId: new RegExp(search, 'i') },
    ];
  }

  const items = await populate(User.find(filter).sort({ createdAt: -1 }));
  res.json({ success: true, count: items.length, items });
});

// @desc    Create a new user account. This is exactly what Master > User
//          Master's "Save" button calls — the admin fills the form and the
//          created person can immediately log in with this role.
// @route   POST /api/users
// @access  Private (admin)
const createUser = asyncHandler(async (req, res) => {
  const { empId, name, email, mobile, division, department, location, role, password, isActive } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are required');
  }

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) throw new ApiError(409, 'A user with this email already exists');

  const user = await User.create({
    empId,
    name,
    email,
    mobile,
    division: division || null,
    department: department || null,
    location: location || null,
    role: role || 'user', // Mongoose validates this against User.role's enum — invalid values throw a clear 400 instead of silently downgrading to 'user'
    password,
    isActive: isActive !== undefined ? isActive : true,
  });

  const item = await populate(User.findById(user._id));
  res.status(201).json({ success: true, message: 'User created successfully', item });
});

// @desc    Update a user's profile fields (not password — see resetPassword).
// @route   PUT /api/users/:id
// @access  Private (admin)
const updateUser = asyncHandler(async (req, res) => {
  const { empId, name, email, mobile, division, department, location, role, isActive } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  if (email && email.toLowerCase().trim() !== user.email) {
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) throw new ApiError(409, 'A user with this email already exists');
    user.email = email;
  }

  if (empId !== undefined) user.empId = empId;
  if (name !== undefined) user.name = name;
  if (mobile !== undefined) user.mobile = mobile;
  if (division !== undefined) user.division = division || null;
  if (department !== undefined) user.department = department || null;
  if (location !== undefined) user.location = location || null;
  if (role !== undefined) user.role = role; // Mongoose validates against the schema enum on save() below
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();
  const item = await populate(User.findById(user._id));
  res.json({ success: true, message: 'User updated successfully', item });
});

// @desc    Toggle a user's active status (deactivating blocks login immediately).
// @route   PATCH /api/users/:id/toggle
// @access  Private (admin)
const toggleUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  if (String(user._id) === String(req.user._id) && user.isActive) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  user.isActive = !user.isActive;
  await user.save();
  const item = await populate(User.findById(user._id));
  res.json({ success: true, message: `User ${item.isActive ? 'activated' : 'deactivated'}`, item });
});

// @desc    Admin sets a new password for a user (e.g. after they forget it).
// @route   PATCH /api/users/:id/reset-password
// @access  Private (admin)
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  user.password = password;
  await user.save();
  res.json({ success: true, message: 'Password reset successfully' });
});

// @desc    Delete a user account.
// @route   DELETE /api/users/:id
// @access  Private (admin)
const removeUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, message: 'User deleted successfully' });
});

module.exports = { listUsers, createUser, updateUser, toggleUser, resetPassword, removeUser };
