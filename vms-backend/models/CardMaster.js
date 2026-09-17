const mongoose = require('mongoose');

const cardMasterSchema = new mongoose.Schema(
  {
    cardNumber: { type: String, required: [true, 'Card number is required'], trim: true, uppercase: true, unique: true },
    cardType: { type: String, enum: ['RFID', 'Manual', 'Barcode'], default: 'RFID' },
    status: { type: String, enum: ['Available', 'Issued', 'Lost', 'Damaged'], default: 'Available' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CardMaster', cardMasterSchema);
