const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

// Add these at the top
const jwt = require('jsonwebtoken'); 
const JWT_SECRET = 'your_super_secret_key_123'; 

// --- SIGNUP ROUTE (PLAIN TEXT) ---
app.post('/api/auth/signup', async (req, res) => {
  const { full_name, phone_number, password, role, class_id } = req.body;
  
  try {
    // We are no longer hashing the password. We save it raw.
    const result = await pool.query(
      "INSERT INTO users (full_name, phone_number, password_hash, role, class_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, role",
      [full_name, phone_number, password, role, class_id || null]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "User already exists or database error" });
  }
});

// --- LOGIN ROUTE (PLAIN TEXT) ---
app.post('/api/auth/login', async (req, res) => {
  console.log("--- Login Request Received ---");
  const { phone_number, password } = req.body;

  let cleanPhone = phone_number.replace(/\D/g, '');
  if (cleanPhone.startsWith('03')) cleanPhone = '92' + cleanPhone.substring(1);
  console.log("Searching DB for:", cleanPhone);

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE phone_number = $1", [cleanPhone]);
    
    if (userResult.rows.length === 0) {
      console.log("❌ Result: User not found");
      return res.status(401).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // SIMPLE COMPARISON: No bcrypt, just matching the strings
    if (password !== user.password_hash) {
      console.log("❌ Result: Password mismatch");
      return res.status(401).json({ error: "Wrong password" });
    }

    console.log("✅ Result: Login Successful for", user.full_name);
    const token = jwt.sign({ id: user.id, role: user.role, class_id: user.class_id }, JWT_SECRET);
    res.json({ 
        success: true, 
        token, 
        role: user.role, 
        full_name: user.full_name,
        id: user.id,
        class_id: user.class_id 
    });

  } catch (err) {
    console.error("🔥 Server Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// WhatsApp Setup
async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (up) => {
    if(up.connection === 'open') console.log("WhatsApp Ready! ✅");
  });
  return sock;
}
const wa = startWA();

// --- TEACHER MANAGEMENT ROUTES (NEW TASK) ---
app.post('/api/teachers/register', async (req, res) => {
  let { full_name, phone_number, class_id, password } = req.body;

  // --- FIXED: PHONE NORMALIZATION FOR TEACHERS ---
  phone_number = phone_number.replace(/\D/g, ''); 
  if (phone_number.startsWith('0')) {
    phone_number = '92' + phone_number.substring(1);
  } else if (phone_number.startsWith('3') && phone_number.length === 10) {
    phone_number = '92' + phone_number;
  }
  // ----------------------------------------------

  try {
    const result = await pool.query(
      "INSERT INTO users (full_name, phone_number, password_hash, role, class_id) VALUES ($1, $2, $3, 'teacher', $4) RETURNING *",
      [full_name, phone_number, password || 'teacher123', class_id]
    );
    res.json({ success: true, teacher: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to add teacher" });
  }
});

app.get('/api/teachers', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, full_name, phone_number, class_id FROM users WHERE role = 'teacher'");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// --- SMART STUDENT ROUTE ---
app.get('/api/students', async (req, res) => {
  const { classId } = req.query; 
  try {
    let result;
    if (classId) {
      result = await pool.query(
        'SELECT * FROM users WHERE role = $1 AND class_id = $2', 
        ['student', classId]
      );
    } else {
      result = await pool.query('SELECT * FROM users WHERE role = $1', ['student']);
    }
    res.json(result.rows);
  } catch (err) {
    console.error("Database Error:", err.message);
    res.status(500).json({ error: "Database query failed" });
  }
});

// --- STUDENT REGISTRATION ---
app.post('/api/students/register', async (req, res) => {
  let { full_name, phone_number, class_id } = req.body;

  phone_number = phone_number.replace(/\D/g, ''); 
  if (phone_number.startsWith('03')) {
    phone_number = '92' + phone_number.substring(1);
  } else if (phone_number.startsWith('3')) {
    phone_number = '92' + phone_number;
  }

  // Assign a default password so students can login immediately
  const defaultPassword = "123"; 

  try {
    const result = await pool.query(
      "INSERT INTO users (full_name, phone_number, password_hash, role, class_id) VALUES ($1, $2, $3, 'student', $4) RETURNING *",
      [full_name, phone_number, defaultPassword, class_id]
    );
    res.json({ success: true, student: result.rows[0] });
  } catch (err) {
    console.error("Registration Error:", err.message);
    res.status(500).json({ error: "Failed to register student." });
  }
});

// --- DELETE STUDENT (RE-POSITIONED & CORRECTED) ---
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // We must delete dependent records first because of Foreign Key constraints
    await pool.query("DELETE FROM attendance WHERE student_id = $1", [id]);
    await pool.query("DELETE FROM fees WHERE student_id = $1", [id]);
    
    // Now we can safely delete the student
    const result = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'student'", [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ error: "Failed to delete student. Check database constraints." });
  }
});

// --- NEW: FETCH LOGGED-IN STUDENT'S DATA ---
app.get('/api/student/my-data', async (req, res) => {
    const { studentId, classId } = req.query;
    try {
      // Fetch attendance for the specific student
      const attendance = await pool.query(
          "SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC", 
          [studentId]
      );
      // Fetch diary entries for the specific class the student belongs to
      const diary = await pool.query(
          "SELECT * FROM diary WHERE class_id = $1 ORDER BY created_at DESC", 
          [classId]
      );
      
      res.json({
        attendance: attendance.rows,
        diary: diary.rows
      });
    } catch (err) {
      console.error("Student Data Error:", err.message);
      res.status(500).json({ error: "Could not fetch student data" });
    }
  });

// --- ATTENDANCE MARKING ---
app.post('/api/attendance', async (req, res) => {
  const { studentId, status, date, userRole } = req.body; // Added userRole for privilege check
  
  // PRIVILEGE CHECK
  if (userRole === 'student') return res.status(403).json({ error: "Students cannot mark attendance" });

  const attendanceDate = date || new Date().toISOString().split('T')[0];

  try {
    // Check student's admission date
    const studentCheck = await pool.query("SELECT created_at FROM users WHERE id = $1", [studentId]);
    
    if (studentCheck.rows.length > 0) {
      const admissionDate = new Date(studentCheck.rows[0].created_at).toISOString().split('T')[0];
      
      if (attendanceDate < admissionDate) {
        return res.status(400).json({ error: "Cannot mark attendance before admission date" });
      }
    }

    await pool.query(
      "INSERT INTO attendance (student_id, status, date) VALUES ($1, $2, $3) ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status",
      [studentId, status, attendanceDate]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Attendance Error:', err.message);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});


app.get('/api/attendance/status', async (req, res) => {
  const { classId, date } = req.query;
  try {
    const result = await pool.query(
      "SELECT student_id, status FROM attendance WHERE date = $1 AND student_id IN (SELECT id FROM users WHERE class_id = $2)",
      [date, classId]
    );
    // Returns an object like { "student_1": "Present", "student_2": "Absent" }
    const statusMap = {};
    result.rows.forEach(row => {
      statusMap[row.student_id] = row.status;
    });
    res.json(statusMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// --- students resetting password
// --- STUDENT: CHANGE PASSWORD ---
// UPDATED: Now supports password for everyone and phone for Admin/Teachers only
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, newPassword, newPhone, editorRole } = req.body;
  try {
    if (newPhone && editorRole === 'student') {
        return res.status(403).json({ error: "Students cannot change phone numbers" });
    }

    if (newPassword && newPhone) {
        await pool.query("UPDATE users SET password_hash = $1, phone_number = $2 WHERE id = $3", [newPassword, newPhone, userId]);
    } else if (newPassword) {
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newPassword, userId]);
    } else if (newPhone) {
        await pool.query("UPDATE users SET phone_number = $1 WHERE id = $2", [newPhone, userId]);
    }

    res.json({ success: true, message: "Profile updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// --- CLASSES ROUTES ---
app.get('/api/classes', async (req, res) => {
  const result = await pool.query("SELECT * FROM classes ORDER BY class_grade ASC");
  res.json(result.rows);
});

app.post('/api/classes', async (req, res) => {
  const { class_grade, section } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO classes (class_grade, section) VALUES ($1, $2) RETURNING *", 
      [class_grade, section]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create Class Error:', err.message);
    res.status(500).json({ error: "Class already exists or database error" });
  }
});


app.get('/api/fees/status', async (req, res) => {
  const { classId, month } = req.query;
  console.log(`Checking fees for Class: ${classId}, Month: ${month}`);

  if (!classId || !month) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const result = await pool.query(
      "SELECT student_id FROM fees WHERE month_name = $1 AND student_id IN (SELECT id FROM users WHERE class_id = $2)",
      [month, classId]
    );
    
    // Sends back an array of student IDs who have already paid
    const paidIds = result.rows.map(row => row.student_id);
    res.json(paidIds);
  } catch (err) {
    console.error("Fee Status Error:", err.message);
    res.status(500).json({ error: "Database query failed" });
  }
});

// --- FEE MANAGEMENT ---
app.post('/api/fees/submit', async (req, res) => {
  const { student_id, amount, month_name, userRole } = req.body; // Added userRole
  
  // PRIVILEGE CHECK: ONLY ADMIN
  if (userRole !== 'admin') return res.status(403).json({ error: "Only Admin can submit fees" });

  const receipt_no = `REC-${Date.now()}`;
  try {
    const result = await pool.query(
      "INSERT INTO fees (student_id, amount, month_name, receipt_no) VALUES ($1, $2, $3, $4) RETURNING *",
      [student_id, amount, month_name, receipt_no]
    );
    res.json({ success: true, message: "Fee submitted successfully!", data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error during fee entry" });
  }
});


// --- NEW: FETCH STUDENT'S COMPLETE FEE HISTORY ---
app.get('/api/student/my-fees', async (req, res) => {
  const { studentId } = req.query;
  try {
    const result = await pool.query(
        "SELECT month_name, amount, receipt_no, created_at FROM fees WHERE student_id = $1 ORDER BY created_at DESC", 
        [studentId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch fee history" });
  }
});


// --- DAILY DIARY & BULK WHATSAPP ---
app.post('/api/diary/post', async (req, res) => {
  const { classId, content, userRole } = req.body; // Added userRole
  
  // PRIVILEGE CHECK: STUDENTS CANNOT SEND DIARIES
  if (userRole === 'student') return res.status(403).json({ error: "Students cannot post diaries" });

  try {
    await pool.query("INSERT INTO diary (class_id, content) VALUES ($1, $2)", [classId, content]);
    const students = await pool.query("SELECT phone_number FROM users WHERE class_id = $1", [classId]);

    // Optional: Only send if WA is active
    // const socket = await wa; 
    
    res.json({ success: true, message: "Diary updated!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to post diary" });
  }
});





// --- FIXED: TEACHER DELETE ROUTE ---
app.delete('/api/teachers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "DELETE FROM users WHERE id = $1 AND role = 'teacher'", 
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Teacher not found" });
        }

        res.json({ success: true, message: "Teacher deleted successfully" });
    } catch (err) {
        console.error("Delete Teacher Error:", err.message);
        res.status(500).json({ error: "Database error during deletion" });
    }
});

// --- SERVER START ---
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});