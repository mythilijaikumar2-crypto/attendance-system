const mongoose = require('mongoose');


const EmployeeSchema = new mongoose.Schema({
  empId: { type: String, required: true, unique: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String },
  phone: { type: String },
  password: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  position: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  role: { type: String, enum: ['employee','admin','team_leader'], default: 'employee' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', EmployeeSchema);
