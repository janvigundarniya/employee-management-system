# Employee Management System — Code and UI Guide

This guide explains which file controls each part of the website and how the main UI actions work.

## 1. Project folders

- `frontend/` contains the React screens and CSS design.
- `backend/` contains the Express API, login security, and MySQL connection.
- `database/schema.sql` creates the database and tables.
- `.env` stores local database credentials and admin setup values. Never share or upload it.

## 2. Understand the UI from top to bottom

### Login and registration page

File: `frontend/src/App.jsx`

- `mode` decides whether the form displays **Sign in** or **Create your account**.
- `auth` stores the name, email, and password typed into the form.
- `submitAuth()` sends the form to `/api/auth/login` or `/api/auth/register`.
- The returned token is stored in `localStorage` so the page can restore the session after refresh.

CSS: `frontend/src/styles.css`

- `.auth-wrap` centers the login card on the page.
- `.auth-card` controls the card width, padding, rounded corners, and shadow.
- `.stack` arranges the form fields vertically.

### Sidebar and top header

File: `frontend/src/App.jsx`

- `.sidebar` contains the PeopleDesk logo, navigation label, and signed-in account.
- `.topbar` shows the page title, role badge, and Sign out button.
- `isAdmin` checks whether the current account has the `admin` role.

CSS: `.sidebar`, `.logo`, `.topbar`, `.role-pill`, and `.side-bottom` style these areas.

### Welcome banner and summary cards

File: `frontend/src/App.jsx`

- `.welcome` displays a greeting and short explanation.
- `.stats-grid` contains summary cards.
- `employees.length` gives the employee count for an admin.
- `new Set(employees.map(...)).size` counts distinct department names.

CSS: `.welcome`, `.stats-grid`, and `.stat-card` control the appearance of these sections.

### Employee details form

File: `frontend/src/App.jsx`

- `form` stores the current employee field values.
- `submitEmployee()` calls the create or update API, depending on whether `editing` has an ID.
- `startEdit(employee)` copies a row's values into the form.
- `resetForm()` clears the form and exits edit mode.
- The HTML `required`, `type="email"`, `minLength`, and `pattern` attributes provide basic browser validation. The backend validates the data again.

Fields: Employee ID, Full name, Phone number, Email address, and Department.

CSS: `.employee-form`, `.form-panel`, `.form-actions`, and `.hint` style the form.

### Employee directory table

File: `frontend/src/App.jsx`

- `employees.map(...)` creates one table row for every record returned by the backend.
- The Edit button calls `startEdit(employee)`.
- The Delete button calls `deleteEmployee(employee)` and asks for confirmation first.
- The Delete button is displayed only for an admin.
- If there are no records, the table displays a helpful empty-state message.

CSS: `.table-panel`, `.table-scroll`, `table`, `.person-cell`, `.row-actions`, and `.empty` style the directory.

## 3. How the frontend talks to the backend

File: `frontend/src/App.jsx`

The `request()` helper sends HTTP requests to `http://localhost:5000/api`. When a token exists, it adds the `Authorization: Bearer ...` header. It also converts unsuccessful API responses into readable error messages.

| Action | API endpoint | Purpose |
|---|---|---|
| Register | `POST /api/auth/register` | Create a normal user account |
| Login | `POST /api/auth/login` | Verify credentials and return a token |
| Restore session | `GET /api/auth/me` | Check the current login token |
| View employees | `GET /api/employees` | Return records allowed for the current role |
| Add employee | `POST /api/employees` | Create a record |
| Edit employee | `PUT /api/employees/:id` | Update a record |
| Delete employee | `DELETE /api/employees/:id` | Delete a record |

## 4. Backend files

- `backend/server.js`: API routes, input validation, login/register logic, employee CRUD, and initial admin creation.
- `backend/middleware.js`: verifies JWT login tokens and contains an admin-only access check.
- `backend/db.js`: creates the reusable MySQL connection pool.
- `backend/.env.example`: sample configuration. Copy it to `.env` and fill in your local settings.

## 5. Database rules

File: `database/schema.sql`

- `users` stores account details and a hashed password.
- `employees` stores employee ID, name, phone, email, department, and optional account link.
- `emp_id` is `UNIQUE`, so two employees cannot share the same employee ID.
- `department` is indexed but not unique, so many employees can be in IT, HR, or another department.
- `user_id` is unique when present, so a normal user can have one linked employee profile in this starter project.

## 6. Run and check the project

1. Run `database/schema.sql` in MySQL Workbench.
2. In a terminal, run `cd backend`, `npm install`, configure `.env`, then `npm run dev`.
3. In a second terminal, run `cd frontend`, `npm install`, then `npm run dev`.
4. Open the local URL printed by Vite, usually `http://localhost:5173`.
5. If the page opens but data does not load, check that MySQL is running, `.env` is correct, and the backend terminal shows `API running at http://localhost:5000`.

The build and database connection depend on installed npm packages and a running local MySQL server. Test those on your computer after installation; never use real employee data until the project has had a proper security review.
