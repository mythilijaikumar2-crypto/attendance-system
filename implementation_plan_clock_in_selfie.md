# Comprehensive Implementation & Execution Guide: Attendance Portal with Selfie Clock-In

This guide provides step-by-step instructions and all necessary commands to set up, run, and utilize the Attendance Portal, including the database, backend, and features like Selfie Clock-In and PDF Exports.

## 1. Prerequisites and Environment Setup

Ensure you have the following installed:
- **Node.js** (v14 or higher)
- **MongoDB** (Local Community Edition or Atlas Connection String)

### Verify Installations
Open your terminal (PowerShell or Command Prompt) and check versions:
```bash
node -v
npm -v
mongo --version
```

---

## 2. Backend Setup & Dependencies

Navigate to the backend directory and install all required packages.

### Step 2.1: Navigate to Backend
```powershell
cd e:\work\Attendance-portal\backend
```

### Step 2.2: Install Dependencies
Run the following command to install `express`, `mongoose`, `multer`, `pdfkit`, `exceljs`, `exifr`, and other core libraries:

```powershell
npm install express mongoose multer pdfkit exceljs exifr cors dotenv bcryptjs jsonwebtoken morgan nodemon
```
*Note: If you encounter errors, try running `npm install` (without arguments) to install from `package.json`.*

### Step 2.3: Environment Configuration (.env)
Create a `.env` file in the `backend` folder if it doesn't exist. Add your database connection string and secret keys:

```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/attendance_db
JWT_SECRET=your_super_secret_key_123
```

---

## 3. Database Commands

### Step 3.1: Start MongoDB (Local)
If you are using a local instance of MongoDB, you must start the database server before running the backend.

Open a **new terminal window** and run:
```powershell
mongod
```
*Leave this terminal open.*

### Step 3.2: Seed the Database (Optional)
If you need to create initial Admin or Employee users:

```powershell
# Inside backend directory
node seed/seed.js
```
*(Ensure `seed/seed.js` exists and is configured correctly)*

---

## 4. Backend Execution Commands

### Step 4.1: Start the Server
To run the server with live reloading (development mode):

```powershell
npm run dev
```

Or for a production-like start:
```powershell
npm start
```

*Expected Output:*
```text
> Server running on port 4000
> MongoDB Connected...
```

---

## 5. Frontend & Usage (Browser)

The frontend is served statically from `backend/public`.

### Step 5.1: Access the Application
Open your web browser (Chrome/Edge) and go to:
**[http://localhost:4000](http://localhost:4000)**

### Step 5.2: Login
1.  **Admin Login**: Use credentials from your seed data (e.g., `admin1` / `password`).
2.  **Employee Login**: Use Employee ID (e.g., `EMP001`).

---

## 6. Feature Walkthrough: Selfie Clock-In

### Process Description
1.  **Login** as an Employee.
2.  **Navigate** to the Dashboard.
3.  **Click** the **"Clock In"** button.
4.  **Selfie Modal**: A camera preview will open.
    *   **Action**: Click "Start Camera" -> "Capture Selfie" -> "Confirm".
5.  **Backend Processing**:
    *   The image is uploaded to `backend/public/uploads/selfies/YYYY-MM-DD`.
    *   Metadata is verified.
    *   Attendance status (`present` or `late`) is calculated based on time (10:00 AM threshold).
6.  **Result**: You will see a "Welcome" or "Late Login" message.

---

## 7. Feature Walkthrough: PDF & Excel Export (Admin)

### Process Description
1.  **Login** as Admin.
2.  **Navigate** to the **Reports** section.
3.  **Select** a report type (Daily, Monthly, Department).
4.  **Click** "Export PDF" or "Export Excel".

### Direct PDF Commands (API Routes)
You can test the PDF generation directly via browser URL:

*   **Daily Report PDF**:
    `http://localhost:4000/api/attendance/export/daily/pdf`
    
*   **Monthly Report PDF**:
    `http://localhost:4000/api/attendance/export/monthly/pdf?month=1&year=2026`

*   **Excel Export**:
    `http://localhost:4000/api/attendance/export/daily/excel`

### Code Reference for PDF Generation (`pdfkit`)
The backend uses `pdfkit` to draw the PDF. Key commands inside `attendanceController.js`:
```javascript
const doc = new PDFDocument();
doc.pipe(res);
doc.text('Attendance Report');
doc.end();
```

---

## 8. Troubleshooting Commands

**Issue: "500 Internal Server Error" on Clock-In**
*   **Cause**: Enum validation failure (e.g., 'late' status not allowed).
*   **Fix**: Update `Attendance.js` model to include `'late'`.
    ```javascript
    enum: ['present', 'absent', 'onleave', 'remote', 'late']
    ```

**Issue: PDF Download Failed**
*   Check if the `uploads` directory exists.
    ```powershell
    mkdir backend/public/uploads
    ```

**Issue: MongoDB Connection Error**
*   Ensure `mongod` is running.
*   Check `MONGO_URI` in `.env`.
