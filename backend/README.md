# NxtSync Attendance Portal

A complete employee attendance management system with a Node.js backend and a vanilla JavaScript frontend.

## Features

*   **Employee & Admin Portals**: Distinct dashboards for different user roles.
*   **Clock In/Out**: Employees can clock in and out, with mandatory **Selfie Verification**.
*   **Geolocation**: Captures and validates location data during attendance marking.
*   **Leave Management**: Employees can request leave; Admins can approve/reject.
*   **Attendance Reports**: Daily, monthly, and department-wise attendance summaries.
*   **Dashboard**: Real-time widgets for attendance stats, time, and notifications.

## Prerequisites

*   **Node.js**: (v14 or higher) - [Download](https://nodejs.org/)
*   **MongoDB**: (v4.0 or higher) - ensure it is running locally or provide a connection string.

## Installation

1.  **Clone or Download** the project folder to your local machine.
2.  Open a terminal in the project root directory (where `package.json` is located).
3.  Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

1.  The application uses a `.env` file for configuration. One should already exist, but if not, create a file named `.env` in the root directory with the following content:

    ```env
    PORT=4000
    MONGO_URI=mongodb://localhost:27017/nxtsync
    JWT_SECRET=your_super_secret_key_change_this
    JWT_EXPIRES_IN=7d
    ```

    *   Replace `your_super_secret_key_change_this` with a secure random string.
    *   Update `MONGO_URI` if your database is hosted elsewhere.

## Seeding the Database (Initial Setup)

To create the initial Admin account and sample data:

```bash
npm run seed
```

This will create:
*   **Admin User**:
    *   **ID**: `ADMIN001`
    *   **Password**: `Admin@123`
*   **Sample Employees**:
    *   **ID**: `EMP001` - `EMP004`
    *   **Password**: `Password1!` (or similar, check `seed/seed.js` for details)

## Running the Application

1.  **Start the Development Server**:

    ```bash
    npm run dev
    ```

    (This uses `nodemon` to restart automatically on file changes).

2.  **Start in Production Mode**:

    ```bash
    npm start
    ```

3.  The server will start at `http://localhost:4000`.

## Usage Guide

1.  Open your browser and navigate to: [http://localhost:4000](http://localhost:4000)
    *   This will load the login page (`index.html`).
2.  **Login**:
    *   Use the **Admin Credentials** (`ADMIN001` / `Admin@123`) to access the Admin Dashboard.
    *   Use an **Employee ID** (`EMP001`) to access the Employee Dashboard.
3.  **Clock In (Employee)**:
    *   Go to the Employee Dashboard.
    *   Click **Clock In**.
    *   Take a selfie or upload a photo (metadata validation is currently relaxed for testing).
    *   Confirm to mark your attendance.

## Project Structure

*   `server.js`: Main entry point for the backend server.
*   `public/`: Contains all frontend files (HTML, CSS, JS).
    *   `index.html`: Login page.
    *   `admin.html` / `admin-script.js`: Admin portal.
    *   `employee.html` / `employee-script.js`: Employee portal.
*   `routes/`: API route definitions.
*   `controllers/`: Logic for handling API requests.
*   `models/`: Mongoose schemas for MongoDB.
*   `seed/`: Scripts to populate the database with initial data.
