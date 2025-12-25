const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: no token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Unauthorized: user not found' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// role check: pass 'admin' or 'employee' etc.
const authorizeRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden: insufficient role' });
  next();
};

module.exports = { authMiddleware, authorizeRole };
