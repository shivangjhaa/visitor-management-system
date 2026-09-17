const express = require('express');
const buildMasterController = require('../controllers/masterController');
const { protect, authorize } = require('../middleware/authMiddleware');

const VisitorCategory = require('../models/VisitorCategory');
const CardMaster = require('../models/CardMaster');
const PlantMaster = require('../models/PlantMaster');
const DepartmentMaster = require('../models/DepartmentMaster');
const DivisionMaster = require('../models/DivisionMaster');
const LocationMaster = require('../models/LocationMaster');

const router = express.Router();
router.use(protect);

/**
 * Mounts a full CRUD sub-router for one master entity at /api/master/<path>.
 * GET (list) is available to any authenticated user, since employee/security
 * screens need these lists to populate dropdowns. Create/update/delete/
 * toggle are admin-only.
 */
const mountMaster = (path, Model, config) => {
  const ctrl = buildMasterController(Model, config);
  const sub = express.Router();
  sub.get('/', ctrl.list);
  sub.post('/', authorize('admin'), ctrl.create);
  sub.put('/:id', authorize('admin'), ctrl.update);
  sub.patch('/:id/toggle', authorize('admin'), ctrl.toggleActive);
  sub.delete('/:id', authorize('admin'), ctrl.remove);
  router.use(path, sub);
};

mountMaster('/visitor-categories', VisitorCategory, {
  searchFields: ['categoryName', 'description'],
  entityLabel: 'Visitor category',
});

mountMaster('/cards', CardMaster, {
  searchFields: ['cardNumber'],
  entityLabel: 'Card',
});

mountMaster('/plants', PlantMaster, {
  searchFields: ['plantName', 'plantCode', 'address'],
  entityLabel: 'Plant',
});

mountMaster('/departments', DepartmentMaster, {
  searchFields: ['departmentName', 'departmentCode', 'hodEmpCode', 'hodName', 'delegationEmpCode', 'delegationName'],
  populate: ['plant'],
  entityLabel: 'Department',
});

mountMaster('/divisions', DivisionMaster, {
  searchFields: ['divisionName', 'divisionCode'],
  entityLabel: 'Division',
});

mountMaster('/locations', LocationMaster, {
  searchFields: ['locationName', 'locationCode', 'address'],
  entityLabel: 'Location',
});

module.exports = router;
