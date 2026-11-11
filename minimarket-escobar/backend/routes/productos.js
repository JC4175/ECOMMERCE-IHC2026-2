// backend/routes/productos.js
const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/productosController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Alertas (admin/almacen) — antes que /:id para no colisionar
router.get('/alertas/stock',        verifyToken, requireRole('admin','almacen'), ctrl.alertasStock);
router.get('/alertas/vencimientos', verifyToken, requireRole('admin','almacen'), ctrl.alertasVencimientos);

// Listado público (clientes no logueados también pueden ver productos)
router.get('/',    ctrl.listarProductos);
router.get('/:id', ctrl.obtenerProducto);

// CRUD protegido (admin)
router.post('/',    verifyToken, requireRole('admin'), ctrl.crearProducto);
router.put('/:id',  verifyToken, requireRole('admin','almacen'), ctrl.actualizarProducto);
router.delete('/:id', verifyToken, requireRole('admin'), ctrl.desactivarProducto);

module.exports = router;
