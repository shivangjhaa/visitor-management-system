const mongoose = require('mongoose');

const divisionMasterSchema = new mongoose.Schema(
  {
    divisionName: { type: String, required: [true, 'Division name is required'], trim: true, unique: true },
    divisionCode: { type: String, trim: true, uppercase: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DivisionMaster', divisionMasterSchema);
