const Resignation = require('../models/Resignation');
const Employee = require('../models/Employee');

// Employee submits resignation
exports.submitResignation = async (req, res) => {
  try {
    const { empId, lastWorkingDay, reason } = req.body;
    let attachmentUrl = '';
    if (req.file) attachmentUrl = `/uploads/resignations/${req.file.filename}`;
    const resignation = new Resignation({
      employee: req.user._id,
      empId,
      lastWorkingDay,
      reason,
      attachmentUrl,
      status: 'pending',
      submittedAt: new Date()
    });
    await resignation.save();
    res.json({ success: true, resignation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Employee views their resignation requests
exports.getMyResignations = async (req, res) => {
  const resignations = await Resignation.find({ employee: req.user._id }).sort({ submittedAt: -1 });
  res.json(resignations);
};

// Admin views all resignation requests
exports.getAllResignations = async (req, res) => {
  const resignations = await Resignation.find().populate('employee').sort({ submittedAt: -1 });
  res.json(resignations);
};

// Admin approves/rejects resignation
exports.reviewResignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;
    const resignation = await Resignation.findById(id);
    if (!resignation) return res.status(404).json({ message: 'Not found' });
    resignation.status = status;
    resignation.feedback = feedback;
    resignation.reviewedBy = req.user._id;
    resignation.reviewedAt = new Date();
    await resignation.save();
    if (status === 'approved') {
      await Employee.findByIdAndUpdate(resignation.employee, { isActive: false });
      // Optionally log resignation, send notification
    }
    res.json({ success: true, resignation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
