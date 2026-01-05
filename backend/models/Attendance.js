const mongoose = require('mongoose');


const AttendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  empId: { type: String, required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'onleave', 'remote', 'late'], default: 'present' },
  checkIn: { type: Date },
  checkOut: { type: Date },
  workingHours: { type: Number },
  selfieImageUrl: { type: String },
  meta: { type: Object }
}, { timestamps: true });

AttendanceSchema.index({ empId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
