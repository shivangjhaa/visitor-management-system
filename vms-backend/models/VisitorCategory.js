const mongoose = require('mongoose');

const visitorCategorySchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: [true, 'Category name is required'], trim: true, unique: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VisitorCategory', visitorCategorySchema);
