const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    // ---- Step 1: created via Request for Visitor by a user/admin ----
    inwardNumber: { type: String, required: true, unique: true, index: true },

    visitorName: { type: String, required: [true, 'Visitor name is required'], trim: true },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      match: [/^[0-9]{10}$/, 'Mobile number must be 10 digits'],
    },
    // Email is compulsory: the appointment confirmation + inward number is
    // sent directly to the visitor at this address once HOD-approved.
    email: {
      type: String,
      required: [true, 'Visitor email is required to send the appointment confirmation'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email'],
    },
    visitorCompany: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },

    visitorCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitorCategory', required: [true, 'Visitor category is required'] },
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlantMaster', default: null },
    // Department drives HOD approval routing — whoever is registered as
    // HOD (or an active Delegate) for this department reviews the request.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentMaster', required: [true, 'Department is required so the request can be routed for HOD approval'] },
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'DivisionMaster', default: null },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', default: null },
    // Free-text name of the employee the visitor is meeting — this is
    // intentionally NOT a master-data reference (any employee can be
    // visited; only Department HODs/Delegates are a curated master list).
    personToMeet: { type: String, required: [true, 'Person to meet is required'], trim: true },

    purpose: { type: String, required: [true, 'Purpose of visit is required'], trim: true },
    appointmentDate: { type: Date, required: [true, 'Appointment date is required'] },
    numberOfVisitors: { type: Number, default: 1, min: 1 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ---- Step 2-3: HOD approval (Transaction > HOD Approval) ----
    approvalRemark: { type: String, trim: true, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },

    // ---- Step 5-7: captured by security on arrival ----
    vehicleType: {
      type: String,
      enum: ['None', 'Two Wheeler', 'Four Wheeler', 'Truck', 'Container', 'Other'],
      default: 'None',
    },
    vehicleNumber: { type: String, trim: true, default: '' },
    materialCarried: { type: String, trim: true, default: '' },
    idProofType: {
      type: String,
      enum: ['Aadhaar', 'PAN', 'Driving License', 'Voter ID', 'Passport', 'Company ID', 'Other'],
      default: 'Aadhaar',
    },
    idProofNumber: { type: String, trim: true, default: '' },
    photoUrl: { type: String, default: '' },
    securityRemarks: { type: String, trim: true, default: '' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedCard: { type: mongoose.Schema.Types.ObjectId, ref: 'CardMaster', default: null },

    // ---- Step 9-11: entry / exit ----
    entryTime: { type: Date, default: null },
    exitTime: { type: Date, default: null },

    // PendingApproval -> (Pending | Rejected) -> CheckedIn -> CheckedOut
    // Cancelled can happen from PendingApproval or Pending (requester withdraws).
    status: {
      type: String,
      enum: ['PendingApproval', 'Pending', 'Verified', 'CheckedIn', 'CheckedOut', 'Cancelled', 'Rejected'],
      default: 'PendingApproval',
    },
  },
  { timestamps: true }
);

visitorSchema.index({ appointmentDate: 1 });
visitorSchema.index({ status: 1 });
visitorSchema.index({ visitorName: 'text', mobile: 'text', visitorCompany: 'text' });

const POPULATE_FIELDS = [
  { path: 'visitorCategory', select: 'categoryName' },
  { path: 'plant', select: 'plantName plantCode' },
  { path: 'department', select: 'departmentName departmentCode hodEmpCode hodName delegationEmpCode delegationName' },
  { path: 'division', select: 'divisionName divisionCode' },
  { path: 'location', select: 'locationName locationCode' },
  { path: 'assignedCard', select: 'cardNumber cardType' },
  { path: 'createdBy', select: 'name email department' },
  { path: 'approvedBy', select: 'name email' },
];
visitorSchema.statics.POPULATE_FIELDS = POPULATE_FIELDS;

// Convenience virtual: how long the visitor stayed on-site
visitorSchema.virtual('durationMinutes').get(function durationMinutes() {
  if (!this.entryTime || !this.exitTime) return null;
  return Math.round((this.exitTime - this.entryTime) / 60000);
});

visitorSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Visitor', visitorSchema);
