// POST /api/attendance/clock-in (selfie+metadata)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const selfieClockInStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/clockin');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || '.jpg'));
  }
});
const uploadClockInSelfie = multer({ storage: selfieClockInStorage });

const clockInWithSelfie = async (req, res) => {
  try {
    // multer parses file, fields in req.body
    const { employeeId, date, checkInTime, metaData } = req.body;
    if (!employeeId || !req.file) {
      return res.status(400).json({ message: 'employeeId and selfie image required' });
    }
    const employee = await Employee.findOne({ empId: employeeId });
    if (!employee) {
      return res.status(404).json({ message: `Employee not found for empId=${employeeId}` });
    }
    // Check for existing clock-in
    const dateObj = new Date(date);
    let record = await Attendance.findOne({ empId: employeeId, date: dateObj });
    if (record && record.checkIn) {
      return res.status(400).json({ message: 'Already clocked in for today.' });
    }
    const selfieUrl = `/uploads/clockin/${req.file.filename}`;
    let meta = {};
    try {
      meta = metaData ? JSON.parse(metaData) : {};
    } catch (e) { meta = {}; }
    meta.selfieUrl = selfieUrl;
    meta.fileType = req.file.mimetype;
    meta.fileSize = req.file.size;
    meta.uploadedAt = new Date().toISOString();

    // Backend validation
    // 1. Require photo (already checked above)
    // 2. Check metadata timestamp (within 5 minutes of server time)
    const now = Date.now();
    let metaTime = null;
    if (meta.capturedAt) {
      metaTime = new Date(meta.capturedAt).getTime();
    } else if (meta.timestamp) {
      metaTime = new Date(meta.timestamp).getTime();
    }
    // if (metaTime && Math.abs(now - metaTime) > 24 * 60 * 60 * 1000) {
    //   return res.status(400).json({ message: 'Photo capture time is too far from server time. Please use a recent photo (within 24 hours).' });
    // }
    // 3. Require GPS if mandatory
    const requireGPS = false; // set to true if GPS is mandatory
    if (requireGPS && !(meta.gps || meta.geo)) {
      return res.status(400).json({ message: 'GPS location is required. Please enable location and try again.' });
    }

    // Save attendance
    if (!record) {
      record = new Attendance({
        employee: employee._id,
        empId: employeeId,
        date: dateObj,
        status: 'present',
        checkIn: new Date(date + 'T' + checkInTime),
        meta
      });
    } else {
      record.checkIn = new Date(date + 'T' + checkInTime);
      record.status = 'present';
      record.meta = meta;
    }
    await record.save();
    return res.status(201).json({
      success: true,
      selfieUrl,
      meta,
      status: 'present',
      lastActionTime: record.checkIn.toISOString()
    });
  } catch (err) {
    console.error('ClockInWithSelfie server error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// GET /api/attendance/present/today
const presentTodayList = async (req, res) => {
  try {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const presentList = await Attendance.find({
      date: dateString,
      status: 'present',
      checkIn: { $ne: null }
    }).populate({
      path: 'employee',
      select: 'firstName lastName department',
      populate: { path: 'department', select: 'name' }
    });
    const result = presentList.map(l => ({
      empId: l.empId,
      name: `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim(),
      department: l.employee?.department?.name || '',
      checkIn: l.checkIn,
      meta: l.meta || {}
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
// GET /api/attendance/status/:empId
const getStatus = async (req, res) => {
  try {
    const { empId } = req.params;
    if (!empId) return res.status(400).json({ message: 'empId required' });
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const record = await Attendance.findOne({ empId, date: dateString });
    if (!record) return res.json({ clockedIn: false, lastActionTime: null, status: null });
    return res.json({
      clockedIn: !!record.checkIn && !record.checkOut,
      lastActionTime: (record.checkOut || record.checkIn || null) ? (record.checkOut || record.checkIn).toISOString() : null,
      status: record.status || null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const Department = require('../models/Department');

// POST /api/attendance/checkin
const checkIn = async (req, res) => {
  try {
    const { empId } = req.body;
    if (!empId) {
      console.error('CheckIn error: empId missing in request body');
      return res.status(400).json({ message: 'empId required' });
    }

    const employee = await Employee.findOne({ empId });
    if (!employee) {
      console.error(`CheckIn error: Employee not found for empId=${empId}`);
      return res.status(404).json({ message: `Employee not found for empId=${empId}` });
    }

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const existing = await Attendance.findOne({ empId, date: dateOnly });
    if (existing) {
      existing.checkIn = existing.checkIn || new Date();
      existing.status = 'present';
      await existing.save();
      return res.json({
        ...existing.toObject(),
        status: 'present',
        lastActionTime: (existing.checkIn || null) ? existing.checkIn.toISOString() : null
      });
    }

    const record = new Attendance({
      employee: employee._id,
      empId,
      date: dateOnly,
      status: 'present',
      checkIn: new Date()
    });
    await record.save();
    return res.status(201).json({
      ...record.toObject(),
      status: 'present',
      lastActionTime: (record.checkIn || null) ? record.checkIn.toISOString() : null
    });
  } catch (err) {
    console.error('CheckIn server error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/attendance/checkout
const checkOut = async (req, res) => {
  try {
    const { empId } = req.body;
    if (!empId) return res.status(400).json({ message: 'empId required' });

    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const record = await Attendance.findOne({ empId, date: dateOnly });
    if (!record) return res.status(404).json({ message: 'No check-in record found for today' });
    if (!record.checkIn) return res.status(400).json({ message: 'You must clock in before clocking out.' });
    if (record.checkOut) return res.status(400).json({ message: 'Already clocked out for today.' });

    record.checkOut = new Date();
    await record.save();
    return res.json(record);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET present/absent counts for today
const summaryToday = async (req, res) => {
  try {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    const present = await Attendance.countDocuments({ date: dateString, status: 'present' });
    const absent = await Attendance.countDocuments({ date: dateString, status: 'absent' });
    const onLeave = await Attendance.countDocuments({ date: dateString, status: 'onleave' });

    return res.json({ present, absent, onLeave });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/attendance/late/today
const lateMembersToday = async (req, res) => {
  try {
    // Define late threshold (e.g., 09:15 AM)
    const LATE_HOUR = 9, LATE_MIN = 15;
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    // Find all present today with checkIn after threshold
    const lateList = await Attendance.find({
      date: dateString,
      status: 'present',
      checkIn: { $gt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), LATE_HOUR, LATE_MIN) }
    }).populate({
      path: 'employee',
      select: 'firstName lastName department',
      populate: { path: 'department', select: 'name' }
    });
    const result = lateList.map(l => ({
      empId: l.empId,
      name: `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim(),
      department: l.employee?.department?.name || '',
      checkIn: l.checkIn
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


// GET /api/attendance/absent/today
const absentTodayList = async (req, res) => {
  try {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    // Find all absent today
    const absentList = await Attendance.find({
      date: dateString,
      status: 'absent'
    }).populate({
      path: 'employee',
      select: 'firstName lastName department',
      populate: { path: 'department', select: 'name' }
    });
    const result = absentList.map(a => ({
      empId: a.empId,
      name: `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.trim(),
      department: a.employee?.department?.name || '',
      reason: a.meta?.reason || 'Unknown',
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


// POST /api/attendance/checkin-selfie
const { exifr } = require('exifr');

// Configure multer for image upload (store in /uploads/selfies/)
const selfieStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/selfies');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || '.jpg'));
  }
});
const uploadSelfie = multer({ storage: selfieStorage });

// Extract EXIF metadata from uploaded image
const extractExifData = async (filePath) => {
  try {
    const exifData = await exifr.parse(filePath, {
      gps: true,
      exif: true,
      ifd1: true,
      mergeOutput: false
    });

    let gps = null;
    if (exifData?.latitude && exifData?.longitude) {
      gps = {
        lat: exifData.latitude,
        lng: exifData.longitude
      };
    }

    let device = null;
    if (exifData?.Make || exifData?.Model) {
      device = {
        make: exifData.Make || null,
        model: exifData.Model || null
      };
    }

    return {
      gps,
      device,
      capturedAt: exifData?.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toISOString() : null,
      orientation: exifData?.Orientation || null,
      width: exifData?.ImageWidth || exifData?.ExifImageWidth || null,
      height: exifData?.ImageHeight || exifData?.ExifImageHeight || null
    };
  } catch (err) {
    console.warn('EXIF extraction failed:', err.message);
    return {
      gps: null,
      device: null,
      capturedAt: null,
      orientation: null,
      width: null,
      height: null
    };
  }
};

// Express handler for selfie check-in
const checkInSelfie = async (req, res) => {
  try {
    // multer parses file, fields in req.body
    const { empId, timestamp, userAgent, fileType, fileSize, imageHash, geo } = req.body;
    if (!empId || !req.file) {
      return res.status(400).json({ message: 'empId and selfie image required' });
    }
    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ message: `Employee not found for empId=${empId}` });
    }

    // Use Date object for date field
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let record = await Attendance.findOne({ empId, date: dateOnly });
    if (record && record.checkIn) {
      return res.status(400).json({ message: 'Already clocked in for today.' });
    }

    const selfieUrl = `/uploads/selfies/${req.file.filename}`;

    // Extract EXIF metadata
    const filePath = req.file.path;
    const extracted = await extractExifData(filePath);

    const meta = {
      selfieUrl,
      fileType,
      fileSize,
      imageHash,
      extracted,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent,
      timestamp
    };

    // Add geo if provided
    if (geo) {
      meta.geo = JSON.parse(geo);
    }

    if (!record) {
      record = new Attendance({
        employee: employee._id,
        empId,
        date: dateOnly,
        status: 'present',
        checkIn: new Date(),
        meta
      });
    } else {
      record.checkIn = new Date();
      record.status = 'present';
      record.meta = meta;
    }

    await record.save();

    const metadata = {
      selfieUrl,
      fileType,
      fileSize,
      extracted,
      ip: meta.ip,
      userAgent,
      timestamp,
      geo: meta.geo
    };

    return res.status(201).json({
      success: true,
      selfieUrl,
      metadata
    });
  } catch (err) {
    console.error('Selfie CheckIn server error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/attendance/summary/monthly
const getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) - 1 : now.getMonth();
    // Get all days in month
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const records = await Attendance.find({ date: { $gte: start, $lte: end } });
    // Aggregate by day
    const summary = {};
    for (let d = 1; d <= end.getDate(); d++) {
      const day = new Date(y, m, d);
      const dayStr = day.toISOString().substring(0, 10);
      summary[dayStr] = { present: 0, absent: 0, onLeave: 0 };
    }
    records.forEach(r => {
      const dayStr = r.date.toISOString().substring(0, 10);
      if (summary[dayStr]) {
        if (r.status === 'present') summary[dayStr].present++;
        if (r.status === 'absent') summary[dayStr].absent++;
        if (r.status === 'onleave') summary[dayStr].onLeave++;
      }
    });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/attendance/summary/department
const getDepartmentSummary = async (req, res) => {
  try {
    // Aggregate attendance by department for current month
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const records = await Attendance.find({ date: { $gte: start, $lte: end } }).populate({ path: 'employee', select: 'department', populate: { path: 'department', select: 'name' } });
    const summary = {};
    records.forEach(r => {
      const dept = r.employee?.department?.name || 'Unknown';
      if (!summary[dept]) summary[dept] = { present: 0, absent: 0, onLeave: 0 };
      if (r.status === 'present') summary[dept].present++;
      if (r.status === 'absent') summary[dept].absent++;
      if (r.status === 'onleave') summary[dept].onLeave++;
    });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Export Stubs ---
// Real-time Excel export for Daily Attendance
const ExcelJS = require('exceljs');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

const exportDailyExcel = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const records = await Attendance.find({ date: today }).populate('employee');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Daily Attendance');
    sheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Check In', key: 'checkIn', width: 20 },
      { header: 'Check Out', key: 'checkOut', width: 20 }
    ];
    records.forEach(r => {
      sheet.addRow({
        empId: r.empId,
        name: r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : '',
        department: r.employee && r.employee.department && r.employee.department.name ? r.employee.department.name : '',
        status: r.status,
        checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '',
        checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : ''
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="DailyAttendance.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send('Failed to generate Excel');
  }
};
const exportDailyPDF = (req, res) => { res.status(501).send('Not implemented'); };
const exportMonthlyExcel = (req, res) => { res.status(501).send('Not implemented'); };
const exportMonthlyPDF = (req, res) => { res.status(501).send('Not implemented'); };
const exportDepartmentExcel = (req, res) => { res.status(501).send('Not implemented'); };
const exportDepartmentPDF = (req, res) => { res.status(501).send('Not implemented'); };
const exportLateExcel = (req, res) => { res.status(501).send('Not implemented'); };
const exportLatePDF = (req, res) => { res.status(501).send('Not implemented'); };

module.exports = {
  checkIn, checkOut, summaryToday, getStatus, lateMembersToday, presentTodayList, absentTodayList, checkInSelfie, uploadSelfie, getMonthlySummary, getDepartmentSummary, clockInWithSelfie, uploadClockInSelfie,
  exportDailyExcel, exportDailyPDF, exportMonthlyExcel, exportMonthlyPDF, exportDepartmentExcel, exportDepartmentPDF, exportLateExcel, exportLatePDF
};
