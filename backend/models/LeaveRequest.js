const mongoose = require('mongoose');


const LeaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  empId: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, default: 'casual' },
  reason: { type: String },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  reviewedAt: { type: Date },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  approvedAt: { type: Date }
});

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);
