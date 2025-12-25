const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');

// POST /api/leaves/ (employee creates)
const createLeave = async (req, res) => {
  try {
    const { empId, startDate, endDate, type, reason } = req.body;
    if (!empId || !startDate || !endDate) return res.status(400).json({ message: 'empId, startDate and endDate required' });

    const employee = await Employee.findOne({ empId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const lr = new LeaveRequest({
      employee: employee._id,
      empId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type: type || 'casual',
      reason
    });
    await lr.save();
    return res.status(201).json(lr);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/leaves/ (admin sees all)
const listLeaves = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find()
      .populate({
        path: 'employee',
        select: 'empId firstName lastName email department',
        populate: { path: 'department', select: 'name' }
      })
      .lean();
    // Attach department name at top level for easier frontend use
    leaves.forEach(l => {
      l.department = l.employee?.department?.name || '';
    });
    return res.json(leaves);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};


// GET /api/leaves/my (employee sees their own)
const getMyLeaves = async (req, res) => {
  try {
    const empId = req.user.empId; // assuming authMiddleware sets req.user
    const leaves = await LeaveRequest.find({ empId })
      .populate({
        path: 'employee',
        select: 'empId firstName lastName email department',
        populate: { path: 'department', select: 'name' }
      })
      .lean();
    // Attach department name
    leaves.forEach(l => {
      l.department = l.employee?.department?.name || '';
    });
    return res.json(leaves);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/leaves/:id/review (admin approves/rejects)
const Message = require('../models/Message');
const reviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved','rejected','pending'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const leave = await LeaveRequest.findById(id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });

    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    // Create a message for the employee
    await Message.create({
      empId: leave.empId,
      type: 'leave',
      message: `Your leave request from ${leave.startDate.toISOString().substring(0,10)} to ${leave.endDate.toISOString().substring(0,10)} has been ${status}.`,
    });

    return res.json(leave);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createLeave, listLeaves, getMyLeaves, reviewLeave };
