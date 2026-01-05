const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Resignation = require('../models/Resignation');

// GET /api/activity/my
const getMyRecentActivity = async (req, res) => {
    try {
        const empId = req.user.empId;

        // 1. Fetch Attendance (Last 5)
        // Only check-ins or check-outs
        const attendanceRecords = await Attendance.find({ empId })
            .sort({ date: -1 })
            .limit(5);

        // 2. Fetch Leaves (Last 5)
        // Submitted requests
        const leaveRecords = await LeaveRequest.find({ empId })
            .sort({ createdAt: -1 })
            .limit(5);

        // 3. Fetch Resignations (Usually 1)
        const resignationRecords = await Resignation.find({ empId })
            .sort({ submittedAt: -1 })
            .limit(1);

        // Merge and Normalize
        let activities = [];

        // Map Attendance
        attendanceRecords.forEach(r => {
            // Check In Activity
            if (r.checkIn) {
                activities.push({
                    type: 'attendance_in',
                    title: 'Clocked In',
                    timestamp: r.checkIn,
                    status: r.status, // present / late
                    details: `Time: ${new Date(r.checkIn).toLocaleTimeString()}`
                });
            }
            // Check Out Activity
            if (r.checkOut) {
                activities.push({
                    type: 'attendance_out',
                    title: 'Clocked Out',
                    timestamp: r.checkOut,
                    status: 'completed',
                    details: `Duration: ${r.workingHours ? r.workingHours + 'h' : 'N/A'}`
                });
            }
        });

        // Map Leaves
        leaveRecords.forEach(l => {
            activities.push({
                type: 'leave',
                title: 'Leave Request',
                timestamp: l.createdAt,
                status: l.status, // pending, approved, rejected
                details: `${l.startDate.toISOString().substring(0, 10)} to ${l.endDate.toISOString().substring(0, 10)}`
            });
        });

        // Map Resignation
        resignationRecords.forEach(r => {
            activities.push({
                type: 'resignation',
                title: 'Resignation Request',
                timestamp: r.submittedAt,
                status: r.status,
                details: `Last Day: ${new Date(r.lastWorkingDay).toLocaleDateString()}`
            });
        });

        // Sort by timestamp desc
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit to 10 total recent activities
        const recent = activities.slice(0, 10);

        res.json(recent);

    } catch (err) {
        console.error('Activity fetch error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getMyRecentActivity };
