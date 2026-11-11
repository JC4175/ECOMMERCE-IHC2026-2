// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Verifica que la petición lleve un JWT válido en el header Authorization.
 * Adjunta los datos del usuario decodificados en req.user.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'minimarket_secret_key_2026');
    req.user = decoded; // { id, nombre, email, rol }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expirado. Inicia sesión nuevamente.' });
    }
    return res.status(401).json({ success: false, message: 'Token inválido.' });
  }
};

/**
 * Middleware de autorización por rol.
 * Uso: requireRole('admin', 'cajero')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado.' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Rol requerido: ${roles.join(' o ')}.`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };
