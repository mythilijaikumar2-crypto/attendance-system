const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const upload = multer({ dest: path.join(__dirname, '../public/uploads/resignations') });
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const resignationController = require('../controllers/resignationController');

// Employee submits resignation
router.post('/submit', authMiddleware, upload.single('attachment'), resignationController.submitResignation);
// Employee views their resignations
router.get('/my', authMiddleware, resignationController.getMyResignations);
// Admin views all resignations
router.get('/all', authMiddleware, authorizeRole('admin'), resignationController.getAllResignations);
// Admin reviews resignation
router.post('/review/:id', authMiddleware, authorizeRole('admin'), resignationController.reviewResignation);

module.exports = router;
