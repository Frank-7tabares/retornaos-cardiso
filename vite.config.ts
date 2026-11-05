import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { spawnSync } from 'child_process';

const MYSQL_BIN_PATHS = [
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
  'C:\\xampp\\mysql\\bin\\mysql.exe',
  'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\mysql.exe',
];
const DB_NAME = 'retorna_db';

let cachedWorkingConfig: { bin: string; pwdArgs: string[] } | null = null;

function runMysqlQuery(sql: string): { ok: boolean; stdout: string; error?: string } {
  let lastError = '';

  // 1. Probar configuración funcional en caché para respuesta instantánea (< 10ms)
  if (cachedWorkingConfig) {
    try {
      const args = [
        '-u',
        'root',
        ...cachedWorkingConfig.pwdArgs,
        '--default-character-set=utf8mb4',
        '--max_allowed_packet=64M',
        '-N',
        '-B',
        '-r',
        '-D',
        DB_NAME,
      ];
      const res = spawnSync(cachedWorkingConfig.bin, args, {
        input: `SET NAMES utf8mb4;\n${sql}`,
        encoding: 'utf-8',
        timeout: 4000,
        maxBuffer: 64 * 1024 * 1024,
      });

      if (!res.error && res.status === 0) {
        return { ok: true, stdout: res.stdout.trim() };
      }
      lastError = res.stderr || res.error?.message || '';
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  // 2. Si falló la caché o es la primera vez, evaluar candidatos con timeout estricto de 3s
  // OJO: Nunca usar '-p' solo porque MySQL solicita interactivo por teclado y cuelga el proceso.
  const candidatePasswords: string[][] = [
    [],               // Sin contraseña (estándar verificado en este equipo)
    ['-p1234'],       // Contraseña alternativa 1234
    ['-proot'],       // Contraseña alternativa root
    ['-p123456'],     // Contraseña alternativa 123456
  ];

  for (const bin of MYSQL_BIN_PATHS) {
    for (const pwdArgs of candidatePasswords) {
      const args = [
        '-u',
        'root',
        ...pwdArgs,
        '--default-character-set=utf8mb4',
        '--max_allowed_packet=64M',
        '-N',
        '-B',
        '-r',
        '-D',
        DB_NAME,
      ];
      try {
        const res = spawnSync(bin, args, {
          input: `SET NAMES utf8mb4;\n${sql}`,
          encoding: 'utf-8',
          timeout: 3000, // Timeout estricto de 3s para evitar congelamiento
          maxBuffer: 64 * 1024 * 1024,
        });

        if (!res.error && res.status === 0) {
          cachedWorkingConfig = { bin, pwdArgs };
          return { ok: true, stdout: res.stdout.trim() };
        }
        lastError = res.stderr || res.error?.message || 'Error en ejecución SQL';
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }
  }

  return {
    ok: false,
    stdout: '',
    error: lastError || 'Error ejecutando SQL en retorna_db',
  };
}

function sqlEscape(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `'${str}'`;
}

function retornaMysqlBridgePlugin(): Plugin {
  return {
    name: 'retorna-mysql-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/mysql')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        const readBody = (): Promise<any> =>
          new Promise((resolve) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            req.on('end', () => {
              try {
                const raw = Buffer.concat(chunks).toString('utf-8');
                resolve(raw ? JSON.parse(raw) : {});
              } catch {
                resolve({});
              }
            });
          });

        // 1. GET /api/mysql/state -> Lee devoluciones desde retorna_db
        if (req.method === 'GET' && req.url.startsWith('/api/mysql/state')) {
          const sql = `
            SELECT JSON_OBJECT(
              'id', id,
              'date', DATE_FORMAT(fecha_recepcion, '%Y-%m-%d'),
              'zoneId', zona_id,
              'zoneName', zona_nombre,
              'clientName', cliente_nombre,
              'productId', producto_id,
              'productName', producto_nombre,
              'qtyToReceive', cantidad_a_recibir,
              'lotNumber', numero_lote,
              'productExpiryDate', DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d'),
              'causes', JSON_OBJECT(
                'aCobrar', causa_a_cobrar,
                'xFecha', causa_x_fecha,
                'vacio', causa_vacio,
                'proxVencer', causa_prox_vencer,
                'vencido', causa_vencido,
                'abomba', causa_abomba,
                'lechozo', causa_lechozo
              ),
              'unitCost', costo_unitario_cop,
              'movementType', tipo_movimiento,
              'invoiceRef', referencia_factura,
              'observations', IFNULL(observaciones, ''),
              'createdBy', creado_por,
              'evidencePhotoUrl', foto_evidencia_url,
              'technicalDiagnosis', diagnostico_tecnico,
              'storageTempC', temperatura_recepcion_c
            )
            FROM devoluciones_detalle
            ORDER BY creado_en DESC, fecha_recepcion DESC;
          `;
          const queryRes = runMysqlQuery(sql);
          if (!queryRes.ok) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: queryRes.error }));
            return;
          }

          const items = queryRes.stdout
            ? queryRes.stdout
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line))
            : [];

          res.end(
            JSON.stringify({
              ok: true,
              database: DB_NAME,
              returnItems: items,
            })
          );
          return;
        }

        // 2. POST /api/mysql/returns -> Inserta una nueva devolución en retorna_db
        if (req.method === 'POST' && req.url === '/api/mysql/returns') {
          const item = await readBody();
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
          const status =
            Number(item.qtyToReceive) === totalUnits ? 'CUADRADO' : 'REVISAR';

          const sql = `
            REPLACE INTO devoluciones_detalle (
              id, fecha_recepcion, zona_id, zona_nombre, cliente_nombre,
              producto_id, producto_nombre, cantidad_a_recibir, numero_lote, fecha_vencimiento,
              causa_a_cobrar, causa_x_fecha, causa_vacio, causa_prox_vencer, causa_vencido, causa_abomba, causa_lechozo,
              costo_unitario_cop, valor_comercial_cop, valor_calidad_cop, valor_total_cop,
              tipo_movimiento, estado_cuadre, referencia_factura, observaciones,
              foto_evidencia_url, diagnostico_tecnico, temperatura_recepcion_c, creado_por
            ) VALUES (
              ${sqlEscape(item.id)},
              ${sqlEscape(item.date)},
              ${sqlEscape(item.zoneId)},
              ${sqlEscape(item.zoneName)},
              ${sqlEscape(item.clientName)},
              ${sqlEscape(item.productId)},
              ${sqlEscape(item.productName)},
              ${Number(item.qtyToReceive) || 1},
              ${sqlEscape(item.lotNumber)},
              ${sqlEscape(item.productExpiryDate)},
              ${Number(c.aCobrar) || 0},
              ${Number(c.xFecha) || 0},
              ${Number(c.vacio) || 0},
              ${Number(c.proxVencer) || 0},
              ${Number(c.vencido) || 0},
              ${Number(c.abomba) || 0},
              ${Number(c.lechozo) || 0},
              ${unitCost},
              ${commUnits * unitCost},
              ${qualUnits * unitCost},
              ${totalUnits * unitCost},
              ${sqlEscape(item.movementType || 'AVERIA_DEVOLUCION')},
              ${sqlEscape(status)},
              ${item.invoiceRef ? sqlEscape(item.invoiceRef) : 'NULL'},
              ${sqlEscape(item.observations || '')},
              ${sqlEscape(item.evidencePhotoUrl || '')},
              ${sqlEscape(item.technicalDiagnosis || '')},
              ${Number(item.storageTempC) || 4.0},
              ${sqlEscape(item.createdBy || 'Sistema')}
            );
          `;

          const insertRes = runMysqlQuery(sql);
          if (!insertRes.ok) {
            res.statusCode = 500;
          }
          res.end(JSON.stringify({ ok: insertRes.ok, error: insertRes.error }));
          return;
        }

        // 2B. POST /api/mysql/returns/bulk -> Sincronización masiva desde Excel HGI (.xlsx)
        if (req.method === 'POST' && req.url === '/api/mysql/returns/bulk') {
          const body = await readBody();
          const items = Array.isArray(body?.items) ? body.items : [];
          const clearDemo = body?.clearDemo !== false;
          const replaceAll = Boolean(body?.replaceAll);

          if (items.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Sin filas para sincronizar' }));
            return;
          }

          const sqlParts: string[] = [];
          if (replaceAll) {
            sqlParts.push('DELETE FROM devoluciones_detalle;');
          } else if (clearDemo) {
            sqlParts.push("DELETE FROM devoluciones_detalle WHERE id LIKE 'ret-%';");
          }

          const chunkSize = 80;
          for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const valuesRows = chunk.map((item: any) => {
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
              const status =
                Number(item.qtyToReceive) === totalUnits ? 'CUADRADO' : 'REVISAR';

              return `(
                ${sqlEscape(item.id)},
                ${sqlEscape(item.date)},
                ${sqlEscape(item.zoneId)},
                ${sqlEscape(item.zoneName)},
                ${sqlEscape(item.clientName)},
                ${sqlEscape(item.productId)},
                ${sqlEscape(item.productName)},
                ${Number(item.qtyToReceive) || 1},
                ${sqlEscape(item.lotNumber || 'S/L')},
                ${sqlEscape(item.productExpiryDate || item.date)},
                ${Number(c.aCobrar) || 0},
                ${Number(c.xFecha) || 0},
                ${Number(c.vacio) || 0},
                ${Number(c.proxVencer) || 0},
                ${Number(c.vencido) || 0},
                ${Number(c.abomba) || 0},
                ${Number(c.lechozo) || 0},
                ${unitCost},
                ${commUnits * unitCost},
                ${qualUnits * unitCost},
                ${totalUnits * unitCost},
                ${sqlEscape(item.movementType || 'AVERIA_DEVOLUCION')},
                ${sqlEscape(status)},
                ${item.invoiceRef ? sqlEscape(item.invoiceRef) : 'NULL'},
                ${sqlEscape(item.observations || '')},
                ${sqlEscape(item.evidencePhotoUrl || '')},
                ${sqlEscape(item.technicalDiagnosis || '')},
                ${Number(item.storageTempC) || 4.0},
                ${sqlEscape(item.createdBy || 'Excel HGI')}
              )`;
            });

            sqlParts.push(`
              INSERT INTO devoluciones_detalle (
                id, fecha_recepcion, zona_id, zona_nombre, cliente_nombre,
                producto_id, producto_nombre, cantidad_a_recibir, numero_lote, fecha_vencimiento,
                causa_a_cobrar, causa_x_fecha, causa_vacio, causa_prox_vencer, causa_vencido, causa_abomba, causa_lechozo,
                costo_unitario_cop, valor_comercial_cop, valor_calidad_cop, valor_total_cop,
                tipo_movimiento, estado_cuadre, referencia_factura, observaciones,
                foto_evidencia_url, diagnostico_tecnico, temperatura_recepcion_c, creado_por
              ) VALUES ${valuesRows.join(',\n')}
              ON DUPLICATE KEY UPDATE
                fecha_recepcion = VALUES(fecha_recepcion),
                zona_id = VALUES(zona_id),
                zona_nombre = VALUES(zona_nombre),
                cliente_nombre = VALUES(cliente_nombre),
                producto_id = VALUES(producto_id),
                producto_nombre = VALUES(producto_nombre),
                cantidad_a_recibir = VALUES(cantidad_a_recibir),
                numero_lote = VALUES(numero_lote),
                fecha_vencimiento = VALUES(fecha_vencimiento),
                causa_a_cobrar = VALUES(causa_a_cobrar),
                causa_x_fecha = VALUES(causa_x_fecha),
                causa_vacio = VALUES(causa_vacio),
                causa_prox_vencer = VALUES(causa_prox_vencer),
                causa_vencido = VALUES(causa_vencido),
                causa_abomba = VALUES(causa_abomba),
                causa_lechozo = VALUES(causa_lechozo),
                costo_unitario_cop = VALUES(costo_unitario_cop),
                valor_comercial_cop = VALUES(valor_comercial_cop),
                valor_calidad_cop = VALUES(valor_calidad_cop),
                valor_total_cop = VALUES(valor_total_cop),
                tipo_movimiento = VALUES(tipo_movimiento),
                estado_cuadre = VALUES(estado_cuadre),
                referencia_factura = VALUES(referencia_factura),
                observaciones = VALUES(observaciones),
                diagnostico_tecnico = VALUES(diagnostico_tecnico);
            `);
          }

          const bulkRes = runMysqlQuery(sqlParts.join('\n'));
          if (!bulkRes.ok) {
            res.statusCode = 500;
          }
          res.end(
            JSON.stringify({
              ok: bulkRes.ok,
              totalSynced: items.length,
              error: bulkRes.error,
            })
          );
          return;
        }

        // 3. PUT /api/mysql/returns/evidence -> Actualiza foto, diagnóstico y temperatura en retorna_db
        if (req.method === 'PUT' && req.url === '/api/mysql/returns/evidence') {
          const body = await readBody();
          const sql = `
            UPDATE devoluciones_detalle
            SET
              foto_evidencia_url = ${sqlEscape(body.photoUrl || '')},
              diagnostico_tecnico = ${sqlEscape(body.technicalDiagnosis || '')},
              temperatura_recepcion_c = ${Number(body.storageTempC) || 4.0},
              revisado_ingenieria = 1
            WHERE id = ${sqlEscape(body.rowId)};
          `;
          const updateRes = runMysqlQuery(sql);
          res.end(JSON.stringify({ ok: updateRes.ok, error: updateRes.error }));
          return;
        }

        // 4. PUT /api/mysql/returns/autofix -> Cuadra automáticamente la fila en retorna_db
        if (req.method === 'PUT' && req.url === '/api/mysql/returns/autofix') {
          const body = await readBody();
          const sql = `
            UPDATE devoluciones_detalle
            SET
              causa_prox_vencer = GREATEST(0, cantidad_a_recibir - (causa_a_cobrar + causa_x_fecha + causa_vacio + causa_vencido + causa_abomba + causa_lechozo)),
              estado_cuadre = 'CUADRADO'
            WHERE id = ${sqlEscape(body.rowId)};
          `;
          const fixRes = runMysqlQuery(sql);
          res.end(JSON.stringify({ ok: fixRes.ok, error: fixRes.error }));
          return;
        }

        // 5. DELETE /api/mysql/returns -> Elimina un registro de retorna_db
        if (req.method === 'DELETE' && req.url === '/api/mysql/returns') {
          const body = await readBody();
          const sql = `DELETE FROM devoluciones_detalle WHERE id = ${sqlEscape(body.rowId)};`;
          const delRes = runMysqlQuery(sql);
          res.end(JSON.stringify({ ok: delRes.ok, error: delRes.error }));
          return;
        }

        // 6. PUT /api/mysql/zones/sales -> Actualiza Ventas Mes en retorna_db
        if (req.method === 'PUT' && req.url === '/api/mysql/zones/sales') {
          const body = await readBody();
          const sql = `
            UPDATE zonas_rutas
            SET ventas_mes_cop = ${Number(body.newSalesCOP) || 0}
            WHERE id = ${sqlEscape(body.zoneId)};
          `;
          const upRes = runMysqlQuery(sql);
          res.end(JSON.stringify({ ok: upRes.ok, error: upRes.error }));
          return;
        }

        // 7. PUT /api/mysql/products/price -> Actualiza Precio 2024 en retorna_db
        if (req.method === 'PUT' && req.url === '/api/mysql/products/price') {
          const body = await readBody();
          const sql = `
            UPDATE catalogo_productos
            SET precio_2024_cop = ${Number(body.newPrice2024) || 0}
            WHERE id = ${sqlEscape(body.productId)};
          `;
          const upRes = runMysqlQuery(sql);
          res.end(JSON.stringify({ ok: upRes.ok, error: upRes.error }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), retornaMysqlBridgePlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
