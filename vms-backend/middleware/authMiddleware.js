const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

/**
 * Verifies the JWT and attaches the authenticated user to req.user.
 * Accepts the token either as a standard `Authorization: Bearer <token>`
 * header (used by the api() fetch wrapper) or as a `?token=` query param
 * (used by the gate-pass PDF download link, which is opened directly in a
 * new tab and can't set custom headers).
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Not authorized, user no longer exists or is inactive');
  }

  req.user = user;
  next();
});

/** Restricts a route to one or more roles, e.g. authorize('admin'). */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, `Role '${req.user?.role || 'unknown'}' is not permitted to perform this action`));
  }
  next();
};

module.exports = { protect, authorize };
