// Express defines the REST API; the other imports handle security and MySQL.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { authenticate, adminOnly } from './middleware.js';

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Shared email validation and JWT creation helpers.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenFor = (u) => jwt.sign(
  { id: u.id, name: u.name, email: u.email, role: u.role },
  process.env.JWT_SECRET, { expiresIn: '8h' }
);

// Create the first admin account from .env when it does not already exist.
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; admin seeding skipped.');
    return;
  }
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (!existing.length) {
    const hash = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      [process.env.ADMIN_NAME || 'Admin', email, hash, 'admin']
    );
    console.log(`Initial admin created for ${email}. Change the password before use.`);
  }
}

// A simple endpoint helps confirm that the backend process is running.
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Registration always creates a normal user, never an admin account.
app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || !emailPattern.test(email) || password.length < 8)
      return res.status(400).json({ message: 'Enter a name, valid email, and password of at least 8 characters.' });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      [name, email, hash, 'user']
    );
    const user = { id: result.insertId, name, email, role: 'user' };
    res.status(201).json({ token: tokenFor(user), user });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This email is already registered.' });
    }

    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Login checks the password hash and returns a signed session token.
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ message: 'Incorrect email or password.' });
    const u = rows[0];
    const user = { id: u.id, name: u.name, email: u.email, role: u.role };
    res.json({ token: tokenFor(user), user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const [rows] = await pool.execute('SELECT id,name,email,role FROM users WHERE id=?', [req.auth.id]);
  if (!rows.length) return res.status(401).json({ message: 'User no longer exists.' });
  res.json({ user: rows[0] });
});

// Validate employee fields on the server before saving anything to MySQL.
function validateEmployee(body) {
  const emp_id = String(body.emp_id || '').trim();
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const department = String(body.department || '').trim();
  if (!emp_id || !/^[A-Za-z0-9_-]{2,30}$/.test(emp_id))
    return { error: 'Employee ID must be 2–30 letters, numbers, _ or -.' };
  if (name.length < 2) return { error: 'Name must contain at least 2 characters.' };
  if (!/^[+0-9 ()-]{7,20}$/.test(phone)) return { error: 'Enter a valid phone number.' };
  if (!emailPattern.test(email)) return { error: 'Enter a valid email address.' };
  if (!department) return { error: 'Department is required.' };
  return { value: { emp_id, name, phone, email, department } };
}

// Admins see all records; normal users see only their own linked record.
app.get('/api/employees', authenticate, async (req, res) => {
  try {
    // Use separate queries to keep each role's data access clear.
    const [rows] = req.auth.role === 'admin'
      ? await pool.execute(
          'SELECT e.*, u.email AS account_email FROM employees e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.id DESC',
        )
      : await pool.execute(
          'SELECT * FROM employees WHERE user_id=? ORDER BY id DESC',
          [req.auth.id],
        );
    res.json({ employees: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create an employee record while enforcing profile and ID uniqueness.
app.post('/api/employees', authenticate, async (req, res) => {
  const checked = validateEmployee(req.body);
  if (checked.error) return res.status(400).json({ message: checked.error });
  try {
    const userId = req.auth.role === 'admin' && req.body.user_id ? Number(req.body.user_id) : req.auth.id;
    if (req.auth.role !== 'admin') {
      const [own] = await pool.execute('SELECT id FROM employees WHERE user_id=?', [req.auth.id]);
      if (own.length) return res.status(409).json({ message: 'Your employee profile already exists. Edit it instead.' });
    }
    const { emp_id, name, phone, email, department } = checked.value;
    const [result] = await pool.execute(
      'INSERT INTO employees (emp_id,user_id,name,phone,email,department) VALUES (?,?,?,?,?,?)',
      [emp_id, userId, name, phone, email, department]
    );
    const [rows] = await pool.execute('SELECT * FROM employees WHERE id=?', [result.insertId]);
    res.status(201).json({ employee: rows[0] });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Employee ID or linked user profile already exists.',
      });
    }

    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update a record only when the requester owns it or is an admin.
app.put('/api/employees/:id', authenticate, async (req, res) => {
  const checked = validateEmployee(req.body);
  if (checked.error) return res.status(400).json({ message: checked.error });
  try {
    const [found] = await pool.execute('SELECT * FROM employees WHERE id=?', [req.params.id]);
    if (!found.length) return res.status(404).json({ message: 'Employee not found.' });
    if (req.auth.role !== 'admin' && found[0].user_id !== req.auth.id)
      return res.status(403).json({ message: 'You can only edit your own profile.' });
    const { emp_id, name, phone, email, department } = checked.value;
    await pool.execute(
      'UPDATE employees SET emp_id=?,name=?,phone=?,email=?,department=? WHERE id=?',
      [emp_id, name, phone, email, department, req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM employees WHERE id=?', [req.params.id]);
    res.json({ employee: rows[0] });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Employee ID is already used.' });
    }

    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete a record only when the requester owns it or is an admin.
app.delete('/api/employees/:id', authenticate, async (req, res) => {
  try {
    const [found] = await pool.execute('SELECT * FROM employees WHERE id=?', [req.params.id]);
    if (!found.length) return res.status(404).json({ message: 'Employee not found.' });
    if (req.auth.role !== 'admin' && found[0].user_id !== req.auth.id)
      return res.status(403).json({ message: 'You can only delete your own profile.' });
    await pool.execute('DELETE FROM employees WHERE id=?', [req.params.id]);
    res.json({ message: 'Employee deleted.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Check the database and seed the admin before starting the API server.
const port = Number(process.env.PORT || 5000);
try {
  await seedAdmin();
  app.listen(port, () => console.log(`API running at http://localhost:${port}`));
} catch (e) {
  console.error('Could not start backend. Check MySQL service and .env settings.', e.message);
  process.exit(1);
}
