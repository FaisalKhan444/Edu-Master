# 🎓 EduMaster Pro

### Modern Full-Stack School Management System

EduMaster Pro is a modern **School Management System** designed to
simplify academic administration for the 2026 educational environment.\
It connects administrators, teachers, and parents through real-time data
management, attendance automation, fee tracking, and WhatsApp
notifications.

------------------------------------------------------------------------

# ✨ Features

## 📝 Smart Attendance System

-   Monthly attendance tracking for each class
-   Present / Absent / Leave status with instant saving
-   Persistent records that remain after refresh
-   Class and section filtering
-   Easy monitoring for teachers and administrators

------------------------------------------------------------------------

## 💰 Dynamic Fee Management

-   Automated fee ledger for every student
-   Paid / Unpaid payment status toggle
-   Custom fee adjustments for scholarships or discounts
-   Month‑wise fee records
-   Financial overview for school administrators

------------------------------------------------------------------------

## 📔 Academic Communication

-   Daily diary system for homework and class updates
-   Announcement posting for students
-   Parent notifications through WhatsApp
-   Bulk messaging using Baileys API

------------------------------------------------------------------------

# 🧩 System Architecture

Frontend (React.js) \| \| API Requests v Backend (Node.js + Express) \|
\| Database Queries v PostgreSQL Database \| v WhatsApp Notification
Service (Baileys)

------------------------------------------------------------------------

# 🛠 Tech Stack

  Layer            Technology
  ---------------- --------------------------------
  Frontend         React.js, Axios, Modern CSS
  Backend          Node.js, Express.js
  Database         PostgreSQL (Supabase or Local)
  Authentication   JWT
  Messaging        Baileys WhatsApp API

------------------------------------------------------------------------

# 📂 Project Structure

school_management/

frontend/ → React UI\
src/\
App.js → Main Router\
AttendanceView.js → Attendance System\
FeeView.js → Fee Management\
ClassesView.js → Class Management

backend/ → Express API\
index.js → Main Server\
db.js → Database Configuration\
auth_info/ → WhatsApp Session Data

------------------------------------------------------------------------

# Backend Setup

cd backend

npm install

node index.js

------------------------------------------------------------------------

# Frontend Setup

cd frontend

npm install

npm start

App runs on: http://localhost:3000

------------------------------------------------------------------------

# 📱 WhatsApp Integration

EduMaster Pro integrates WhatsApp messaging using **Baileys API**.

Steps:

1.  Start backend server
2.  Scan QR code displayed in terminal
3.  Session automatically saved in:

backend/auth_info/

------------------------------------------------------------------------

# 🚀 Future Improvements

-   Student performance analytics dashboard
-   AI attendance insights
-   Mobile application version
-   Automatic fee receipt generation
-   Push notification support
-   Multi-school SaaS platform

------------------------------------------------------------------------

# 🤝 Contributing

1.  Fork the repository
2.  Create a feature branch

git checkout -b feature-new

3.  Commit changes

git commit -m "Added new feature"

4.  Push branch

git push origin feature-new

5.  Open a Pull Request

----------------------------------------------------------

# 👨‍💻 Author

Developed for modern schools to simplify academic management.

If you find this project useful, please consider ⭐ starring the
repository.
