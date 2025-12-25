const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

// GET /api/employees/ (admin only)
const listEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().select('-password').limit(100).lean();
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
    const { empId, firstName, lastName, email, password, role } = req.body;
    if (!empId || !password) return res.status(400).json({ message: 'empId and password required' });

    const existing = await Employee.findOne({ empId });
    if (existing) return res.status(409).json({ message: 'empId already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const emp = new Employee({ empId, firstName, lastName, email, password: hashed, role: role || 'employee' });
    await emp.save();
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

// DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
  try {
    const removed = await Employee.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Employee not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
