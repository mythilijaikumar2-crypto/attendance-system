const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getMyRecentActivity } = require('../controllers/activityController');

// GET /api/activity/my
router.get('/my', authMiddleware, getMyRecentActivity);

module.exports = router;
