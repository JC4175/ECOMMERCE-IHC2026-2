// backend/config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'minimarket_escobar',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '-05:00', // Lima, Perú
});

// Verificar conexión al iniciar
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida.');
    conn.release();
  } catch (err) {
    console.error('❌ Error al conectar a MySQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;
