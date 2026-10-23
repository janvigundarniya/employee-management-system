// Use MySQL's promise API so database queries can be awaited.
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// A connection pool reuses connections instead of opening one per request.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'employee_management',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});
export default pool;
