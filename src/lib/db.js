import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '82.25.69.143',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'Portes@2025!@',
  database: process.env.DB_NAME || 'auditaai',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool; 