# Instructions to Run the Attendance Portal

To run this project on your computer, please follow these steps.

## 1. Prerequisites (Required Software)
Before starting, ensure you have the following installed:

1.  **Node.js**:
    *   Download and install from: [https://nodejs.org/](https://nodejs.org/)
    *   *Why?* This runs the application server.

2.  **MongoDB (Community Server)**:
    *   Download and install from: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
    *   *Why?* This is the database where employee and attendance data is stored.
    *   **Important**: During installation, choose "Run service as Network Service user" (default) and ensure "Install MongoDB Compass" is checked (optional but helpful).
    *   **Start MongoDB**: Usually, it starts automatically. If not, open a terminal and run `mongod`.

## 2. Setup the Project

1.  **Unzip the folder** containing the project files.
2.  Open the folder named `backend`.
3.  **Open a Terminal**:
    *   Right-click inside the folder > "Open in Terminal" OR
    *   Type `cmd` in the folder address bar and press Enter.

4.  **Install Dependencies**:
    Run this command to download the necessary libraries:
    ```bash
    npm install
    ```

5.  **Seed the Database (Create Admin/Users)**:
    *   *Note: Since this is a new computer, the database will be empty.*
    *   Run this command to create the initial Admin and Employee accounts:
    ```bash
    npm run seed
    ```
    *   *You should see a message like "Data Imported" or "Seed Successful".*

## 3. Run the Application

In the terminal, run:
```bash
npm run dev
```
You should see:
> Server running on port 4000
> MongoDB Connected...

## 4. Open in Browser

Open Chrome or Edge and go to:
**[http://localhost:4000](http://localhost:4000)**

---

## Logins (Default Credentials)

**Admin:**
*   **User ID**: `admin` or see `seed/seed.js`
*   **Password**: `admin123` (or as defined in seed file)

**Employee:**
*   **User ID**: `EMP001`
*   **Password**: `password123`

---

## Troubleshooting

- **"MongoNetworkError"**: This means the database isn't running. Ensure MongoDB is installed and the service is started.
- **"Command not found"**: Ensure Node.js is installed and you restarted your computer/terminal after installation.
