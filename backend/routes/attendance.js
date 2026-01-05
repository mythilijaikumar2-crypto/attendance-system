const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

// --- Standard Check-In/Out (if still used) ---
router.post('/checkin', authMiddleware, attendanceController.checkIn);
router.post('/checkout', authMiddleware, attendanceController.checkOut);

// --- Selfie Clock-In Route ---
// Matches the architecture plan: verify token -> upload file -> controller logic
router.post('/clock-in-selfie',
    authMiddleware,
    attendanceController.uploadSelfieMiddleware.single('image'),
    attendanceController.clockInWithSelfie
);


// --- Dashboard / Data Routes ---
router.get('/status/:empId', authMiddleware, attendanceController.getStatus);
// Attendance Summary Routes
router.get('/my-stats', authMiddleware, attendanceController.getMyStats);
router.get('/summary/today', authMiddleware, attendanceController.summaryToday);
router.get('/summary/week', authMiddleware, attendanceController.summaryWeek);
router.get('/summary/month', authMiddleware, attendanceController.summaryMonth);

// On-Time Summary Routes
router.get('/summary/ontime/today', authMiddleware, attendanceController.summaryOnTimeToday);
router.get('/summary/ontime/week', authMiddleware, attendanceController.summaryOnTimeWeek);
router.get('/summary/ontime/month', authMiddleware, attendanceController.summaryOnTimeMonth);

router.get('/late/today', authMiddleware, attendanceController.lateMembersToday);
router.get('/present/today', authMiddleware, attendanceController.presentTodayList);
router.get('/absent/today', authMiddleware, attendanceController.absentTodayList);
router.get('/history', authMiddleware, authorizeRole('admin'), attendanceController.getAttendanceHistory);


// --- Reports (Admin Only) ---
router.get('/summary/monthly', authMiddleware, authorizeRole('admin'), attendanceController.getMonthlySummary);
router.get('/summary/department', authMiddleware, authorizeRole('admin'), attendanceController.getDepartmentSummary);

router.get('/export/daily/excel', authMiddleware, authorizeRole('admin'), attendanceController.exportDailyExcel);
router.get('/export/daily/pdf', authMiddleware, authorizeRole('admin'), attendanceController.exportDailyPDF);
router.get('/export/monthly/excel', authMiddleware, authorizeRole('admin'), attendanceController.exportMonthlyExcel);
router.get('/export/monthly/pdf', authMiddleware, authorizeRole('admin'), attendanceController.exportMonthlyPDF);
router.get('/export/department/excel', authMiddleware, authorizeRole('admin'), attendanceController.exportDepartmentExcel);
router.get('/export/department/pdf', authMiddleware, authorizeRole('admin'), attendanceController.exportDepartmentPDF);
router.get('/export/late/excel', authMiddleware, authorizeRole('admin'), attendanceController.exportLateExcel);
router.get('/export/late/pdf', authMiddleware, authorizeRole('admin'), attendanceController.exportLatePDF);

module.exports = router;
