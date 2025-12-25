const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');


// GET /api/messages/:empId - get messages for an employee
router.get('/:empId', authMiddleware, async (req, res) => {
  try {
    const { empId } = req.params;
    const messages = await Message.find({ empId }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/messages/admin/unread-count - get unread message count for admin
router.get('/admin/unread-count', authMiddleware, async (req, res) => {
  try {
    // Assuming admin messages have empId: 'admin' or type: 'admin'
    const unreadCount = await Message.countDocuments({ empId: 'admin', read: false });
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
