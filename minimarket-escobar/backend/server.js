// backend/server.js
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');

const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (Postman, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

// ── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── RUTAS ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/productos',   require('./routes/productos'));
app.use('/api/categorias',  require('./routes/categorias'));
app.use('/api/ventas',      require('./routes/ventas'));
app.use('/api/pedidos',     require('./routes/pedidos'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/promociones', require('./routes/promociones'));
app.use('/api/devoluciones',require('./routes/devoluciones'));
app.use('/api/recetas',     require('./routes/recetas'));
app.use('/api/reportes',    require('./routes/reportes'));
app.use('/api/delivery',    require('./routes/delivery'));
app.use('/api/apertura',    require('./routes/apertura'));

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Minimarket Escobar API running 🟢', ts: new Date() });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Ruta no encontrada: ${req.originalUrl}` });
});

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Error interno del servidor.',
  });
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Minimarket Escobar API → http://localhost:${PORT}`);
});

module.exports = app;
