const mongoose = require('mongoose');

/**
 * Mirrors the original Alok Industries VMS Department Master screen:
 * Department, HOD Employee Code, HOD Name, Delegation Employee Code,
 * Delegation Name, Active. HOD/Delegation are plain text (matched against
 * a User's Emp Id to work out who can act on HOD Approval for this
 * department — see hodController.js / delegateController.js).
 */
const departmentMasterSchema = new mongoose.Schema(
  {
    departmentName: { type: String, required: [true, 'Department name is required'], trim: true, unique: true },
    departmentCode: { type: String, trim: true, uppercase: true, default: '' },
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'PlantMaster', default: null },
    hodEmpCode: { type: String, trim: true, default: '' },
    hodName: { type: String, trim: true, default: '' },
    delegationEmpCode: { type: String, trim: true, default: '' },
    delegationName: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DepartmentMaster', departmentMasterSchema);
