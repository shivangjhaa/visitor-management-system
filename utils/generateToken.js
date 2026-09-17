const jwt = require('jsonwebtoken');

/**
 * Signs a JWT for the given payload (typically { id, role }).
 * Expiry is controlled by JWT_EXPIRES_IN (defaults to 8h — a normal shift).
 */
const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

module.exports = generateToken;
