const mongoose = require('mongoose');

const ResignationSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  empId: { type: String, required: true },
  lastWorkingDay: { type: Date, required: true },
  reason: { type: String, required: true },
  attachmentUrl: { type: String },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  feedback: { type: String },
  submittedAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  reviewedAt: { type: Date }
});

module.exports = mongoose.model('Resignation', ResignationSchema);
