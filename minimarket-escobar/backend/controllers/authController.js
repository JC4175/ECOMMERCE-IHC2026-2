// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

const JWT_SECRET  = process.env.JWT_SECRET  || 'minimarket_secret_key_2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña requeridos.' });
    }

    const [rows] = await pool.query(
      'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    const user = rows[0];

    if (!user.activo) {
      return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    const payload = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.json({
      success: true,
      message: 'Login exitoso.',
      token,
      user: payload,
    });
  } catch (err) {
    console.error('[AUTH/login]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── POST /api/auth/register ──────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { nombre, email, password, fecha_nacimiento, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos.' });
    }

    // Verificar email único
    const [exists] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
    if (exists.length) {
      return res.status(409).json({ success: false, message: 'El email ya está registrado.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, fecha_nacimiento, telefono)
       VALUES (?, ?, ?, 'cliente', ?, ?)`,
      [nombre.trim(), email.toLowerCase().trim(), hash, fecha_nacimiento || null, telefono || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente.',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('[AUTH/register]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
const me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, email, rol, fecha_nacimiento, telefono, activo, created_at FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('[AUTH/me]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

module.exports = { login, register, me };
