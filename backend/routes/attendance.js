// ...existing code...
const express = require('express');
const router = express.Router();
const { authMiddleware, authorizeRole } = require('../middleware/auth');
const { checkIn, checkOut, summaryToday, getStatus, lateMembersToday, presentTodayList, absentTodayList, checkInSelfie, uploadSelfie, getMonthlySummary, getDepartmentSummary, clockInWithSelfie, uploadClockInSelfie } = require('../controllers/attendanceController');
// New selfie+metadata clock-in endpoint
router.post('/clock-in', authMiddleware, uploadClockInSelfie.single('image'), clockInWithSelfie);

router.get('/absent/today', authMiddleware, absentTodayList);
router.get('/status/:empId', authMiddleware, getStatus);
router.post('/checkin', authMiddleware, checkIn);
router.post('/checkin-selfie', authMiddleware, uploadSelfie.single('image'), checkInSelfie);
router.post('/checkout', authMiddleware, checkOut);
router.get('/summary/today', authMiddleware, summaryToday);
router.get('/late/today', authMiddleware, lateMembersToday);
router.get('/present/today', authMiddleware, presentTodayList);

// Export endpoints for reports (Excel/PDF)
router.get('/export/daily/excel', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportDailyExcel);
router.get('/export/daily/pdf', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportDailyPDF);
router.get('/export/monthly/excel', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportMonthlyExcel);
router.get('/export/monthly/pdf', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportMonthlyPDF);
router.get('/export/department/excel', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportDepartmentExcel);
router.get('/export/department/pdf', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportDepartmentPDF);
router.get('/export/late/excel', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportLateExcel);
router.get('/export/late/pdf', authMiddleware, authorizeRole('admin'), require('../controllers/attendanceController').exportLatePDF);

router.get('/summary/monthly', authMiddleware, authorizeRole('admin'), getMonthlySummary);
router.get('/summary/department', authMiddleware, authorizeRole('admin'), getDepartmentSummary);

module.exports = router;
