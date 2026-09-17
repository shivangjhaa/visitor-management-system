const mongoose = require('mongoose');

const gatePassSchema = new mongoose.Schema(
  {
    gatePassNumber: { type: String, required: true, unique: true, index: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    filePath: { type: String, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GatePass', gatePassSchema);
