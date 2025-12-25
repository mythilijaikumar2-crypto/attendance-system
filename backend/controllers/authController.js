const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const signToken = (user) => {
  const payload = { id: user._id, empId: user.empId, role: user.role };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { empId, password } = req.body;
    if (!empId || !password) return res.status(400).json({ message: 'empId and password are required' });

    const user = await Employee.findOne({ empId });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({ token, user: { id: user._id, empId: user.empId, role: user.role, firstName: user.firstName, lastName: user.lastName } });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const user = await Employee.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { login, me };
