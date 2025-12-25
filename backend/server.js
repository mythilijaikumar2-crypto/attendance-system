require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');

const messageRoutes = require('./routes/messages');
const leaveRoutes = require('./routes/leaves');

const app = express();

// Config
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nxtsync';

// Connect DB
connectDB(MONGO_URI);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve frontend (static) from "public"
app.use(express.static(path.join(__dirname, 'public')));

// If you want API routes under /api, keep them as is
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);

app.use('/api/messages', messageRoutes);
app.use('/api/leaves', leaveRoutes);
const resignationRoutes = require('./routes/resignations');
app.use('/api/resignations', resignationRoutes);

// Fallback: serve index.html for SPA-like behavior (optional)
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/', (req, res) => res.send({ ok: true, message: 'NxtSync backend running' }));

// Global error handler (simple)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
