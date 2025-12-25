const mongoose = require('mongoose');


const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  shiftTimings: [{
    dayPattern: String, // e.g. "mon-sat", "tue-sun", "sat-sun"
    start: String,      // "11:30"
    end: String         // "19:30"
  }],
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }]
}, { timestamps: true });

module.exports = mongoose.model('Department', DepartmentSchema);
