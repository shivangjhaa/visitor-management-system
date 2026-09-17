const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * Builds a standard set of CRUD handlers for a "simple" master-data model
 * (Plant, Department, Division, Location, Visitor Category, Delegate, Card).
 * Every one of these entities follows the same shape — a handful of fields,
 * an isActive flag, and optionally a populate() reference to another master —
 * so a single factory avoids duplicating the same list/create/update/delete
 * logic seven times.
 *
 * @param {mongoose.Model} Model
 * @param {Object} options
 * @param {string[]} options.searchFields - fields matched by the free-text ?search= query
 * @param {string|string[]} [options.populate] - ref field(s) to populate on read
 * @param {string} options.entityLabel - human-readable name used in messages
 */
const buildMasterController = (Model, { searchFields = [], populate = [], entityLabel = 'Record' }) => {
  const list = asyncHandler(async (req, res) => {
    const { search, isActive } = req.query;
    const filter = {};
    if (isActive === 'true' || isActive === 'false') filter.isActive = isActive === 'true';
    if (search && searchFields.length) {
      filter.$or = searchFields.map((f) => ({ [f]: new RegExp(search, 'i') }));
    }

    let query = Model.find(filter).sort({ createdAt: -1 });
    [].concat(populate).forEach((p) => {
      if (p) query = query.populate(p);
    });

    const items = await query;
    res.json({ success: true, count: items.length, items });
  });

  const create = asyncHandler(async (req, res) => {
    const item = await Model.create(req.body);
    res.status(201).json({ success: true, message: `${entityLabel} created successfully`, item });
  });

  const update = asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) throw new ApiError(404, `${entityLabel} not found`);
    res.json({ success: true, message: `${entityLabel} updated successfully`, item });
  });

  const toggleActive = asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw new ApiError(404, `${entityLabel} not found`);
    item.isActive = !item.isActive;
    await item.save();
    res.json({ success: true, message: `${entityLabel} ${item.isActive ? 'activated' : 'deactivated'}`, item });
  });

  const remove = asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) throw new ApiError(404, `${entityLabel} not found`);
    res.json({ success: true, message: `${entityLabel} deleted successfully` });
  });

  return { list, create, update, toggleActive, remove };
};

module.exports = buildMasterController;
