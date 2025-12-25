/**
 * seed/seed.js
 *
 * Usage: from project root run:
 *   npm run seed
 *
 * This script connects to DB and inserts some sample data including an admin user.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const connectDB = require('../config/db');
const Department = require('../models/Department');
const Position = require('../models/Position');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nxtsync';

const seed = async () => {
  try {
    await connectDB(MONGO_URI);

    // Clear small set (be careful in production)
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await Position.deleteMany({});

    // Drop any erroneous indexes that may cause conflicts
    try {
      await mongoose.connection.db.collection('positions').dropIndex('name_1');
    } catch (err) {
      // Index may not exist, ignore
    }
    try {
      await mongoose.connection.db.collection('employees').dropIndex('username_1');
    } catch (err) {
      // Index may not exist, ignore
    }

    // Departments & positions
    const [devDept, hrDept] = await Department.create([
      { name: 'Development', description: 'Engineering / Dev' },
      { name: 'Human Resources', description: 'HR' }
    ]);

    const [devPos, hrPos] = await Position.create([
      { title: 'Full Stack Developer' },
      { title: 'HR Manager' }
    ]);

    // Admin user
    const adminPassword = 'Admin@123'; // change immediately after seed //this the admin password
    const admin = new Employee({
      empId: 'ADMIN001', //this is the amin id
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@nxtsync.local',
      password: await bcrypt.hash(adminPassword, 10),
      role: 'admin',
      department: hrDept._id,
      position: hrPos._id
    });
    await admin.save();

    // Two sample employees
    const emp1 = new Employee({
      empId: 'EMP001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      password: await bcrypt.hash('Password1!', 10),
      role: 'employee',
      department: devDept._id,
      position: devPos._id
    });
    const emp2 = new Employee({
      empId: 'EMP002',
      firstName: 'Bob',
      lastName: 'Kumar',
      email: 'bob@example.com',
      password: await bcrypt.hash('Password1!', 10),
      role: 'employee',
      department: devDept._id,
      position: devPos._id
    });
    const emp3 = new Employee({
      empId: 'EMP003',
      firstName: 'Charlie',
      lastName: 'Lee',
      email: 'charlie@example.com',
      password: await bcrypt.hash('Password2!', 10),
      role: 'employee',
      department: devDept._id,
      position: devPos._id
    });
    const emp4 = new Employee({
      empId: 'EMP004',
      firstName: 'Diana',
      lastName: 'Patel',
      email: 'diana@example.com',
      password: await bcrypt.hash('Password3!', 10),
      role: 'employee',
      department: hrDept._id,
      position: hrPos._id
    });
    const admin2 = new Employee({
      empId: 'ADMIN002',
      firstName: 'Second',
      lastName: 'Admin',
      email: 'admin2@nxtsync.local',
      password: await bcrypt.hash('Admin2@123', 10),
      role: 'admin',
      department: hrDept._id,
      position: hrPos._id
    });
    await emp1.save();
    await emp2.save();
    await emp3.save();
    await emp4.save();
    await admin2.save();

    // Optionally ingest your uploaded JSON (if exists)
    const jsonPath = '/mnt/data/nxtsync_data.json';
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(raw);
        // Expecting an array of employees
        if (Array.isArray(data.employees)) {
          for (const e of data.employees) {
            if (!e.empId || !e.password) continue;
            const exists = await Employee.findOne({ empId: e.empId });
            if (exists) continue;
            const hashed = await bcrypt.hash(e.password, 10);
            await Employee.create({
              empId: e.empId,
              firstName: e.firstName || '',
              lastName: e.lastName || '',
              email: e.email || '',
              password: hashed,
              role: e.role || 'employee'
            });
          }
        }
      } catch (ingestErr) {
        console.warn('Could not ingest /mnt/data/nxtsync_data.json:', ingestErr.message);
      }
    } else {
      console.log('/mnt/data/nxtsync_data.json not found — skipping JSON ingest.');
    }

    console.log('Seed completed. Admin credentials: empId=ADMIN001 password=' + adminPassword);
    process.exit(0);
  } catch (err) {
    console.error('Seed error', err);
    process.exit(1);
  }
};

// Utility to add a new employee from command line arguments
const addEmployeeFromArgs = async () => {
  // Usage: node seed.js add-employee EMPID PASSWORD FIRSTNAME LASTNAME EMAIL ROLE
  const [,, cmd, empId, password, firstName, lastName, email, role] = process.argv;
  if (cmd !== 'add-employee') return false;
  if (!empId || !password) {
    console.error('Usage: node seed.js add-employee EMPID PASSWORD FIRSTNAME LASTNAME EMAIL ROLE');
    process.exit(1);
  }
  try {
    await connectDB(MONGO_URI);
    const exists = await Employee.findOne({ empId });
    if (exists) {
      console.error('Employee with empId already exists.');
      process.exit(1);
    }
    const hashed = await bcrypt.hash(password, 10);
    const employee = new Employee({
      empId,
      password: hashed,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      role: role || 'employee'
    });
    await employee.save();
    console.log('Employee created:', empId);
    process.exit(0);
  } catch (err) {
    console.error('Error creating employee:', err);
    process.exit(1);
  }
};

// If run with add-employee, handle that and exit
addEmployeeFromArgs().then((handled) => {
  if (!handled) seed();
});
