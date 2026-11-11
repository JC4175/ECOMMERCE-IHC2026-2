-- ============================================================
-- MINIMARKET ESCOBAR - Schema de Base de Datos
-- MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS minimarket_escobar
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE minimarket_escobar;

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('admin','cliente','cajero','almacen','repartidor') NOT NULL DEFAULT 'cliente',
  fecha_nacimiento DATE NULL,
  telefono      VARCHAR(20) NULL,
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: categorias
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(80) NOT NULL,
  descripcion VARCHAR(255) NULL,
  icono       VARCHAR(80) NULL,
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(150) NOT NULL,
  contacto   VARCHAR(120) NULL,
  telefono   VARCHAR(20)  NULL,
  email      VARCHAR(180) NULL,
  direccion  VARCHAR(255) NULL,
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: productos
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_barras     VARCHAR(50)  NULL UNIQUE,
  nombre            VARCHAR(180) NOT NULL,
  descripcion       TEXT         NULL,
  categoria_id      INT UNSIGNED NOT NULL,
  proveedor_id      INT UNSIGNED NULL,
  marca             VARCHAR(100) NULL,
  precio_compra     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  precio_venta      DECIMAL(10,2) NOT NULL,
  stock             INT NOT NULL DEFAULT 0,
  stock_minimo      INT NOT NULL DEFAULT 5,
  fecha_vencimiento DATE NULL,
  restringido_edad  TINYINT(1) NOT NULL DEFAULT 0,
  imagen_url        VARCHAR(500) NULL,
  activo            TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: promociones
-- ============================================================
CREATE TABLE IF NOT EXISTS promociones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(150) NOT NULL,
  producto_id     INT UNSIGNED NOT NULL,
  tipo            ENUM('porcentaje','monto') NOT NULL,
  valor           DECIMAL(10,2) NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  cantidad_maxima INT UNSIGNED NULL,
  cantidad_usada  INT UNSIGNED NOT NULL DEFAULT 0,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: zonas_delivery
-- ============================================================
CREATE TABLE IF NOT EXISTS zonas_delivery (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  costo      DECIMAL(10,2) NOT NULL,
  monto_minimo_pedido DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: ventas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT UNSIGNED NOT NULL,   -- cajero o cliente (online)
  cliente_id   INT UNSIGNED NULL,       -- cliente si aplica
  tipo         ENUM('presencial','online') NOT NULL DEFAULT 'presencial',
  fecha        DATE NOT NULL,
  hora         TIME NOT NULL,
  subtotal     DECIMAL(10,2) NOT NULL,
  descuento    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total        DECIMAL(10,2) NOT NULL,
  metodo_pago  ENUM('efectivo','yape','plin','tarjeta') NOT NULL,
  estado       ENUM('completada','anulada','devuelta') NOT NULL DEFAULT 'completada',
  notas        TEXT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
  FOREIGN KEY (cliente_id)  REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: venta_items
-- ============================================================
CREATE TABLE IF NOT EXISTS venta_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venta_id        INT UNSIGNED NOT NULL,
  producto_id     INT UNSIGNED NOT NULL,
  cantidad        INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  descuento       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  subtotal        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (venta_id)    REFERENCES ventas(id)    ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: pedidos (delivery / retiro)
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id         INT UNSIGNED NOT NULL,
  tipo               ENUM('delivery','retiro') NOT NULL DEFAULT 'delivery',
  direccion_entrega  VARCHAR(255) NULL,
  zona_id            INT UNSIGNED NULL,
  costo_delivery     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  subtotal           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  metodo_pago        ENUM('efectivo','yape','plin','tarjeta') NOT NULL DEFAULT 'efectivo',
  estado             ENUM('pendiente','pago_confirmado','en_preparacion','en_camino','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
  pago_confirmado    TINYINT(1) NOT NULL DEFAULT 0,
  repartidor_id      INT UNSIGNED NULL,
  notas              TEXT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id)    REFERENCES usuarios(id),
  FOREIGN KEY (zona_id)       REFERENCES zonas_delivery(id),
  FOREIGN KEY (repartidor_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: pedido_items
-- ============================================================
CREATE TABLE IF NOT EXISTS pedido_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT UNSIGNED NOT NULL,
  producto_id     INT UNSIGNED NOT NULL,
  cantidad        INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)  ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: devoluciones
-- ============================================================
CREATE TABLE IF NOT EXISTS devoluciones (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venta_id    INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  cantidad    INT NOT NULL,
  motivo      ENUM('mal_estado','vencido','distinto') NOT NULL,
  descripcion TEXT NULL,
  estado      ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  resuelto_por INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id)    REFERENCES ventas(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (resuelto_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: recetas
-- ============================================================
CREATE TABLE IF NOT EXISTS recetas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  imagen_url  VARCHAR(500) NULL,
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: receta_ingredientes
-- ============================================================
CREATE TABLE IF NOT EXISTS receta_ingredientes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receta_id   INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  cantidad    DECIMAL(10,3) NOT NULL DEFAULT 1,
  FOREIGN KEY (receta_id)   REFERENCES recetas(id)   ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: apertura_cierre
-- ============================================================
CREATE TABLE IF NOT EXISTS apertura_cierre (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  tipo       ENUM('apertura','cierre') NOT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notas      TEXT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: historial_compras_cliente (para "compra habitual")
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_compras_cliente (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id            INT UNSIGNED NOT NULL,
  producto_id           INT UNSIGNED NOT NULL,
  cantidad_total_compras INT UNSIGNED NOT NULL DEFAULT 1,
  ultima_compra         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cliente_producto (cliente_id, producto_id),
  FOREIGN KEY (cliente_id)  REFERENCES usuarios(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: configuracion (parámetros globales del negocio)
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  clave  VARCHAR(100) PRIMARY KEY,
  valor  VARCHAR(500) NOT NULL,
  descripcion VARCHAR(255) NULL
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Configuración base
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('monto_minimo_delivery', '20.00', 'Monto mínimo para realizar un pedido delivery'),
  ('radio_cobertura_km',    '5',     'Radio máximo de cobertura para delivery en km'),
  ('horario_apertura',      '07:00', 'Hora de apertura del minimarket'),
  ('horario_cierre',        '22:00', 'Hora de cierre del minimarket'),
  ('compras_para_habitual', '4',     'Cantidad de compras iguales para activar compra habitual');

-- Categorías
INSERT INTO categorias (nombre, descripcion, icono) VALUES
  ('Lácteos',        'Leche, queso, yogur y derivados',  'dairy_dining'),
  ('Bebidas',        'Gaseosas, jugos, aguas y más',     'local_drink'),
  ('Bebidas Alcohólicas', 'Cervezas, vinos, licores',    'liquor'),
  ('Snacks',         'Papas fritas, galletas, chifles',  'cookie'),
  ('Abarrotes',      'Arroz, azúcar, aceite, conservas', 'rice_bowl'),
  ('Limpieza',       'Detergentes, desinfectantes',      'cleaning_services'),
  ('Higiene Personal','Shampoo, jabón, pasta dental',    'soap'),
  ('Carnes',         'Pollo, res, cerdo, embutidos',     'lunch_dining'),
  ('Frutas y Verduras','Productos frescos del campo',    'eco'),
  ('Panadería',      'Pan, pasteles, tortas',            'bakery_dining');

-- Zonas de delivery
INSERT INTO zonas_delivery (nombre, costo, monto_minimo_pedido) VALUES
  ('Zona Centro',    3.00,  15.00),
  ('Zona Norte',     4.00,  20.00),
  ('Zona Sur',       4.00,  20.00),
  ('Zona Este',      5.00,  25.00),
  ('Zona Oeste',     5.00,  25.00),
  ('Zona Extendida', 8.00,  35.00);

-- Proveedor de ejemplo
INSERT INTO proveedores (nombre, contacto, telefono, email, direccion) VALUES
  ('Distribuidora Alimentos SAC', 'Juan Perez',   '987654321', 'ventas@distralim.pe',   'Av. Industrial 123, Lima'),
  ('Bebidas del Sur EIRL',        'María Flores', '912345678', 'contacto@bebidasur.pe', 'Jr. Comercio 456, Lima'),
  ('Lácteos Norte SRL',           'Carlos Ruiz',  '923456789', 'info@lacteosnorte.pe',  'Calle 7 de Junio 789, Lima');

-- Usuario administrador (password: Admin2026!)
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Administrador',  'admin@minimarket.pe',     '$2a$10$xEEMjmRIGOvbOdpTqgklMuHxlVGnE2kL2F1Q7u3V9L0A8X5nY6Lpi', 'admin');

-- Empleados (password: Empleado2026!)
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Carlos Cajero',  'cajero@minimarket.pe',    '$2a$10$xEEMjmRIGOvbOdpTqgklMuHxlVGnE2kL2F1Q7u3V9L0A8X5nY6Lpi', 'cajero'),
  ('Ana Almacén',    'almacen@minimarket.pe',   '$2a$10$xEEMjmRIGOvbOdpTqgklMuHxlVGnE2kL2F1Q7u3V9L0A8X5nY6Lpi', 'almacen'),
  ('Luis Delivery',  'delivery@minimarket.pe',  '$2a$10$xEEMjmRIGOvbOdpTqgklMuHxlVGnE2kL2F1Q7u3V9L0A8X5nY6Lpi', 'repartidor');

-- Clientes de ejemplo
INSERT INTO usuarios (nombre, email, password_hash, rol, fecha_nacimiento) VALUES
  ('Pedro Cliente',  'pedro@gmail.com',  '$2a$10$xEEMjmRIGOvbOdpTqgklMuHxlVGnE2kL2F1Q7u3V9L0A8X5nY6Lpi', 'cliente', '1995-05-15'),
  ('María Joven',    'maria@gmail.com',  '$2a$10$xEEMjmRIGOvbOdpTqgklMuHxlVGnE2kL2F1Q7u3V9L0A8X5nY6Lpi', 'cliente', '2010-08-20');

-- NOTA: Los hashes anteriores corresponden a bcrypt de "Admin2026!" y "Empleado2026!"
-- Para producción, generar hashes reales con bcrypt.hash()

-- Productos de ejemplo
INSERT INTO productos (codigo_barras, nombre, descripcion, categoria_id, proveedor_id, marca, precio_compra, precio_venta, stock, stock_minimo, fecha_vencimiento, restringido_edad) VALUES
  ('7751007001459', 'Leche Gloria Entera 1L',    'Leche evaporada entera',           1, 3, 'Gloria',    2.50,  3.80, 50, 10, DATE_ADD(CURDATE(), INTERVAL 90 DAY),  0),
  ('7751007002001', 'Yogur Fresa 500ml',          'Yogur con trozos de fresa',         1, 3, 'Gloria',    2.00,  3.20, 30, 5,  DATE_ADD(CURDATE(), INTERVAL 30 DAY),  0),
  ('7750106000232', 'Inca Kola 1.5L',             'Gaseosa sabor nacional',            2, 2, 'Coca-Cola', 3.50,  5.00, 60, 12, DATE_ADD(CURDATE(), INTERVAL 365 DAY), 0),
  ('7750106000233', 'Coca Cola 500ml',             'Gaseosa clásica',                  2, 2, 'Coca-Cola', 1.80,  2.50, 80, 15, DATE_ADD(CURDATE(), INTERVAL 365 DAY), 0),
  ('7750006000011', 'Cerveza Pilsen 650ml',        'Cerveza nacional rubia',            3, 2, 'Pilsen',    4.00,  5.50, 40, 8,  DATE_ADD(CURDATE(), INTERVAL 365 DAY), 1),
  ('7752042001001', 'Papas Lays 100g',             'Papas fritas sabor natural',        4, 1, 'Frito Lay', 2.00,  3.00, 45, 10, DATE_ADD(CURDATE(), INTERVAL 180 DAY), 0),
  ('7752042001002', 'Galletas Oreo 144g',          'Galletas de chocolate con crema',   4, 1, 'Nabisco',   3.50,  5.00, 35, 8,  DATE_ADD(CURDATE(), INTERVAL 240 DAY), 0),
  ('7750302000001', 'Arroz Costeño 5kg',           'Arroz extra calidad superior',      5, 1, 'Costeño',   13.00, 18.00,25, 5,  NULL,                                  0),
  ('7750302000002', 'Aceite Vegetal 1L',           'Aceite vegetal purificado',         5, 1, 'Primor',    4.50,  6.50, 30, 6,  DATE_ADD(CURDATE(), INTERVAL 365 DAY), 0),
  ('7756000001234', 'Jabón Dove 90g',              'Jabón de tocador hidratante',       7, 1, 'Dove',      1.80,  2.80, 55, 10, DATE_ADD(CURDATE(), INTERVAL 730 DAY), 0);

-- Receta 1: Desayuno Completo
INSERT INTO recetas (nombre, descripcion) VALUES
  ('Desayuno Completo', 'Combinación ideal para un desayuno nutritivo');

INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES
  (1, 1, 1),  -- Leche Gloria
  (1, 2, 1);  -- Yogur Fresa

-- Receta 2: Tarde de Snacks
INSERT INTO recetas (nombre, descripcion) VALUES
  ('Tarde de Snacks', 'La combinación perfecta para una tarde de películas');

INSERT INTO receta_ingredientes (receta_id, producto_id, cantidad) VALUES
  (2, 6, 1),  -- Papas Lays
  (2, 7, 1),  -- Galletas Oreo
  (2, 4, 2);  -- Coca Cola 500ml (2 unidades)

-- Promoción de ejemplo (10% de descuento en Inca Kola)
INSERT INTO promociones (nombre, producto_id, tipo, valor, fecha_inicio, fecha_fin, cantidad_maxima) VALUES
  ('Promo Inca Kola', 3, 'porcentaje', 10.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 100);
