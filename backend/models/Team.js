const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  teamId: { type: String, unique: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  teamName: String,
  teamLeaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }]
});

module.exports = mongoose.model('Team', TeamSchema);
