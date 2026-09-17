const Visitor = require('../models/Visitor');

/**
 * Generates a unique, human-readable inward number of the form:
 *   INW-20260704-0007
 * (prefix - date the appointment was created - a zero-padded daily sequence).
 * The daily sequence resets each day and is derived from how many visitor
 * records were already created "today", so gate staff can eyeball rough
 * daily volume straight from the token.
 */
const generateInwardNumber = async () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const countToday = await Visitor.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  let sequence = countToday + 1;
  let inwardNumber;
  let exists = true;

  // Guard against the rare race condition where two requests land in the
  // same millisecond and compute the same sequence number.
  while (exists) {
    inwardNumber = `INW-${datePart}-${String(sequence).padStart(4, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    exists = await Visitor.exists({ inwardNumber });
    sequence += 1;
  }

  return inwardNumber;
};

module.exports = generateInwardNumber;
