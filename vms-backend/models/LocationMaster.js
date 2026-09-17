const mongoose = require('mongoose');

const locationMasterSchema = new mongoose.Schema(
  {
    locationName: { type: String, required: [true, 'Location name is required'], trim: true, unique: true },
    locationCode: { type: String, trim: true, uppercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LocationMaster', locationMasterSchema);
