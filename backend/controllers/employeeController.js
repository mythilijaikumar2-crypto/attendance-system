const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Department = require('../models/Department');

// GET /api/employees/ (admin only)
const listEmployees = async (req, res) => {
  try {
    // Only return active employees by default
    const employees = await Employee.find({ isActive: true }).select('-password').limit(100).lean();
    return res.json(employees);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/employees/:id
const getEmployee = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).select('-password');
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    return res.json(emp);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/employees/ (admin create)
const createEmployee = async (req, res) => {
  try {
    const { empId, firstName, lastName, email, password, role, department } = req.body;
    if (!empId || !password) return res.status(400).json({ message: 'empId and password required' });

    const existing = await Employee.findOne({ empId });
    if (existing) return res.status(409).json({ message: 'empId already exists' });

    let deptId = null;
    if (department) {
      // Find or create department
      let dept = await Department.findOne({ name: { $regex: new RegExp(`^${department}$`, 'i') } });
      if (!dept) {
        dept = await new Department({ name: department }).save();
      }
      deptId = dept._id;
    }

    const hashed = await bcrypt.hash(password, 10);
    const empData = {
      empId,
      firstName,
      lastName,
      email,
      password: hashed,
      role: role || 'employee'
    };
    if (deptId) empData.department = deptId;

    const emp = new Employee(empData);
    await emp.save();

    // Populate department for return
    await emp.populate('department');

    const result = emp.toObject();
    delete result.password;
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    const updated = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ message: 'Employee not found' });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/employees/:id - Soft Delete to preserve history
const deleteEmployee = async (req, res) => {
  try {
    // Soft delete: set isActive to false instead of removing document
    const updated = await Employee.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Employee not found' });
    return res.json({ message: 'Employee deactivated (Soft Delete)' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
