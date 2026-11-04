import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuración de conexión MySQL compatible con Railway y entorno local
function getDbConfig() {
  if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    return process.env.DATABASE_URL || process.env.MYSQL_URL;
  }
  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'retorna_db',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  };
}

let pool = null;
try {
  const cfg = getDbConfig();
  pool = typeof cfg === 'string' ? mysql.createPool(cfg) : mysql.createPool(cfg);
  console.log('✅ Pool de conexiones MySQL configurado');
} catch (e) {
  console.error('❌ Error configurando pool MySQL:', e);
}

// Inicialización automática de tablas y datos semilla si no existen
async function initDatabase() {
  if (!pool) return;
  try {
    const conn = await pool.getConnection();
    console.log('🚀 Verificando base de datos MySQL...');

    const [tables] = await conn.query("SHOW TABLES LIKE 'devoluciones_detalle'");
    if (Array.isArray(tables) && tables.length === 0) {
      console.log('📦 Inicializando tablas y datos desde database_mysql_phpmyadmin.sql...');
      const sqlScriptPath = path.join(__dirname, 'backend', 'database_mysql_phpmyadmin.sql');
      if (fs.existsSync(sqlScriptPath)) {
        const sqlContent = fs.readFileSync(sqlScriptPath, 'utf8');
        const statements = sqlContent
          .replace(/--.*$/gm, '')
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.toLowerCase().startsWith('set global'));

        for (const stmt of statements) {
          try {
            await conn.query(stmt);
          } catch (e) {
            // Ignorar avisos secundarios
          }
        }
        console.log('✅ Tablas y registros iniciales creados exitosamente en MySQL');
      }
    } else {
      console.log('✅ Base de datos lista con tabla devoluciones_detalle');
    }
    conn.release();
  } catch (err) {
    console.warn('⚠️ Advertencia en verificación inicial de MySQL:', err.message);
  }
}

// -------------------------------------------------------------
// API Endpoints (/api/mysql/*)
// -------------------------------------------------------------

// Health check para Railway
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'online', timestamp: new Date().toISOString() });
});

// 1. GET /api/mysql/state -> Listar devoluciones
app.get('/api/mysql/state', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  }
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        DATE_FORMAT(fecha_recepcion, '%Y-%m-%d') AS date,
        zona_id AS zoneId,
        zona_nombre AS zoneName,
        cliente_nombre AS clientName,
        producto_id AS productId,
        producto_nombre AS productName,
        cantidad_a_recibir AS qtyToReceive,
        numero_lote AS lotNumber,
        DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS productExpiryDate,
        costo_unitario_cop AS unitCost,
        tipo_movimiento AS movementType,
        referencia_factura AS invoiceRef,
        IFNULL(observaciones, '') AS observations,
        creado_por AS createdBy,
        foto_evidencia_url AS evidencePhotoUrl,
        diagnostico_tecnico AS technicalDiagnosis,
        temperatura_recepcion_c AS storageTempC,
        causa_a_cobrar, causa_x_fecha, causa_vacio, causa_prox_vencer, causa_vencido, causa_abomba, causa_lechozo
      FROM devoluciones_detalle
      ORDER BY creado_en DESC, fecha_recepcion DESC;
    `);

    const returnItems = (rows || []).map((r) => ({
      id: r.id,
      date: r.date,
      zoneId: r.zoneId,
      zoneName: r.zoneName,
      clientName: r.clientName,
      productId: r.productId,
      productName: r.productName,
      qtyToReceive: Number(r.qtyToReceive) || 0,
      lotNumber: r.lotNumber,
      productExpiryDate: r.productExpiryDate,
      unitCost: Number(r.unitCost) || 0,
      movementType: r.movementType,
      invoiceRef: r.invoiceRef,
      observations: r.observations,
      createdBy: r.createdBy,
      evidencePhotoUrl: r.evidencePhotoUrl,
      technicalDiagnosis: r.technicalDiagnosis,
      storageTempC: Number(r.storageTempC) || 4.0,
      causes: {
        aCobrar: Number(r.causa_a_cobrar) || 0,
        xFecha: Number(r.causa_x_fecha) || 0,
        vacio: Number(r.causa_vacio) || 0,
        proxVencer: Number(r.causa_prox_vencer) || 0,
        vencido: Number(r.causa_vencido) || 0,
        abomba: Number(r.causa_abomba) || 0,
        lechozo: Number(r.causa_lechozo) || 0,
      },
    }));

    res.json({ ok: true, returnItems });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. POST /api/mysql/returns -> Registrar devolución
app.post('/api/mysql/returns', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  }
  try {
    const item = req.body;
    const c = item.causes || {};
    const unitCost = Number(item.unitCost) || 0;
    const commUnits =
      (Number(c.aCobrar) || 0) +
      (Number(c.proxVencer) || 0) +
      (Number(c.vencido) || 0);
    const qualUnits =
      (Number(c.vacio) || 0) +
      (Number(c.xFecha) || 0) +
      (Number(c.abomba) || 0) +
      (Number(c.lechozo) || 0);
    const totalUnits = commUnits + qualUnits;
    const status = Number(item.qtyToReceive) === totalUnits ? 'CUADRADO' : 'REVISAR';

    await pool.query(
      `REPLACE INTO devoluciones_detalle (
        id, fecha_recepcion, zona_id, zona_nombre, cliente_nombre,
        producto_id, producto_nombre, cantidad_a_recibir, numero_lote, fecha_vencimiento,
        causa_a_cobrar, causa_x_fecha, causa_vacio, causa_prox_vencer, causa_vencido, causa_abomba, causa_lechozo,
        costo_unitario_cop, valor_comercial_cop, valor_calidad_cop, valor_total_cop,
        tipo_movimiento, estado_cuadre, referencia_factura, observaciones,
        foto_evidencia_url, diagnostico_tecnico, temperatura_recepcion_c, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.date,
        item.zoneId,
        item.zoneName,
        item.clientName,
        item.productId,
        item.productName,
        Number(item.qtyToReceive) || 1,
        item.lotNumber,
        item.productExpiryDate,
        Number(c.aCobrar) || 0,
        Number(c.xFecha) || 0,
        Number(c.vacio) || 0,
        Number(c.proxVencer) || 0,
        Number(c.vencido) || 0,
        Number(c.abomba) || 0,
        Number(c.lechozo) || 0,
        unitCost,
        commUnits * unitCost,
        qualUnits * unitCost,
        totalUnits * unitCost,
        item.movementType || 'AVERIA_DEVOLUCION',
        status,
        item.invoiceRef || null,
        item.observations || '',
        item.evidencePhotoUrl || '',
        item.technicalDiagnosis || '',
        Number(item.storageTempC) || 4.0,
        item.createdBy || 'Sistema',
      ]
    );

    res.json({ ok: true, id: item.id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. PUT /api/mysql/returns/evidence -> Actualizar evidencia fotográfica
app.put('/api/mysql/returns/evidence', async (req, res) => {
  if (!pool) return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  try {
    const { rowId, photoUrl, technicalDiagnosis, storageTempC } = req.body;
    await pool.query(
      `UPDATE devoluciones_detalle
       SET foto_evidencia_url = ?, diagnostico_tecnico = ?, temperatura_recepcion_c = ?, revisado_ingenieria = 1
       WHERE id = ?`,
      [photoUrl || '', technicalDiagnosis || '', Number(storageTempC) || 4.0, rowId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. PUT /api/mysql/returns/autofix -> Auto cuadrar fila
app.put('/api/mysql/returns/autofix', async (req, res) => {
  if (!pool) return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  try {
    const { rowId } = req.body;
    await pool.query(
      `UPDATE devoluciones_detalle
       SET causa_prox_vencer = GREATEST(0, cantidad_a_recibir - (causa_a_cobrar + causa_x_fecha + causa_vacio + causa_vencido + causa_abomba + causa_lechozo)),
           estado_cuadre = 'CUADRADO'
       WHERE id = ?`,
      [rowId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. DELETE /api/mysql/returns -> Eliminar devolución
app.delete('/api/mysql/returns', async (req, res) => {
  if (!pool) return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  try {
    const { rowId } = req.body;
    await pool.query('DELETE FROM devoluciones_detalle WHERE id = ?', [rowId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. PUT /api/mysql/zones/sales -> Actualizar ventas mes
app.put('/api/mysql/zones/sales', async (req, res) => {
  if (!pool) return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  try {
    const { zoneId, newSalesCOP } = req.body;
    await pool.query('UPDATE zonas_rutas SET ventas_mes_cop = ? WHERE id = ?', [
      Number(newSalesCOP) || 0,
      zoneId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. PUT /api/mysql/products/price -> Actualizar precio catálogo
app.put('/api/mysql/products/price', async (req, res) => {
  if (!pool) return res.status(500).json({ ok: false, error: 'Sin conexión a base de datos' });
  try {
    const { productId, newPrice2024 } = req.body;
    await pool.query('UPDATE catalogo_productos SET precio_2024_cop = ? WHERE id = ?', [
      Number(newPrice2024) || 0,
      productId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Servir frontend compilado en producción (dist)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🌐 Servidor de RetornaOS activo en puerto ${PORT}`);
  await initDatabase();
});
