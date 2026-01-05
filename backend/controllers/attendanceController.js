// POST /api/attendance/clock-in-selfie
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const exifr = require('exifr'); // Ensure correct import for exifr if version 7+ or similar
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const LeaveRequest = require('../models/LeaveRequest');

// --- Helper Functions ---

// 1. Configure Multer
const selfieStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const todayStr = new Date().toISOString().split('T')[0];
    const dir = path.join(__dirname, `../public/uploads/selfies/${todayStr}`);
    // Create directory if not exists
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `selfie-${unique}${path.extname(file.originalname)}`);
  }
});
const uploadSelfieMiddleware = multer({ storage: selfieStorage });

// 2. EXIF Verification Helper
const verifySelfieMetadata = async (filePath) => {
  try {
    // Attempt to read metadata
    const meta = await exifr.parse(filePath);
    return meta;

  } catch (err) {
    console.warn('Metadata extraction failed or no EXIF data:', err.message);
    return null;
  }
};


// 3. Time Check Helper
// 3. Time Check Helpers
const OFFICE_START_HOUR = 10;
const OFFICE_START_MIN = 0;
const OFFICE_END_HOUR = 18; // 6:00 PM
const OFFICE_END_MIN = 0;

const isLate = (dateObj) => {
  const threshold = new Date(dateObj);
  threshold.setHours(OFFICE_START_HOUR, OFFICE_START_MIN, 0, 0);
  return dateObj > threshold;
};
const isEarlyDeparture = (dateObj) => {
  const threshold = new Date(dateObj);
  threshold.setHours(OFFICE_END_HOUR, OFFICE_END_MIN, 0, 0);
  return dateObj < threshold;
};


// --- Controller Functions ---

// POST /api/attendance/clock-in-selfie
const clockInWithSelfie = async (req, res) => {
  try {
    const { empId } = req.body;
    // req.file contains the selfie
    if (!empId || !req.file) {
      return res.status(400).json({ success: false, message: 'Employee ID and Selfie are required.' });
    }

    const employee = await Employee.findOne({ empId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const serverTime = new Date(); // Source of Truth
    const dateOnly = new Date(serverTime.getFullYear(), serverTime.getMonth(), serverTime.getDate());

    // --- METADATA VERIFICATION (Pre-check) ---
    const filePath = req.file.path;
    let exifData = null;
    let isTrusted = true;

    try {
      exifData = await verifySelfieMetadata(filePath);
      if (exifData && exifData.DateTimeOriginal) {
        const photoTime = new Date(exifData.DateTimeOriginal);
        const diff = Math.abs(serverTime - photoTime) / 1000 / 60;
        if (diff > 60) {
          console.warn(`Old photo detected for ${empId}.`);
          // isTrusted = false; 
        }
      }
    } catch (metaErr) {
      console.warn('Metadata verification failed, proceeding anyway:', metaErr.message);
      // Do not crash, just proceed with isTrusted = true (or false if strict)
    }


    // 1. Check if already clocked in
    const existing = await Attendance.findOne({ empId, date: dateOnly });
    if (existing) {
      if (existing.checkIn && !existing.checkOut) {
        return res.status(400).json({ success: false, message: 'You have already clocked in for today.' });
      }

      let late = isLate(serverTime);
      let message = late ? 'Late Clock In: Recorded (> 10:35 AM).' : 'Welcome back! You are checked in.';

      existing.checkIn = serverTime;
      existing.checkOut = null;
      existing.status = 'present';

      existing.meta = {
        ...existing.meta,
        selfieUrl: `/uploads/selfies/${dateOnly.toISOString().split('T')[0]}/${req.file.filename}`,
        verification: isTrusted ? 'verified' : 'unverified',
        lastLogin: serverTime
      };

      await existing.save();

      return res.status(200).json({
        success: true,
        status: late ? 'late' : 'present',
        message: message + ' (Re-entry)',
        time: serverTime.toISOString()
      });
    }

    // 2. Determine Status (Late vs Present)


    // 2. Determine Status (Late vs Present)
    let late = isLate(serverTime);
    // Explicit Status Assignment
    // If Late -> Status 'late' (visible as Late Login)
    // If On Time -> Status 'present' (visible as On Time)
    const status = late ? 'late' : 'present';
    const message = late
      ? `Late Login: Clocked in after ${OFFICE_START_HOUR}:${OFFICE_START_MIN.toString().padStart(2, '0')}.`
      : 'On Time: Successfully clocked in.';

    // 4. Save Record
    const record = new Attendance({
      employee: employee._id,
      empId,
      date: dateOnly,
      checkIn: serverTime,
      status: status,
      meta: {
        selfieUrl: `/uploads/selfies/${dateOnly.toISOString().split('T')[0]}/${req.file.filename}`,
        verification: isTrusted ? 'verified' : 'unverified',
        exif: exifData || {}
      }
    });

    await record.save();

    return res.status(201).json({
      success: true,
      status: status,
      message: message,
      time: serverTime.toISOString()
    });

  } catch (err) {
    console.error('ClockIn Selfie Error Details:', err);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Server error during clock-in: ' + err.message });
  }
};


// GET /api/attendance/present/today
const presentTodayList = async (req, res) => {
  try {
    const today = new Date();
    // Consistent Date logic: Local Midnight
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const presentList = await Attendance.find({
      date: dateOnly,
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
    // Consistent Date logic: Local Midnight (Matches checkIn creation)
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const record = await Attendance.findOne({ empId, date: dateOnly });
    if (!record) return res.json({ clockedIn: false, lastActionTime: null, status: null });
    return res.json({
      clockedIn: !!record.checkIn && !record.checkOut,
      lastActionTime: (record.checkOut || record.checkIn || null) ? (record.checkOut || record.checkIn).toISOString() : null,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      status: record.status || null,
      meta: record.meta || {}
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/attendance/checkin (Simple/Button)
const checkIn = async (req, res) => {
  try {
    const { empId } = req.body;
    if (!empId) return res.status(400).json({ message: 'empId required' });
    const employee = await Employee.findOne({ empId });
    if (!employee) return res.status(404).json({ message: `Employee not found` });

    const serverTime = new Date();
    const dateOnly = new Date(serverTime.getFullYear(), serverTime.getMonth(), serverTime.getDate());

    const existing = await Attendance.findOne({ empId, date: dateOnly });
    if (existing) {
      // If currently clocked in (no checkOut), prevent double check-in
      if (existing.checkIn && !existing.checkOut) {
        return res.status(400).json({ message: 'Already clocked in.', status: existing.status || 'present' });
      }

      // If we are here, the user has clocked out previously today (or checkIn was null).
      // We will UPDATE the record to be "Clocked In" again (Test Mode/Re-entry behavior).
      // This allows the user to re-test the "Late" logic essentially by overwriting the day's start.

      let late = isLate(serverTime);
      const status = late ? 'late' : 'present';
      let message = late
        ? `Late Login: Clocked in after ${OFFICE_START_HOUR}:${OFFICE_START_MIN.toString().padStart(2, '0')}.`
        : 'On Time: Successfully clocked in.';

      existing.checkIn = serverTime;
      existing.checkOut = null;
      existing.status = status;
      await existing.save();

      return res.status(200).json({
        success: true,
        status: status,
        message: message + ' (Re-entry)',
        checkIn: serverTime
      });
    }

    let late = isLate(serverTime);
    const status = late ? 'late' : 'present';
    let message = late
      ? `Late Login: Clocked in after ${OFFICE_START_HOUR}:${OFFICE_START_MIN.toString().padStart(2, '0')}.`
      : 'On Time: Successfully clocked in.';

    const record = new Attendance({
      employee: employee._id,
      empId,
      date: dateOnly,
      status: status,
      checkIn: serverTime
    });
    await record.save();

    return res.status(201).json({
      success: true,
      status: status,
      message: message,
      checkIn: serverTime
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/attendance/checkout
const checkOut = async (req, res) => {
  try {
    const { empId } = req.body;
    if (!empId) return res.status(400).json({ message: 'empId required' });

    const serverTime = new Date();
    const dateOnly = new Date(serverTime.getFullYear(), serverTime.getMonth(), serverTime.getDate());

    const record = await Attendance.findOne({ empId, date: dateOnly });
    if (!record) return res.status(404).json({ message: 'No check-in record found for today' });
    if (!record.checkIn) return res.status(400).json({ message: 'You must clock in before clocking out.' });
    if (record.checkOut) return res.status(400).json({ message: 'Already clocked out for today.' });

    // Calculate duration in hours
    const diffMs = serverTime - new Date(record.checkIn);
    const durationHours = diffMs / (1000 * 60 * 60);
    const MIN_HOURS = 8; // Define threshold

    record.checkOut = serverTime;
    record.workingHours = parseFloat(durationHours.toFixed(2));

    // Default Status
    let message = 'Checked out successfully.';
    let isEarly = isEarlyDeparture(serverTime);

    if (isEarly) {
      // Logic: If clocks out earlier than duty end time -> Mark Absent
      record.status = 'absent';
      record.meta = { ...record.meta, earlyDeparture: true, penalty: 'Early Departure (Marked Absent)' };
      message = `Warning: Marked ABSENT. You clocked out before ${OFFICE_END_HOUR}:${OFFICE_END_MIN.toString().padStart(2, '0')}.`;
    } else {
      // Normal checkout, assume status remains 'present'/ 'late' unless logic dictates otherwise
      // (If they were Late, they stay Late. If Present, stay Present)
      // Actually, standard is usually just 'Completed' but we keep the IN status or mark 'present'.
    }

    await record.save();
    return res.json({ success: true, message, record });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET present/absent counts for today
const summaryToday = async (req, res) => {
  try {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const onTime = await Attendance.countDocuments({ date: dateOnly, status: 'present' });
    const late = await Attendance.countDocuments({ date: dateOnly, status: 'late' });
    const absent = await Attendance.countDocuments({ date: dateOnly, status: 'absent' });
    const onLeave = await Attendance.countDocuments({ date: dateOnly, status: 'onleave' });

    // Consistent UI keys
    return res.json({
      onTime,
      late,
      totalPresent: onTime + late,
      absent,
      onLeave
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET present/absent counts for current week
const summaryWeek = async (req, res) => {
  try {
    const today = new Date();
    const day = today.getDay(); // 0 (Sun) - 6 (Sat)

    // Set start to Sunday of this week
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    start.setHours(0, 0, 0, 0);

    // Set end to Saturday of this week
    const end = new Date(today);
    // end.setDate(today.getDate() + (6 - day)); // This wraps incorrectly if end of month
    // Better: clone start and add 6 days
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // Query range
    const present = await Attendance.countDocuments({ date: { $gte: start, $lte: end }, status: 'present' });
    const absent = await Attendance.countDocuments({ date: { $gte: start, $lte: end }, status: 'absent' });
    const onLeave = await Attendance.countDocuments({ date: { $gte: start, $lte: end }, status: 'onleave' });

    return res.json({ present, absent, onLeave });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET present/absent counts for current month
const summaryMonth = async (req, res) => {
  try {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const present = await Attendance.countDocuments({ date: { $gte: start, $lte: end }, status: 'present' });
    const absent = await Attendance.countDocuments({ date: { $gte: start, $lte: end }, status: 'absent' });
    const onLeave = await Attendance.countDocuments({ date: { $gte: start, $lte: end }, status: 'onleave' });

    return res.json({ present, absent, onLeave });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// --- On-Time Summary Helpers ---
const countOnTimeLate = async (startDate, endDate) => {
  // Threshold logic: 10:35 AM is cutoff
  // Filter: status='present' and date in range
  const records = await Attendance.find({
    date: { $gte: startDate, $lte: endDate },
    status: 'present',
    checkIn: { $ne: null }
  });

  let onTime = 0;
  let late = 0;

  records.forEach(r => {
    // Create threshold for that specific day
    const checkInTime = new Date(r.checkIn);
    const threshold = new Date(checkInTime); // Copy date
    threshold.setHours(10, 35, 0, 0);

    if (checkInTime > threshold) {
      late++;
    } else {
      onTime++;
    }
  });
  return { onTime, late };
};

// GET On-Time vs Late for Today
const summaryOnTimeToday = async (req, res) => {
  try {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const result = await countOnTimeLate(start, end);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET On-Time vs Late for Week
const summaryOnTimeWeek = async (req, res) => {
  try {
    const today = new Date();
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const result = await countOnTimeLate(start, end);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET On-Time vs Late for Month
const summaryOnTimeMonth = async (req, res) => {
  try {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const result = await countOnTimeLate(start, end);
    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};


// GET /api/attendance/late/today
// GET /api/attendance/late/today
const lateMembersToday = async (req, res) => {
  try {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Find all 'late' status today
    const lateList = await Attendance.find({
      date: dateOnly,
      status: 'late'
    }).populate({
      path: 'employee',
      select: 'firstName lastName department',
      populate: { path: 'department', select: 'name' }
    });
    const result = lateList.map(l => ({
      empId: l.empId,
      name: `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim(),
      department: l.employee?.department?.name || '',
      checkIn: l.checkIn ? new Date(l.checkIn).toLocaleTimeString() : 'N/A'
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
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // Find all absent today
    const absentList = await Attendance.find({
      date: dateOnly,
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
      summary[dayStr] = { present: 0, late: 0, absent: 0, onLeave: 0 };
    }
    records.forEach(r => {
      const dayStr = r.date.toISOString().substring(0, 10);
      if (summary[dayStr]) {
        if (r.status === 'present') summary[dayStr].present++;
        if (r.status === 'late') summary[dayStr].late++;
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
      if (!summary[dept]) summary[dept] = { present: 0, late: 0, absent: 0, onLeave: 0 };
      if (r.status === 'present') summary[dept].present++;
      if (r.status === 'late') summary[dept].late++;
      if (r.status === 'absent') summary[dept].absent++;
      if (r.status === 'onleave') summary[dept].onLeave++;
    });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Exports ---
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
    console.error('Export Excel Error:', err);
    res.status(500).send('Failed to generate Excel');
  }
};

const exportDailyPDF = async (req, res) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    today.setHours(0, 0, 0, 0);
    const records = await Attendance.find({ date: today }).populate({ path: 'employee', populate: { path: 'department' } });

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="DailyAttendance_${dateStr}.pdf"`);

    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Daily Attendance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${dateStr}`, { align: 'center' });
    doc.moveDown();

    // Table Header
    const yStart = doc.y;
    const colX = [30, 100, 250, 350, 420, 500]; // Coords for columns

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Emp ID', colX[0], yStart);
    doc.text('Name', colX[1], yStart);
    doc.text('Department', colX[2], yStart);
    doc.text('Status', colX[3], yStart);
    doc.text('Check In', colX[4], yStart);
    doc.text('Check Out', colX[5], yStart);

    doc.moveTo(30, doc.y + 5).lineTo(570, doc.y + 5).stroke();
    doc.moveDown();

    // Rows
    doc.font('Helvetica');
    let y = doc.y + 10;

    records.forEach((r) => {
      if (y > 750) { // Add new page if near bottom
        doc.addPage();
        y = 50;
        // Header again
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Emp ID', colX[0], y);
        doc.text('Name', colX[1], y);
        doc.text('Department', colX[2], y);
        doc.text('Status', colX[3], y);
        doc.text('Check In', colX[4], y);
        doc.text('Check Out', colX[5], y);
        doc.moveTo(30, y + 5).lineTo(570, y + 5).stroke();
        y += 20;
        doc.font('Helvetica');
      }

      const name = r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : 'N/A';
      const dept = r.employee && r.employee.department ? r.employee.department.name : '-';
      const checkIn = r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '-';
      const checkOut = r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '-';

      doc.text(r.empId, colX[0], y);
      doc.text(name, colX[1], y);
      doc.text(dept, colX[2], y);
      doc.text(r.status, colX[3], y);
      doc.text(checkIn, colX[4], y);
      doc.text(checkOut, colX[5], y);

      y += 15;
    });

    doc.end();
  } catch (err) {
    console.error('Export PDF Error:', err);
    res.status(500).send('Failed to generate PDF');
  }
};

// GET /api/attendance/my-stats
const getMyStats = async (req, res) => {
  try {
    const empId = req.user.empId;
    const { period } = req.query; // 'today', 'week', 'month'
    const now = new Date();
    let start, end;
    let totalDays = 1;

    if (period === 'week') {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      // Days passed in week so far (0-6)
      totalDays = day + 1;
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      totalDays = now.getDate();
    } else {
      // Default / Today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      totalDays = 1;
    }

    // Fetch ALL records (Present, Absent, OnLeave)
    const records = await Attendance.find({
      empId,
      date: { $gte: start, $lte: end }
    });

    let daysPresent = 0;
    let daysOnLeave = 0;
    let daysAbsentExplicit = 0;
    let onTimeCount = 0;
    let totalWorkHours = 0;
    let workDaysCount = 0;

    records.forEach(r => {
      if (r.status === 'present') {
        daysPresent++;
        // Check Late
        if (r.checkIn) {
          const checkInTime = new Date(r.checkIn);
          const threshold = new Date(checkInTime);
          threshold.setHours(10, 35, 0, 0);
          if (checkInTime <= threshold) onTimeCount++;
        }
        // Work hours
        if (r.workingHours) {
          totalWorkHours += r.workingHours;
          workDaysCount++;
        }
      } else if (r.status === 'onleave' || r.status === 'leave') {
        daysOnLeave++;
      } else if (r.status === 'absent') {
        daysAbsentExplicit++;
      }
    });

    // Inferred Absent: Days elapsed - (Present + Leave)
    // Use Math.max to avoid negative if data inconsistent
    // Note: totalDays is calendar days (incl weekends). This is a rough approx for "Absent" 
    // without a holiday schedule, but works for basic visualization.
    const inferredAbsent = Math.max(0, totalDays - daysPresent - daysOnLeave);

    // Attendance Rate = (Present / (Total Days - Leavedays? Or just TotalDays?))
    // Typically: Present / WorkingDays. Here: Present / TotalDays * 100
    const attendanceRate = totalDays > 0 ? ((daysPresent / totalDays) * 100).toFixed(1) : 0;

    const onTimeRate = daysPresent > 0 ? ((onTimeCount / daysPresent) * 100).toFixed(1) : 0;
    const avgWorkHours = workDaysCount > 0 ? (totalWorkHours / workDaysCount).toFixed(1) : 0;

    // Pending leaves for stat card
    const pendingLeaves = await LeaveRequest.countDocuments({ empId, status: 'pending' });

    res.json({
      period,
      attendanceRate,
      onTimeRate,
      daysPresent,
      daysOnLeave,
      onTimeCount,
      lateCount: daysPresent - onTimeCount,
      totalAbsent: inferredAbsent,
      pendingLeaves,
      avgWorkHours,
      totalDays
    });

  } catch (err) {
    console.error('getMyStats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const exportMonthlyExcel = (req, res) => { res.status(501).send('Not implemented'); };
const exportMonthlyPDF = (req, res) => { res.status(501).send('Not implemented'); };
const exportDepartmentExcel = (req, res) => { res.status(501).send('Not implemented'); };
const exportDepartmentPDF = (req, res) => { res.status(501).send('Not implemented'); };
const exportLateExcel = (req, res) => { res.status(501).send('Not implemented'); };
const exportLatePDF = (req, res) => { res.status(501).send('Not implemented'); };


// GET /api/attendance/history
const getAttendanceHistory = async (req, res) => {
  try {
    // Return last 50 records sorted by date desc
    const records = await Attendance.find()
      .sort({ date: -1, checkIn: -1 })
      .limit(50)
      .populate({
        path: 'employee',
        select: 'firstName lastName department photoUrl',
        populate: { path: 'department', select: 'name' }
      });

    res.json(records);
  } catch (err) {
    console.error('getAttendanceHistory error:', err);
    res.status(500).json({ message: 'Server error fetching history' });
  }
};

module.exports = {

  // Helpers
  uploadSelfieMiddleware,
  // Controllers
  clockInWithSelfie,
  checkIn,
  checkOut,
  summaryToday,
  summaryWeek,
  summaryMonth,
  summaryOnTimeToday,
  summaryOnTimeWeek,
  summaryOnTimeMonth,
  getStatus,
  lateMembersToday,
  presentTodayList,
  absentTodayList,
  getAttendanceHistory,
  getMonthlySummary,
  getDepartmentSummary,
  getMyStats,
  exportDailyExcel, exportDailyPDF, exportMonthlyExcel, exportMonthlyPDF, exportDepartmentExcel, exportDepartmentPDF, exportLateExcel, exportLatePDF
};
