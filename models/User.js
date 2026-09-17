const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * System login accounts — created by an admin via Master > User Master.
 * These are the employees who are granted access to the VMS itself
 * (as distinct from Visitors, who never log in). Field set intentionally
 * mirrors the legacy User Master screen: Emp Id, Name, Division, Department,
 * Location, User Role, Mobile, Email, Password, Active.
 */
const userSchema = new mongoose.Schema(
  {
    empId: { type: String, trim: true, default: '' },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email'],
    },
    mobile: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, 'Mobile number must be 10 digits'],
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned by default queries
    },
    // Four login roles exist: admin (everything), user (Request for
    // Visitor), security (Visitor Entry / Out Pending List), and hod (same
    // access as user, PLUS HOD Approval for whichever department(s) list
    // them as HOD or as an active Delegate on Department Master).
    role: {
      type: String,
      enum: ['admin', 'user', 'security', 'hod'],
      default: 'user',
    },
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'DivisionMaster', default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentMaster', default: null },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationMaster', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
