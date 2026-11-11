// backend/controllers/ventasController.js
const pool = require('../config/db');

/**
 * Calcula el descuento de una promoción activa para un producto.
 * Retorna el precio final con descuento y el monto descontado.
 */
async function getPrecioConPromo(conn, productoId, precioVenta) {
  const [promos] = await conn.query(`
    SELECT tipo, valor FROM promociones
    WHERE producto_id = ? AND activo = 1
      AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
      AND (cantidad_maxima IS NULL OR cantidad_usada < cantidad_maxima)
    LIMIT 1
  `, [productoId]);

  if (!promos.length) return { precio: precioVenta, descuento: 0, promoId: null };

  const p = promos[0];
  let descuento = 0;
  if (p.tipo === 'porcentaje') descuento = +(precioVenta * p.valor / 100).toFixed(2);
  if (p.tipo === 'monto')      descuento = Math.min(+p.valor, precioVenta);

  return { precio: +(precioVenta - descuento).toFixed(2), descuento, promoId: promos[0].id ?? null };
}

// ── POST /api/ventas ─────────────────────────────────────────────────────────
const registrarVenta = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      cliente_id,
      tipo        = 'presencial',
      metodo_pago,
      items,         // [{ producto_id, cantidad }]
      notas,
    } = req.body;

    if (!metodo_pago || !items || !items.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'metodo_pago e items son requeridos.' });
    }

    const metodosValidos = ['efectivo','yape','plin','tarjeta'];
    if (!metodosValidos.includes(metodo_pago)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Método de pago inválido.' });
    }

    // --- Verificar cliente para productos con restricción de edad ---
    let clienteMayorEdad = null;
    if (cliente_id) {
      const [cliRows] = await conn.query('SELECT fecha_nacimiento FROM usuarios WHERE id = ?', [cliente_id]);
      if (cliRows.length && cliRows[0].fecha_nacimiento) {
        const hoy  = new Date();
        const nac  = new Date(cliRows[0].fecha_nacimiento);
        const edad = Math.floor((hoy - nac) / (1000 * 60 * 60 * 24 * 365.25));
        clienteMayorEdad = edad >= 18;
      }
    }

    let subtotalTotal = 0;
    let descuentoTotal = 0;
    const itemsProc = [];

    for (const item of items) {
      const { producto_id, cantidad } = item;
      if (!producto_id || !cantidad || cantidad <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Cada ítem necesita producto_id y cantidad > 0.' });
      }

      // Bloquear con FOR UPDATE para concurrencia
      const [prodRows] = await conn.query(
        'SELECT id, nombre, precio_venta, stock, fecha_vencimiento, restringido_edad, activo FROM productos WHERE id = ? FOR UPDATE',
        [producto_id]
      );

      if (!prodRows.length || !prodRows[0].activo) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Producto ${producto_id} no encontrado.` });
      }

      const prod = prodRows[0];

      // RN07: Bloquear venta de productos vencidos
      if (prod.fecha_vencimiento && new Date(prod.fecha_vencimiento) < new Date()) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `El producto "${prod.nombre}" está vencido y no puede venderse.`,
        });
      }

      // RN01: No agregar sin stock
      if (prod.stock < cantidad) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}.`,
        });
      }

      // RN06: Verificar edad para productos restringidos
      if (prod.restringido_edad) {
        if (cliente_id && clienteMayorEdad === false) {
          await conn.rollback();
          return res.status(403).json({
            success: false,
            message: `El producto "${prod.nombre}" requiere mayoría de edad (18+).`,
          });
        }
      }

      const { precio, descuento, promoId } = await getPrecioConPromo(conn, producto_id, +prod.precio_venta);
      const subtotal = +(precio * cantidad).toFixed(2);
      const descItem = +(descuento * cantidad).toFixed(2);

      subtotalTotal  += +(+prod.precio_venta * cantidad).toFixed(2);
      descuentoTotal += descItem;

      itemsProc.push({
        producto_id,
        nombre: prod.nombre,
        cantidad,
        precio_unitario: +prod.precio_venta,
        descuento: descuento,
        subtotal,
        promoId,
        stock_actual: prod.stock,
        stock_minimo: prod.stock_minimo || 5,
      });
    }

    const total = +(subtotalTotal - descuentoTotal).toFixed(2);
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora  = ahora.toTimeString().split(' ')[0];

    // Insertar venta
    const [ventaResult] = await conn.query(`
      INSERT INTO ventas (usuario_id, cliente_id, tipo, fecha, hora, subtotal, descuento, total, metodo_pago, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, cliente_id || null, tipo, fecha, hora, subtotalTotal, descuentoTotal, total, metodo_pago, notas || null]);

    const ventaId = ventaResult.insertId;
    const alertasStock = [];

    for (const it of itemsProc) {
      // Insertar ítem
      await conn.query(`
        INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [ventaId, it.producto_id, it.cantidad, it.precio_unitario, it.descuento, it.subtotal]);

      // RF04: Descontar stock
      const nuevoStock = it.stock_actual - it.cantidad;
      await conn.query('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, it.producto_id]);

      // RF05: Alerta stock mínimo
      if (nuevoStock <= it.stock_minimo) {
        alertasStock.push({ producto_id: it.producto_id, nombre: it.nombre, stock: nuevoStock });
      }

      // Incrementar uso de promoción si aplica
      if (it.promoId) {
        await conn.query('UPDATE promociones SET cantidad_usada = cantidad_usada + 1 WHERE id = ?', [it.promoId]);
      }

      // RF18: Actualizar historial_compras_cliente
      if (cliente_id) {
        await conn.query(`
          INSERT INTO historial_compras_cliente (cliente_id, producto_id, cantidad_total_compras, ultima_compra)
          VALUES (?, ?, 1, NOW())
          ON DUPLICATE KEY UPDATE
            cantidad_total_compras = cantidad_total_compras + 1,
            ultima_compra = NOW()
        `, [cliente_id, it.producto_id]);
      }
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Venta registrada exitosamente.',
      ventaId,
      total,
      alertasStock: alertasStock.length ? alertasStock : undefined,
    });
  } catch (err) {
    await conn.rollback();
    console.error('[VENTAS/registrar]', err);
    return res.status(500).json({ success: false, message: 'Error interno al registrar venta.' });
  } finally {
    conn.release();
  }
};

// ── GET /api/ventas ──────────────────────────────────────────────────────────
const listarVentas = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, metodo_pago, page = 1, limit = 20 } = req.query;

    let where = [];
    const params = [];

    if (fecha_inicio) { where.push('v.fecha >= ?'); params.push(fecha_inicio); }
    if (fecha_fin)    { where.push('v.fecha <= ?'); params.push(fecha_fin); }
    if (metodo_pago)  { where.push('v.metodo_pago = ?'); params.push(metodo_pago); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(`
      SELECT v.*, u.nombre AS cajero_nombre, c.nombre AS cliente_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN usuarios c ON c.id = v.cliente_id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `, params);

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM ventas v ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    return res.json({ success: true, data: rows, total: countRows[0].total, page: parseInt(page) });
  } catch (err) {
    console.error('[VENTAS/listar]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── GET /api/ventas/:id ──────────────────────────────────────────────────────
const obtenerVenta = async (req, res) => {
  try {
    const [ventaRows] = await pool.query(`
      SELECT v.*, u.nombre AS cajero_nombre, c.nombre AS cliente_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      LEFT JOIN usuarios c ON c.id = v.cliente_id
      WHERE v.id = ?
    `, [req.params.id]);

    if (!ventaRows.length) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada.' });
    }

    const [items] = await pool.query(`
      SELECT vi.*, p.nombre AS producto_nombre, p.codigo_barras
      FROM venta_items vi
      JOIN productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = ?
    `, [req.params.id]);

    return res.json({ success: true, data: { ...ventaRows[0], items } });
  } catch (err) {
    console.error('[VENTAS/obtener]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

module.exports = { registrarVenta, listarVentas, obtenerVenta };
