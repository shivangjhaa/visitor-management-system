const mongoose = require('mongoose');

const plantMasterSchema = new mongoose.Schema(
  {
    plantName: { type: String, required: [true, 'Plant name is required'], trim: true, unique: true },
    plantCode: { type: String, trim: true, uppercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlantMaster', plantMasterSchema);
