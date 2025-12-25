const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const { createLeave, listLeaves, getMyLeaves, reviewLeave } = require('../controllers/leaveController');

// employee creates
router.post('/', authMiddleware, createLeave);

// employee gets their own leaves
router.get('/my', authMiddleware, getMyLeaves);

// admin reviews / lists
router.get('/', authMiddleware, authorizeRole('admin'), listLeaves);
router.put('/:id/review', authMiddleware, authorizeRole('admin'), reviewLeave);

module.exports = router;
