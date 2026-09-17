/**
 * Wraps an async Express route/middleware function so any rejected promise
 * is forwarded to next(err) instead of crashing the process or requiring a
 * try/catch block in every single controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
