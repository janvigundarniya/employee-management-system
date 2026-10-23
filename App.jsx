import React, { useEffect, useState } from 'react';

// The frontend sends every API request to the Express backend.
const API = 'http://localhost:5000/api';

// Empty form values are reused when adding or clearing an employee.
const blank = {
    emp_id: '',
    name: '',
    phone: '',
    email: '',
    department: '',
};

// This helper adds the login token and handles API errors in one place.
async function request(path, options = {}) {
    const token = localStorage.getItem('ems_token');

    const res = await fetch(API + path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.message || 'Request failed.');
    }

    return data;
}

export default function App() {
    // These state values control login, employee data, form status and messages.
    const [user, setUser] = useState(null);
    const [mode, setMode] = useState('login');
    const [auth, setAuth] = useState({ name: '', email: '', password: '' });
    const [employees, setEmployees] = useState([]);
    const [form, setForm] = useState(blank);
    const [editing, setEditing] = useState(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    // Load all records for an admin, or only the signed-in user's record.
    async function loadEmployees() {
        const data = await request('/employees');
        setEmployees(data.employees);

        if (user?.role !== 'admin' && data.employees[0] && !editing) {
            setForm({ ...blank, ...data.employees[0] });
        }
    }

    // Restore the saved login session when the page is refreshed.
    useEffect(() => {
        const token = localStorage.getItem('ems_token');

        if (token) {
            request('/auth/me')
                .then((data) => setUser(data.user))
                .catch(() => localStorage.removeItem('ems_token'));
        }
    }, []);

    // Fetch employee records after a user successfully logs in.
    useEffect(() => {
        if (user) {
            loadEmployees().catch((error) => setMessage(error.message));
        }
    }, [user]);

    // Register a new account or log in with an existing account.
    async function submitAuth(event) {
        event.preventDefault();
        setMessage('');
        setBusy(true);

        try {
            const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
            const data = await request(endpoint, {
                method: 'POST',
                body: JSON.stringify(auth),
            });

            localStorage.setItem('ems_token', data.token);
            setUser(data.user);
            setMessage(`Welcome, ${data.user.name}!`);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    // Clear local session data and return to the login screen.
    function logout() {
        localStorage.removeItem('ems_token');
        setUser(null);
        setEmployees([]);
        setForm(blank);
        setEditing(null);
        setMessage('');
    }

    // Copy a selected employee's details into the form for editing.
    function startEdit(employee) {
        setEditing(employee.id);
        setForm({
            emp_id: employee.emp_id,
            name: employee.name,
            phone: employee.phone,
            email: employee.email,
            department: employee.department,
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Reset the employee form and exit edit mode.
    function resetForm() {
        setForm(blank);
        setEditing(null);
    }

    // Save a new employee or update the selected employee record.
    async function submitEmployee(event) {
        event.preventDefault();
        setMessage('');
        setBusy(true);

        try {
            const data = await request(editing ? `/employees/${editing}` : '/employees', {
                method: editing ? 'PUT' : 'POST',
                body: JSON.stringify(form),
            });

            setMessage(editing ? 'Employee updated successfully.' : 'Employee added successfully.');
            resetForm();
            await loadEmployees();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    // Ask for confirmation before permanently deleting an employee record.
    async function deleteEmployee(employee) {
        const confirmed = window.confirm(
            `Delete employee ${employee.name} (${employee.emp_id})?`,
        );

        if (!confirmed) return;

        try {
            await request(`/employees/${employee.id}`, { method: 'DELETE' });
            setMessage('Employee deleted.');
            resetForm();
            await loadEmployees();
        } catch (error) {
            setMessage(error.message);
        }
    }

    // Show the login/register screen until a user is authenticated.
    if (!user) {
        return (
            <main className="auth-wrap">
                <section className="auth-card">
                    <div className="brand-mark">EMS</div>
                    <p className="eyebrow">WORKSPACE PORTAL</p>
                    <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
                    <p className="muted">Employee Management System</p>

                    <form onSubmit={submitAuth} className="stack">
                        {mode === 'register' && (
                            <label>
                                Full name
                                <input
                                    required
                                    minLength="2"
                                    value={auth.name}
                                    onChange={(event) => setAuth({ ...auth, name: event.target.value })}
                                    placeholder="Your name"
                                />
                            </label>
                        )}

                        <label>
                            Email address
                            <input
                                required
                                type="email"
                                value={auth.email}
                                onChange={(event) => setAuth({ ...auth, email: event.target.value })}
                                placeholder="you@company.com"
                            />
                        </label>

                        <label>
                            Password
                            <input
                                required
                                minLength="8"
                                type="password"
                                value={auth.password}
                                onChange={(event) => setAuth({ ...auth, password: event.target.value })}
                                placeholder="At least 8 characters"
                            />
                        </label>

                        <button disabled={busy}>
                            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>

                    {message && <p className="notice">{message}</p>}

                    <p className="switch">
                        {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
                        <button
                            className="link"
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setMessage('');
                            }}
                        >
                            {mode === 'login' ? 'Register' : 'Sign in'}
                        </button>
                    </p>

                    <p className="small muted">Admin login is configured by the backend environment file.</p>
                </section>
            </main>
        );
    }

    const isAdmin = user.role === 'admin';
    const ownEmployee = employees[0];

    // The dashboard changes its labels and available actions based on the user's role.
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="logo">
                    <span className="brand-mark small-mark">E</span>
                    <span>
                        People<span className="logo-light">Desk</span>
                    </span>
                </div>

                <div className="side-label">WORKSPACE</div>
                <div className="nav-item active">▦ &nbsp; Employees</div>

                <div className="side-bottom">
                    <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                    <div className="account">
                        <strong>{user.name}</strong>
                        <span>{isAdmin ? 'Administrator' : 'Employee user'}</span>
                    </div>
                    <button className="logout" onClick={logout} title="Sign out">
                        ↗
                    </button>
                </div>
            </aside>

            <main className="main-area">
                <header className="topbar">
                    <div>
                        <p className="eyebrow">PEOPLE OPERATIONS</p>
                        <h1>Employee Management</h1>
                    </div>
                    <div className="top-actions">
                        <span className={`role-pill ${isAdmin ? 'admin' : ''}`}>
                            {isAdmin ? 'ADMIN' : 'USER'}
                        </span>
                        <button className="outline" onClick={logout}>Sign out</button>
                    </div>
                </header>

                <section className="welcome">
                    <div>
                        <p className="eyebrow light">YOUR WORKSPACE</p>
                        <h2>{isAdmin ? 'Manage your team.' : `Hello, ${user.name.split(' ')[0]}.`}</h2>
                        <p>
                            {isAdmin
                                ? 'Create, update, and maintain employee records in one place.'
                                : 'Create and maintain your employee profile.'}
                        </p>
                    </div>
                    <div className="welcome-icon">✦</div>
                </section>

                {message && (
                    <div className="notice message">
                        {message}
                        <button onClick={() => setMessage('')}>×</button>
                    </div>
                )}

                {/* Summary cards calculate counts from the employee list. */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-icon">♙</span>
                        <span className="stat-label">{isAdmin ? 'Total employees' : 'Your profile'}</span>
                        <strong>{isAdmin ? employees.length : ownEmployee ? 'Active' : 'Not created'}</strong>
                        <small>{isAdmin ? 'Records in the system' : 'Profile status'}</small>
                    </div>

                    <div className="stat-card">
                        <span className="stat-icon purple">▤</span>
                        <span className="stat-label">Departments</span>
                        <strong>{new Set(employees.map((employee) => employee.department)).size}</strong>
                        <small>Unique department names</small>
                    </div>

                    <div className="stat-card">
                        <span className="stat-icon orange">✓</span>
                        <span className="stat-label">Access level</span>
                        <strong>{isAdmin ? 'Admin' : 'User'}</strong>
                        <small>Role-based permissions</small>
                    </div>
                </div>

                <section className="content-grid">
                    <div className="panel form-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="eyebrow">EMPLOYEE DETAILS</p>
                                <h3>
                                    {editing
                                        ? 'Edit employee'
                                        : isAdmin
                                          ? 'Add employee'
                                          : ownEmployee
                                            ? 'Update your profile'
                                            : 'Create your profile'}
                                </h3>
                            </div>
                            <span className="step">01</span>
                        </div>

                        <form onSubmit={submitEmployee} className="employee-form">
                            <label>
                                Employee ID
                                <input
                                    required
                                    pattern="[A-Za-z0-9_-]{2,30}"
                                    title="2–30 letters, numbers, underscore or hyphen"
                                    value={form.emp_id}
                                    onChange={(event) => setForm({ ...form, emp_id: event.target.value })}
                                    placeholder="e.g. EMP001"
                                />
                            </label>

                            <label>
                                Full name
                                <input
                                    required
                                    minLength="2"
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    placeholder="Employee name"
                                />
                            </label>

                            <label>
                                Phone number
                                <input
                                    required
                                    pattern="[+0-9 ()-]{7,20}"
                                    value={form.phone}
                                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                                    placeholder="+91 98765 43210"
                                />
                            </label>

                            <label>
                                Email address
                                <input
                                    required
                                    type="email"
                                    value={form.email}
                                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                                    placeholder="name@company.com"
                                />
                            </label>

                            <label className="full">
                                Department
                                <select
                                    required
                                    value={form.department}
                                    onChange={(event) => setForm({ ...form, department: event.target.value })}
                                >
                                    <option value="">Select department</option>
                                    {['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Design', 'Other'].map(
                                        (department) => (
                                            <option key={department}>{department}</option>
                                        ),
                                    )}
                                </select>
                            </label>

                            <div className="form-actions full">
                                <button disabled={busy}>
                                    {busy
                                        ? 'Saving…'
                                        : editing
                                          ? 'Save changes'
                                          : ownEmployee && !isAdmin
                                            ? 'Update profile'
                                            : 'Add employee'}
                                </button>
                                <button type="button" className="outline" onClick={resetForm}>
                                    Clear
                                </button>
                            </div>
                        </form>

                        <p className="hint">
                            Employee IDs must be unique. Department names can repeat across employees.
                        </p>
                    </div>

                    {/* These tips explain the main actions available to each role. */}
                    <div className="panel tips-panel">
                        <p className="eyebrow">QUICK GUIDE</p>
                        <h3>{isAdmin ? 'Admin controls' : 'Your profile'}</h3>

                        <div className="tip">
                            <span>01</span>
                            <div>
                                <strong>{isAdmin ? 'Create records' : 'Add your details'}</strong>
                                <p>
                                    {isAdmin
                                        ? 'Fill out the form and add a new employee.'
                                        : 'Create your employee record using a unique ID.'}
                                </p>
                            </div>
                        </div>

                        <div className="tip">
                            <span>02</span>
                            <div>
                                <strong>Keep data accurate</strong>
                                <p>Use a valid email, phone number, and department.</p>
                            </div>
                        </div>

                        <div className="tip">
                            <span>03</span>
                            <div>
                                <strong>Secure access</strong>
                                <p>
                                    {isAdmin
                                        ? 'Only admins can manage every employee.'
                                        : 'Your account can access only its linked profile.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="panel table-panel">
                    <div className="panel-heading">
                        <div>
                            <p className="eyebrow">DIRECTORY</p>
                            <h3>{isAdmin ? 'All employees' : 'Your employee record'}</h3>
                        </div>
                        <span className="count">
                            {employees.length} {employees.length === 1 ? 'record' : 'records'}
                        </span>
                    </div>

                    {/* Employee rows are rendered from the data returned by the backend. */}
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>EMPLOYEE</th>
                                    <th>EMP ID</th>
                                    <th>PHONE</th>
                                    <th>DEPARTMENT</th>
                                    <th>EMAIL</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td>
                                            <div className="person-cell">
                                                <span className="person-avatar">
                                                    {employee.name.slice(0, 1).toUpperCase()}
                                                </span>
                                                <strong>{employee.name}</strong>
                                            </div>
                                        </td>
                                        <td><span className="emp-code">{employee.emp_id}</span></td>
                                        <td>{employee.phone}</td>
                                        <td><span className="dept">{employee.department}</span></td>
                                        <td>{employee.email}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => startEdit(employee)}
                                                    title="Edit"
                                                >
                                                    Edit
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => deleteEmployee(employee)}
                                                        title="Delete"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {!employees.length && (
                                    <tr>
                                        <td colSpan="6" className="empty">
                                            No employee records yet. Fill in the form to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <footer>
                    PeopleDesk · Employee Management System
                    <span>React · Express · MySQL</span>
                </footer>
            </main>
        </div>
    );
}
