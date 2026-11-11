// backend/controllers/productosController.js
const pool = require('../config/db');

// ── GET /api/productos ───────────────────────────────────────────────────────
const listarProductos = async (req, res) => {
  try {
    const {
      categoria,
      busqueda,
      solo_stock      = 'true',
      solo_no_vencidos = 'true',
      proveedor,
      page  = 1,
      limit = 50,
    } = req.query;

    let where = ['p.activo = 1'];
    const params = [];

    if (solo_stock === 'true')       { where.push('p.stock > 0'); }
    if (solo_no_vencidos === 'true') {
      where.push('(p.fecha_vencimiento IS NULL OR p.fecha_vencimiento >= CURDATE())');
    }
    if (categoria)   { where.push('p.categoria_id = ?');  params.push(categoria); }
    if (proveedor)   { where.push('p.proveedor_id = ?');  params.push(proveedor); }
    if (busqueda) {
      where.push('(p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.marca LIKE ?)');
      const q = `%${busqueda}%`;
      params.push(q, q, q);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Promoción activa vigente
    const sql = `
      SELECT
        p.*,
        c.nombre AS categoria_nombre,
        pv.nombre AS proveedor_nombre,
        pr.id     AS promo_id,
        pr.nombre AS promo_nombre,
        pr.tipo   AS promo_tipo,
        pr.valor  AS promo_valor,
        CASE
          WHEN pr.tipo = 'porcentaje' THEN ROUND(p.precio_venta * (1 - pr.valor / 100), 2)
          WHEN pr.tipo = 'monto'      THEN ROUND(p.precio_venta - pr.valor, 2)
          ELSE p.precio_venta
        END AS precio_con_promo
      FROM productos p
      LEFT JOIN categorias c  ON c.id  = p.categoria_id
      LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
      LEFT JOIN promociones pr ON pr.producto_id = p.id
        AND pr.activo = 1
        AND pr.fecha_inicio <= CURDATE()
        AND pr.fecha_fin    >= CURDATE()
        AND (pr.cantidad_maxima IS NULL OR pr.cantidad_usada < pr.cantidad_maxima)
      ${whereClause}
      ORDER BY p.nombre ASC
      LIMIT ? OFFSET ?
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);

    // Total sin paginación
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM productos p ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    return res.json({
      success: true,
      data: rows,
      total: countRows[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('[PRODUCTOS/listar]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── GET /api/productos/alertas/stock ────────────────────────────────────────
const alertasStock = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.nombre, p.codigo_barras, p.stock, p.stock_minimo,
             c.nombre AS categoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.activo = 1 AND p.stock <= p.stock_minimo
      ORDER BY p.stock ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[PRODUCTOS/alertas-stock]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── GET /api/productos/alertas/vencimientos ──────────────────────────────────
const alertasVencimientos = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    const [rows] = await pool.query(`
      SELECT p.id, p.nombre, p.codigo_barras, p.stock, p.fecha_vencimiento,
             c.nombre AS categoria,
             DATEDIFF(p.fecha_vencimiento, CURDATE()) AS dias_para_vencer
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.activo = 1
        AND p.fecha_vencimiento IS NOT NULL
        AND p.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY p.fecha_vencimiento ASC
    `, [dias]);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[PRODUCTOS/alertas-vencimientos]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── GET /api/productos/:id ───────────────────────────────────────────────────
const obtenerProducto = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.nombre AS categoria_nombre, pv.nombre AS proveedor_nombre
      FROM productos p
      LEFT JOIN categorias  c  ON c.id  = p.categoria_id
      LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
      WHERE p.id = ? AND p.activo = 1
    `, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[PRODUCTOS/obtener]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── POST /api/productos ──────────────────────────────────────────────────────
const crearProducto = async (req, res) => {
  try {
    const {
      codigo_barras, nombre, descripcion, categoria_id, proveedor_id,
      marca, precio_compra, precio_venta, stock, stock_minimo,
      fecha_vencimiento, restringido_edad, imagen_url,
    } = req.body;

    if (!nombre || !categoria_id || !precio_venta) {
      return res.status(400).json({ success: false, message: 'nombre, categoria_id y precio_venta son requeridos.' });
    }

    const [result] = await pool.query(`
      INSERT INTO productos
        (codigo_barras, nombre, descripcion, categoria_id, proveedor_id,
         marca, precio_compra, precio_venta, stock, stock_minimo,
         fecha_vencimiento, restringido_edad, imagen_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codigo_barras || null, nombre, descripcion || null, categoria_id,
      proveedor_id || null, marca || null,
      precio_compra || 0, precio_venta,
      stock || 0, stock_minimo || 5,
      fecha_vencimiento || null,
      restringido_edad ? 1 : 0,
      imagen_url || null,
    ]);

    return res.status(201).json({
      success: true,
      message: 'Producto creado.',
      id: result.insertId,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de barras ya existe.' });
    }
    console.error('[PRODUCTOS/crear]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── PUT /api/productos/:id ───────────────────────────────────────────────────
const actualizarProducto = async (req, res) => {
  try {
    const {
      codigo_barras, nombre, descripcion, categoria_id, proveedor_id,
      marca, precio_compra, precio_venta, stock, stock_minimo,
      fecha_vencimiento, restringido_edad, imagen_url, activo,
    } = req.body;

    const [result] = await pool.query(`
      UPDATE productos SET
        codigo_barras = COALESCE(?, codigo_barras),
        nombre        = COALESCE(?, nombre),
        descripcion   = COALESCE(?, descripcion),
        categoria_id  = COALESCE(?, categoria_id),
        proveedor_id  = COALESCE(?, proveedor_id),
        marca         = COALESCE(?, marca),
        precio_compra = COALESCE(?, precio_compra),
        precio_venta  = COALESCE(?, precio_venta),
        stock         = COALESCE(?, stock),
        stock_minimo  = COALESCE(?, stock_minimo),
        fecha_vencimiento = COALESCE(?, fecha_vencimiento),
        restringido_edad  = COALESCE(?, restringido_edad),
        imagen_url    = COALESCE(?, imagen_url),
        activo        = COALESCE(?, activo)
      WHERE id = ?
    `, [
      codigo_barras ?? null, nombre ?? null, descripcion ?? null,
      categoria_id ?? null, proveedor_id ?? null, marca ?? null,
      precio_compra ?? null, precio_venta ?? null,
      stock ?? null, stock_minimo ?? null,
      fecha_vencimiento ?? null,
      restringido_edad !== undefined ? (restringido_edad ? 1 : 0) : null,
      imagen_url ?? null,
      activo !== undefined ? (activo ? 1 : 0) : null,
      req.params.id,
    ]);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }
    return res.json({ success: true, message: 'Producto actualizado.' });
  } catch (err) {
    console.error('[PRODUCTOS/actualizar]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

// ── DELETE /api/productos/:id ────────────────────────────────────────────────
const desactivarProducto = async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE productos SET activo = 0 WHERE id = ?',
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }
    return res.json({ success: true, message: 'Producto desactivado.' });
  } catch (err) {
    console.error('[PRODUCTOS/desactivar]', err);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

module.exports = {
  listarProductos,
  alertasStock,
  alertasVencimientos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  desactivarProducto,
};
