const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  empId: { type: String, required: true },
  type: { type: String, default: 'info' },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

module.exports = mongoose.model('Message', MessageSchema);
