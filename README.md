# Employee Management System

A beginner-friendly CRUD project built with React, Node.js, Express, and MySQL.

## Requirements

- Node.js LTS: https://nodejs.org/
- MySQL Community Server and MySQL Workbench: https://dev.mysql.com/downloads/
- VS Code: https://code.visualstudio.com/

## 1. Create the database

Open MySQL Workbench and run `database/schema.sql`. This creates the `employee_management` database and the `users` and `employees` tables.

## 2. Start the backend

Open a VS Code terminal in the project folder and run:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env`. Update `DB_PASSWORD`, set a long random `JWT_SECRET`, and change the example admin password. Keep `.env` private.

```bash
npm run dev
```

The API should run at `http://localhost:5000`. Its health check is `http://localhost:5000/api/health`.

The first admin account is created from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env` when the backend starts for the first time.

## 3. Start the frontend

Open a **second terminal** and run:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal, usually `http://localhost:5173`.

## Features

- Register and sign in.
- Normal users can create and update their own employee profile.
- Admins can view, add, update, and delete employee records.
- Employee IDs must be unique; department names can repeat.
- Passwords are hashed, and protected API requests use JWT authentication.

## Learn the code

Open `CODE_GUIDE.md` for a simple explanation of the UI sections, CSS classes, React state, API endpoints, backend files, and database rules.

## Important

This is a learning starter project, not production-ready HR software. Before production use, add HTTPS, rate limiting, audit logs, password reset, and a proper security review. Never commit `.env` or share admin credentials.
