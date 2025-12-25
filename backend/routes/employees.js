const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController');

// admin only
router.get('/', authMiddleware, authorizeRole('admin'), listEmployees);
router.post('/', authMiddleware, authorizeRole('admin'), createEmployee);

// admin or the employee themselves
router.get('/:id', authMiddleware, getEmployee);
router.put('/:id', authMiddleware, updateEmployee);
router.delete('/:id', authMiddleware, authorizeRole('admin'), deleteEmployee);

module.exports = router;
