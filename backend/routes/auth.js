const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Login uses empId + password
router.post('/login', login);

// get current user (requires auth)
router.get('/me', authMiddleware, me);

module.exports = router;
