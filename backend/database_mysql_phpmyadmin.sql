-- ============================================================================
-- SCRIPT OFICIAL MYSQL / MARIADB PARA PHPMYADMIN Y HEIDISQL (ACTUALIZADO)
-- Proyecto: RetornaOS - Sistema de Devoluciones, Lotes y Evidencia Fotográfica
-- Base de datos: retorna_db
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET GLOBAL max_allowed_packet = 67108864;

DROP TABLE IF EXISTS `devoluciones_detalle`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `catalogo_productos`;
DROP TABLE IF EXISTS `zonas_rutas`;

-- ----------------------------------------------------------------------------
-- 1. TABLA DE ZONAS, RUTAS DE VENDEDORES (Z01-Z15), CLIENTES Z14 Y SEDES PDV
-- ----------------------------------------------------------------------------
CREATE TABLE `zonas_rutas` (
  `id` VARCHAR(50) NOT NULL,
  `codigo` VARCHAR(30) NOT NULL,
  `nombre_hoja_excel` VARCHAR(120) NOT NULL,
  `nombre_consolidado` VARCHAR(120) NOT NULL,
  `vendedor_titular` VARCHAR(120) NOT NULL,
  `tipo_canal` ENUM('RUTA_VENDEDOR', 'CLIENTE_ESPECIAL_Z14', 'PUNTO_DE_VENTA') NOT NULL DEFAULT 'RUTA_VENDEDOR',
  `ventas_mes_cop` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `activa` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. TABLA DE USUARIOS Y ROLES (LOGIN / REGISTRO / RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE `usuarios` (
  `id` VARCHAR(50) NOT NULL,
  `nombre_completo` VARCHAR(120) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('ADMIN', 'CALIDAD', 'RECEPCION', 'VENDEDOR', 'PDV') NOT NULL DEFAULT 'VENDEDOR',
  `etiqueta_rol` VARCHAR(100) NOT NULL,
  `zona_asignada_id` VARCHAR(50) DEFAULT NULL,
  `iniciales_avatar` VARCHAR(5) NOT NULL DEFAULT 'US',
  `estado` ENUM('ACTIVO', 'PENDIENTE_APROBACION') NOT NULL DEFAULT 'ACTIVO',
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. TABLA DE CATÁLOGO DE PRODUCTOS Y PRECIOS (LISTA PDTOS 2024)
-- ----------------------------------------------------------------------------
CREATE TABLE `catalogo_productos` (
  `id` VARCHAR(50) NOT NULL,
  `sku` VARCHAR(40) NOT NULL,
  `nombre` VARCHAR(160) NOT NULL,
  `categoria` VARCHAR(80) NOT NULL,
  `precio_2024_cop` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `precio_hasta_15_cop` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. TABLA DE DEVOLUCIONES, LOTES, 7 CAUSAS Y EVIDENCIA FOTOGRÁFICA
-- (Sin llaves foráneas restrictivas para permitir guardar cualquier producto/zona al instante)
-- ----------------------------------------------------------------------------
CREATE TABLE `devoluciones_detalle` (
  `id` VARCHAR(80) NOT NULL,
  `fecha_recepcion` DATE NOT NULL,
  `zona_id` VARCHAR(50) NOT NULL,
  `zona_nombre` VARCHAR(120) NOT NULL,
  `cliente_nombre` VARCHAR(160) NOT NULL,
  `producto_id` VARCHAR(50) NOT NULL,
  `producto_nombre` VARCHAR(160) NOT NULL,
  `cantidad_a_recibir` INT NOT NULL DEFAULT 1,
  `numero_lote` VARCHAR(40) NOT NULL,
  `fecha_vencimiento` DATE NOT NULL,

  -- Las 7 Causas en Unidades (Cols G a M del Excel)
  `causa_a_cobrar` INT NOT NULL DEFAULT 0,
  `causa_x_fecha` INT NOT NULL DEFAULT 0,
  `causa_vacio` INT NOT NULL DEFAULT 0,
  `causa_prox_vencer` INT NOT NULL DEFAULT 0,
  `causa_vencido` INT NOT NULL DEFAULT 0,
  `causa_abomba` INT NOT NULL DEFAULT 0,
  `causa_lechozo` INT NOT NULL DEFAULT 0,

  -- Valores Monetarios y Liquidación (Cols O y Q..W ocultas del Excel)
  `costo_unitario_cop` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `valor_comercial_cop` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `valor_calidad_cop` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `valor_total_cop` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,

  -- Estado y Trazabilidad para Ingenieras de Producción
  `tipo_movimiento` VARCHAR(40) NOT NULL DEFAULT 'AVERIA_DEVOLUCION',
  `estado_cuadre` VARCHAR(40) NOT NULL DEFAULT 'CUADRADO',
  `referencia_factura` VARCHAR(60) DEFAULT NULL,
  `observaciones` TEXT DEFAULT NULL,
  `foto_evidencia_url` LONGTEXT DEFAULT NULL,
  `diagnostico_tecnico` TEXT DEFAULT NULL,
  `temperatura_recepcion_c` DECIMAL(4, 1) DEFAULT 4.0,
  `revisado_ingenieria` TINYINT(1) NOT NULL DEFAULT 0,
  `nota_ingeniera_produccion` TEXT DEFAULT NULL,
  `creado_por` VARCHAR(120) NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_dev_lote` (`numero_lote`),
  KEY `idx_dev_fecha` (`fecha_recepcion`),
  KEY `idx_dev_zona` (`zona_id`),
  KEY `idx_dev_producto` (`producto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INSERCIÓN DE LAS 23 ZONAS Y PUNTOS DE VENTA REALES
-- ============================================================================
INSERT INTO `zonas_rutas` (`id`, `codigo`, `nombre_hoja_excel`, `nombre_consolidado`, `vendedor_titular`, `tipo_canal`, `ventas_mes_cop`) VALUES
('Z01', 'Z01', 'Z01 SANTIAGO MONCADA', 'Z01 SANTIAGO MONCADA', 'Santiago Moncada', 'RUTA_VENDEDOR', 78969920.00),
('Z02', 'Z02', 'Z02 LUISA RESTREPO', 'Z02 OSCAR VILLADIEGO', 'Oscar Villadiego (Ant: Luisa Restrepo)', 'RUTA_VENDEDOR', 98094746.00),
('Z03', 'Z03', 'Z03 BRAUDEN GONZALEZ', 'Z03 JUAN DAVID ARANGO', 'Juan David Arango / Brauden González', 'RUTA_VENDEDOR', 72884647.00),
('Z04', 'Z04', 'Z04 NEVARDO CALDERON', 'Z04 LAURA RESTREPO', 'Laura Restrepo / Nevardo Calderón', 'RUTA_VENDEDOR', 42482785.00),
('Z05', 'Z05', 'Z05 RODOLFO', 'Z05 JUAN ESTEBAN BORJA', 'Juan Esteban Borja / Rodolfo', 'RUTA_VENDEDOR', 36376928.00),
('Z06', 'Z06', 'Z06 SANDRA MiLENA VILLADA C', 'Z06 FABIAN GIRALDO', 'Fabián Giraldo / Sandra Milena Villada', 'RUTA_VENDEDOR', 58463896.00),
('Z07', 'Z07', 'Z07 ELIZABETH MARTINEZ', 'Z07 BRAYAN BONILLA', 'Brayan Bonilla / Elizabeth Martínez', 'RUTA_VENDEDOR', 52297253.00),
('Z08', 'Z08', 'Z08 ELIZABETH RESTREPO', 'Z08 NAIYIBER QUIROZ', 'Naiyiber Quiroz / Elizabeth Restrepo', 'RUTA_VENDEDOR', 49302118.00),
('Z09', 'Z09', 'Z09 JHON POSSO.', 'Z09 JHON POSSO', 'Jhon Posso', 'RUTA_VENDEDOR', 25173446.00),
('Z10', 'Z10', 'Z10 DAHIANA RESTREPO', 'Z10 FARID JARABA', 'Farid Jaraba / Dahiana Restrepo', 'RUTA_VENDEDOR', 22091126.00),
('Z11', 'Z11', 'Z11 DAYANA ARBOLEDA', 'Z11 DAYANA ARBOLEDA', 'Dayana Arboleda', 'RUTA_VENDEDOR', 27435908.00),
('Z12', 'Z12', 'Z12 LUIS SANTIAGO.', 'Z12 LUIS SANTIAGO', 'Luis Santiago', 'RUTA_VENDEDOR', 100812279.00),
('Z13', 'Z13', 'Z13 SEBASTIAN', 'Z13 SEBASTIAN', 'Sebastián (Degustaciones & Especiales)', 'RUTA_VENDEDOR', 18500000.00),
('Z15', 'Z15', 'Z15 ARTURO MONTILLA', 'Z15 ARTURO MONTILLA', 'Arturo Montilla', 'RUTA_VENDEDOR', 31200000.00),
('Z14-FRONTINO', 'Z14-FRO', 'FRONTINO-GOMEZ ALBEIRO', 'FRONTINO-GOMEZ ALBEIRO (Z14)', 'Jorge Albeiro Gómez Rengifo (Frontino)', 'CLIENTE_ESPECIAL_Z14', 46800000.00),
('Z14-GAMALIEL', 'Z14-GAM', 'MACHADO GAMALIEL', 'MACHADO GAMALIEL (Z14)', 'Gamaliel Machado', 'CLIENTE_ESPECIAL_Z14', 19400000.00),
('Z14-CROCANTES', 'Z14-CRO', 'ALIMENTOS CROCANTES ', 'ALIMENTOS CROCANTES (Z14)', 'Alimentos Crocantes', 'CLIENTE_ESPECIAL_Z14', 22100000.00),
('Z14-URREGO', 'Z14-URR', 'URREGO NARIÑO ANTONIO', 'URREGO NARIÑO ANTONIO (Z14)', 'Antonio Urrego Nariño', 'CLIENTE_ESPECIAL_Z14', 16500000.00),
('PDV-BELEN', 'PDV-BEL', 'PUNTOS DE VENTA BELEN', 'PUNTOS DE VENTA BELÉN', 'Sede PDV Belén', 'PUNTO_DE_VENTA', 34500000.00),
('PDV-BELLO', 'PDV-BLO', 'PUNTOS DE VENTA BELLO', 'PUNTOS DE VENTA BELLO', 'Sede PDV Bello', 'PUNTO_DE_VENTA', 28900000.00),
('PDV-CARLA', 'PDV-CAR', 'PUNTOS DE VENTA CARLA', 'PUNTOS DE VENTA CARLA', 'Sede PDV Carla Principal', 'PUNTO_DE_VENTA', 41200000.00),
('PDV-CUMBRE', 'PDV-CUM', 'PUNTOS DE VENTA CUMBRE', 'PUNTOS DE VENTA CUMBRE', 'Sede PDV La Cumbre', 'PUNTO_DE_VENTA', 26800000.00),
('PDV-SABANETA', 'PDV-SAB', 'PUNTOS DE VENTA SABANETA', 'PUNTOS DE VENTA SABANETA', 'Sede PDV Sabaneta', 'PUNTO_DE_VENTA', 38700000.00);

INSERT INTO `usuarios` (`id`, `nombre_completo`, `email`, `password_hash`, `rol`, `etiqueta_rol`, `zona_asignada_id`, `iniciales_avatar`, `estado`) VALUES
('usr-admin', 'Dirección General & Auditoría', 'gerencia@alimentoscarla.co', '$argon2id$v=19$m=65536,t=3,p=4$demo_admin', 'ADMIN', 'Gerencia / Administrador', NULL, 'DG', 'ACTIVO'),
('usr-calidad', 'Ing. Control de Calidad Planta', 'calidad@alimentoscarla.co', '$argon2id$v=19$m=65536,t=3,p=4$demo_calidad', 'CALIDAD', 'Auditor de Calidad & Lotes', NULL, 'CC', 'ACTIVO'),
('usr-recepcion', 'Coordinador Recepción Devoluciones', 'devoluciones@alimentoscarla.co', '$argon2id$v=19$m=65536,t=3,p=4$demo_recep', 'RECEPCION', 'Liquidador Bodega', NULL, 'RD', 'ACTIVO'),
('usr-z01', 'Santiago Moncada (Zona Z01)', 'z01.moncada@alimentoscarla.co', '$argon2id$v=19$m=65536,t=3,p=4$demo_z01', 'VENDEDOR', 'Ejecutivo Comercial Z01', 'Z01', 'SM', 'ACTIVO'),
('usr-pdv-sabaneta', 'Punto de Venta Sabaneta', 'pdv.sabaneta@alimentoscarla.co', '$argon2id$v=19$m=65536,t=3,p=4$demo_pdv', 'PDV', 'Administrador PDV Sabaneta', 'PDV-SABANETA', 'PS', 'ACTIVO');

-- ============================================================================
-- CATÁLOGO COMPLETO DE PRODUCTOS (CON LOS MISMOS IDs p-1000..p-1092 DE LA APP)
-- ============================================================================
INSERT INTO `catalogo_productos` (`id`, `sku`, `nombre`, `categoria`, `precio_2024_cop`, `precio_hasta_15_cop`, `activo`) VALUES
('p-1000', '1000', 'ALBONDIGA X 500', 'Especialidades Cárnicas', 12700, 9700, 1),
('p-1001', '1001', 'ALBONDIGON X 450', 'Especialidades Cárnicas', 7150, 5250, 1),
('p-1002', '1002', 'ALBONDIGÓN X 4 KL', 'Especialidades Cárnicas', 57600, 44300, 1),
('p-1005', '1005', 'BUTIFARRA DE RES X KL', 'Butifarras y Longanizas', 15500, 13500, 1),
('p-1006', '1006', 'BUTIFARRA DE RES X 5 KL', 'Butifarras y Longanizas', 75000, 65250, 1),
('p-1007', '1007', 'BUTIFARRA X 10', 'Butifarras y Longanizas', 8000, 6950, 1),
('p-1008', '1008', 'BUTIFARRA X 21', 'Butifarras y Longanizas', 8000, 6950, 1),
('p-1009', '1009', 'BUTIFARRA LONG X 5', 'Butifarras y Longanizas', 11200, 8900, 1),
('p-1010', '1010', 'CARDIOFERTA', 'Especialidades Cárnicas', 11600, 11000, 1),
('p-1013', '1013', 'CHICHARRIN', 'Especialidades Cárnicas', 2200, 1750, 1),
('p-1015', '1015', 'CHORIZO ANTIOQUEÑO X 2', 'Chorizos', 3650, 3200, 1),
('p-1016', '1016', 'CHORIZO ANTIOQUEÑO X 8', 'Chorizos', 15550, 12450, 1),
('p-1018', '1018', 'CHORIZO ANTIOQUEÑO X 20', 'Chorizos', 28650, 30100, 1),
('p-1022', '1022', 'CHORIZO ASADERO X 10', 'Chorizos', 35150, 25550, 1),
('p-1025', '1025', 'CHORIZO COCTEL X 250', 'Chorizos', 7950, 6000, 1),
('p-1026', '1026', 'CHORIZO COCTEL X 500', 'Chorizos', 14450, 11550, 1),
('p-1030', '1030', 'CHORIZO ESPECIAL X 4', 'Chorizos', 23700, 18500, 1),
('p-1035', '1035', 'CHORIZO LLANERO X 6', 'Chorizos', 8550, 6800, 1),
('p-1036', '1036', 'CHORIZO LLANERO X 10', 'Chorizos', 15200, 12100, 1),
('p-1037', '1037', 'CHORIZO LLANERO X 21', 'Chorizos', 31100, 24900, 1),
('p-1040', '1040', 'CHORIZO RES CARLA X 10', 'Chorizos', 10650, 8500, 1),
('p-1041', '1041', 'CHORIZO RES CARLA X 20', 'Chorizos', 20250, 16200, 1),
('p-1044', '1044', 'CHORIZO TERNERA X 8', 'Chorizos', 14263, 11400, 1),
('p-1046', '1046', 'CHORIZO SANTARROSANO PICANTE', 'Chorizos', 7750, 6200, 1),
('p-1048', '1048', 'CHORIZO LOCAL X 80', 'Chorizos', 109200, 89000, 1),
('p-1052', '1052', 'JAMON PIZZA X 200', 'Jamones y Mortadelas', 6400, 5100, 1),
('p-1055', '1055', 'JAMON CARLA X 470', 'Jamones y Mortadelas', 10200, 8200, 1),
('p-1056', '1056', 'JAMÓN PREMIUM X 230', 'Jamones y Mortadelas', 8700, 6900, 1),
('p-1058', '1058', 'JAMON AHUMADO ECONOMICO X 450', 'Jamones y Mortadelas', 12050, 9600, 1),
('p-1060', '1060', 'LONGANIZA X 5', 'Butifarras y Longanizas', 11200, 8900, 1),
('p-1062', '1062', 'MORCILLA X 500', 'Especialidades Cárnicas', 11950, 9500, 1),
('p-1065', '1065', 'MORTADELA X 230', 'Jamones y Mortadelas', 4250, 3400, 1),
('p-1066', '1066', 'MORTADELA X 450', 'Jamones y Mortadelas', 8150, 6500, 1),
('p-1068', '1068', 'MORTADELA JAMONADA PLUS X 470', 'Jamones y Mortadelas', 9200, 7350, 1),
('p-1070', '1070', 'PICADA', 'Especialidades Cárnicas', 11650, 9300, 1),
('p-1072', '1072', 'RECORTE DE JAMÓN X 500', 'Jamones y Mortadelas', 10550, 8400, 1),
('p-1074', '1074', 'RECORTE DE TOCINETA', 'Especialidades Cárnicas', 12350, 9800, 1),
('p-1076', '1076', 'SALCHICHA CARLA X 250', 'Salchichas y Salchichones', 4850, 3900, 1),
('p-1077', '1077', 'SALCHICHA CARLA X 875', 'Salchichas y Salchichones', 16000, 12800, 1),
('p-1079', '1079', 'SALCHICHA PERRO X 10', 'Salchichas y Salchichones', 10150, 8100, 1),
('p-1080', '1080', 'SALCHICHA TRADICIONAL X 230', 'Salchichas y Salchichones', 5850, 4650, 1),
('p-1081', '1081', 'SALCHICHA TRADICIONAL X 450', 'Salchichas y Salchichones', 10350, 8250, 1),
('p-1083', '1083', 'SALCHICHA MANGUERA X 500', 'Salchichas y Salchichones', 6550, 5200, 1),
('p-1085', '1085', 'SALCHICHA PARRILLERA X 3', 'Salchichas y Salchichones', 3350, 2700, 1),
('p-1086', '1086', 'SALCHICHA PARRILERA X 12', 'Salchichas y Salchichones', 14650, 11700, 1),
('p-1088', '1088', 'SALCHICHON CERVECERO CARLA X 500', 'Salchichas y Salchichones', 6400, 5100, 1),
('p-1089', '1089', 'SALCHICHÓN DE POLLO X 540', 'Salchichas y Salchichones', 5350, 4300, 1),
('p-1091', '1091', 'TIPO TOCINETA X 150', 'Especialidades Cárnicas', 6250, 5000, 1),
('p-1092', '1092', 'TIPO TOCINETA X 250', 'Especialidades Cárnicas', 11150, 8900, 1);

-- ============================================================================
-- REGISTROS INICIALES DE DEVOLUCIONES CON EVIDENCIA FOTOGRÁFICA Y LOTE
-- ============================================================================
INSERT INTO `devoluciones_detalle` (
  `id`, `fecha_recepcion`, `zona_id`, `zona_nombre`, `cliente_nombre`,
  `producto_id`, `producto_nombre`, `cantidad_a_recibir`, `numero_lote`, `fecha_vencimiento`,
  `causa_a_cobrar`, `causa_x_fecha`, `causa_vacio`, `causa_prox_vencer`, `causa_vencido`, `causa_abomba`, `causa_lechozo`,
  `costo_unitario_cop`, `valor_comercial_cop`, `valor_calidad_cop`, `valor_total_cop`,
  `tipo_movimiento`, `estado_cuadre`, `referencia_factura`, `observaciones`,
  `foto_evidencia_url`, `diagnostico_tecnico`, `temperatura_recepcion_c`, `creado_por`
) VALUES
(
  'ret-101', '2026-10-16', 'Z01', 'Z01 SANTIAGO MONCADA', 'SUPERMERCADO LA 80',
  'p-1046', 'CHORIZO SANTARROSANO PICANTE', 6, '258', '2026-10-20',
  0, 0, 1, 2, 0, 0, 3,
  7750.00, 15500.00, 31000.00, 46500.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Empaque con líquido blanquecino en lote 258',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  'Se observa exudado lechoso en 3 paquetes del Lote 258 y 1 paquete con pérdida de sello lateral.',
  6.8, 'Santiago Moncada'
),
(
  'ret-102', '2026-10-16', 'Z01', 'Z01 SANTIAGO MONCADA', 'MERCA EXPRESS ROBLEDO',
  'p-1016', 'CHORIZO ANTIOQUEÑO X 8', 4, '255', '2026-10-18',
  0, 0, 0, 4, 0, 0, 0,
  15550.00, 62200.00, 0.00, 62200.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Rotación lenta en vitrina refrigerada',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
  'Producto íntegro a 2 días de vencimiento. Se retira preventivamente para evitar vencido en góndola.',
  3.8, 'Santiago Moncada'
),
(
  'ret-103', '2026-10-15', 'Z01', 'Z01 SANTIAGO MONCADA', 'CARNES Y DERIVADOS EL PRADO',
  'p-1025', 'CHORIZO COCTEL X 250', 3, '260', '2026-10-28',
  3, 0, 0, 0, 0, 0, 0,
  7950.00, 23850.00, 0.00, 23850.00,
  'CAMBIO_FACTURA', 'CUADRADO', 'fact#555543', 'Cobro directo fact#555543 por pedido duplicado',
  'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=900&q=80',
  'Devolución comercial al momento del descargue: el cliente solicitó 5 unidades y se facturaron 8.',
  3.2, 'Santiago Moncada'
),
(
  'ret-104', '2026-10-15', 'Z01', 'Z01 SANTIAGO MONCADA', 'AUTOSERVICIO SAN JAVIER',
  'p-1055', 'JAMON CARLA X 470', 5, '251', '2026-10-22',
  0, 2, 3, 0, 0, 0, 0,
  10200.00, 0.00, 51000.00, 51000.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Pérdida de vacío en transporte',
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=80',
  'Falla en termoformado inferior (3 unds sin vacío) y fecha corta al momento del despacho (2 unds).',
  4.4, 'Santiago Moncada'
),
(
  'ret-106', '2026-10-16', 'Z12', 'Z12 LUIS SANTIAGO', 'DISTRIBUIDORA LA MAYORISTA LOCAL 14',
  'p-1036', 'CHORIZO LLANERO X 10', 8, '259', '2026-10-19',
  0, 0, 2, 0, 0, 0, 6,
  15200.00, 0.00, 121600.00, 121600.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Lote 259 reportado por exudado lechoso',
  'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80',
  'Lote 259 crítico: 6 bolsas con presencia de líquido lechoso turbio y 2 bolsas con micro-fuga de vacío.',
  7.2, 'Luis Santiago'
),
(
  'ret-108', '2026-10-16', 'Z14-FRONTINO', 'FRONTINO-GOMEZ ALBEIRO (Z14)', 'COMERCIALIZADORA FRONTINO CENTRO',
  'p-1040', 'CHORIZO RES CARLA X 10', 10, '253', '2026-10-19',
  0, 0, 3, 2, 0, 0, 5,
  10650.00, 21300.00, 85200.00, 106500.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Tramo largo de ruta; 5 unidades lechosas y 3 sin vacío',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  'Ruta intermunicipal Z14 Frontino: vibración en carretera afectó sello en 3 unidades y 5 presentaron exudado lechoso.',
  6.5, 'Albeiro Frontino'
),
(
  'ret-110', '2026-10-16', 'PDV-CARLA', 'PUNTOS DE VENTA CARLA', 'PUNTO DE VENTA CARLA PRINCIPAL',
  'p-1058', 'JAMON AHUMADO ECONOMICO X 450', 4, '261', '2026-10-19',
  0, 1, 1, 2, 0, 0, 0,
  12050.00, 24100.00, 24100.00, 48200.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Revisión diaria de cava PDV Carla',
  'https://images.unsplash.com/photo-1551028150-64b9f398f678?auto=format&fit=crop&w=900&q=80',
  'Auditoría de cava sede principal: 1 unidad pierde vacío al manipular, 1 con fecha corta y 2 próximos a vencer.',
  3.5, 'Sede Principal Carla'
),
(
  'ret-112', '2026-10-16', 'PDV-SABANETA', 'PUNTOS DE VENTA SABANETA', 'PUNTO DE VENTA SABANETA SUR',
  'p-1044', 'CHORIZO TERNERA X 8', 7, '248', '2026-10-18',
  0, 0, 1, 3, 0, 0, 2,
  14263.00, 42789.00, 42789.00, 85578.00,
  'AVERIA_DEVOLUCION', 'REVISAR', NULL, 'Diferencia de 1 unidad pendiente de clasificar en recepción',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'Se recibieron 7 paquetes físicos del Lote 248 pero solo se clasificaron 6 en planilla (falta 1 unidad por asignar causa).',
  5.4, 'Sede PDV Sabaneta'
),
(
  'ret-113', '2026-10-15', 'PDV-BELEN', 'PUNTOS DE VENTA BELÉN', 'PUNTO DE VENTA BELÉN PARQUE',
  'p-1062', 'MORCILLA X 500', 5, '244', '2026-10-17',
  0, 0, 0, 2, 0, 1, 2,
  11950.00, 23900.00, 35850.00, 59750.00,
  'AVERIA_DEVOLUCION', 'CUADRADO', NULL, 'Inspección de frío en vitrina PDV Belén',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  '1 paquete con ligero abombamiento por fluctuación térmica en vitrina exhibidora y 2 con exudado lechoso.',
  6.9, 'Sede PDV Belén'
);

SET FOREIGN_KEY_CHECKS = 1;
