// backend/routes/ventas.js
const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/ventasController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.post('/',    verifyToken, requireRole('admin','cajero','cliente'), ctrl.registrarVenta);
router.get('/',     verifyToken, requireRole('admin','cajero'), ctrl.listarVentas);
router.get('/:id',  verifyToken, requireRole('admin','cajero'), ctrl.obtenerVenta);

module.exports = router;
