/**
 * Lightweight custom error carrying an HTTP status code, so route handlers
 * can `throw new ApiError(404, 'Not found')` and the central errorHandler
 * middleware will turn it into a consistent JSON response.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
