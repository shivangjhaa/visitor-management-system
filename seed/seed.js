/**
 * One-off bootstrap script: creates demo login accounts and a handful of
 * sample master records so the app is usable immediately after setup.
 * Safe to re-run — it skips anything that already exists.
 *
 * Usage: npm run seed
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const PlantMaster = require('../models/PlantMaster');
const DivisionMaster = require('../models/DivisionMaster');
const DepartmentMaster = require('../models/DepartmentMaster');
const LocationMaster = require('../models/LocationMaster');
const VisitorCategory = require('../models/VisitorCategory');
const CardMaster = require('../models/CardMaster');

const run = async () => {
  await connectDB();

  const plant = (await PlantMaster.findOne({ plantName: 'Main Plant' })) ||
    (await PlantMaster.create({ plantName: 'Main Plant', plantCode: 'MAIN', address: 'Silvassa' }));

  const division = (await DivisionMaster.findOne({ divisionName: 'Main Plant' })) ||
    (await DivisionMaster.create({ divisionName: 'Main Plant' }));

  const dept = (await DepartmentMaster.findOne({ departmentName: 'Human Resources' })) ||
    (await DepartmentMaster.create({ departmentName: 'Human Resources', departmentCode: 'HR', plant: plant._id }));

  const location = (await LocationMaster.findOne({ locationName: 'Silvassa' })) ||
    (await LocationMaster.create({ locationName: 'Silvassa' }));

  // Four login roles exist: admin (everything), user (Request for
  // Visitor), security (Visitor Entry / Out Pending List), and hod (user
  // rights + HOD Approval for whichever department lists them as HOD).
  const adminEmail = 'admin@alokind.com';
  if (!(await User.findOne({ email: adminEmail }))) {
    await User.create({
      empId: 'ADMIN001',
      name: 'System Admin',
      email: adminEmail,
      password: 'Admin@123',
      role: 'admin',
      mobile: '9000000001',
      division: division._id,
      department: dept._id,
      location: location._id,
    });
    console.log(`✅ Admin user created: ${adminEmail} / Admin@123 (change this password immediately)`);
  } else {
    console.log('ℹ️  Admin user already exists, skipping');
  }

  const userEmail = 'user@alokind.com';
  if (!(await User.findOne({ email: userEmail }))) {
    await User.create({
      empId: 'USER001',
      name: 'Demo User',
      email: userEmail,
      password: 'User@123',
      role: 'user',
      mobile: '9000000002',
      division: division._id,
      department: dept._id,
      location: location._id,
    });
    console.log(`✅ Demo user created: ${userEmail} / User@123`);
  }

  const securityEmail = 'security@alokind.com';
  if (!(await User.findOne({ email: securityEmail }))) {
    await User.create({
      empId: 'SEC001',
      name: 'Gate Security',
      email: securityEmail,
      password: 'Security@123',
      role: 'security',
      mobile: '9000000003',
      division: division._id,
      department: dept._id,
      location: location._id,
    });
    console.log(`✅ Security user created: ${securityEmail} / Security@123`);
  }

  // HOD for Human Resources — approves/rejects HOD Approval requests raised
  // against this department.
  const hodEmail = 'hod@alokind.com';
  let hodUser = await User.findOne({ email: hodEmail });
  if (!hodUser) {
    hodUser = await User.create({
      empId: 'HOD001',
      name: 'Mathew Oommen Thomas',
      email: hodEmail,
      password: 'Hod@123',
      role: 'hod',
      mobile: '9000000004',
      division: division._id,
      department: dept._id,
      location: location._id,
    });
    console.log(`✅ HOD user created: ${hodEmail} / Hod@123`);
  }

  // Backup approver for HR — an existing user who can stand in for the HOD
  // on HOD Approval requests. Set via Master > Delegate Updation in the UI;
  // wired directly here so the demo data is immediately useful.
  const delegateEmail = 'delegate@alokind.com';
  let delegateUser = await User.findOne({ email: delegateEmail });
  if (!delegateUser) {
    delegateUser = await User.create({
      empId: 'USER002',
      name: 'Priya Nair',
      email: delegateEmail,
      password: 'Delegate@123',
      role: 'user',
      mobile: '9000000005',
      division: division._id,
      department: dept._id,
      location: location._id,
    });
    console.log(`✅ Delegate user created: ${delegateEmail} / Delegate@123`);
  }

  if (dept.hodEmpCode !== hodUser.empId || dept.delegationEmpCode !== delegateUser.empId) {
    dept.hodEmpCode = hodUser.empId;
    dept.hodName = hodUser.name;
    dept.delegationEmpCode = delegateUser.empId;
    dept.delegationName = delegateUser.name;
    await dept.save();
    console.log(`✅ Human Resources department linked to HOD (${hodUser.name}) and Delegate (${delegateUser.name})`);
  }

  await VisitorCategory.updateOne({ categoryName: 'Vendor' }, { $setOnInsert: { categoryName: 'Vendor' } }, { upsert: true });
  await VisitorCategory.updateOne({ categoryName: 'Customer' }, { $setOnInsert: { categoryName: 'Customer' } }, { upsert: true });

  for (let i = 1; i <= 5; i += 1) {
    const cardNumber = `CARD00${i}`;
    // eslint-disable-next-line no-await-in-loop
    await CardMaster.updateOne({ cardNumber }, { $setOnInsert: { cardNumber } }, { upsert: true });
  }

  console.log('✅ Seed complete.');
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
