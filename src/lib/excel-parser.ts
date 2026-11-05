import * as XLSX from 'xlsx';
import {
  MovementType,
  ReturnCauseKey,
  ReturnLineItem,
  ZoneSummary,
} from '../types/returns';

type ReturnCausesBreakdown = Record<ReturnCauseKey, number>;
import {
  CAUSE_METADATA,
  REAL_PRODUCTS_CATALOG,
  REAL_ZONES_SUMMARY,
  computeReturnRow,
} from './real-excel-data';

export interface ExcelParseSummary {
  fileName: string;
  totalRowsParsed: number;
  totalUnits: number;
  totalCOP: number;
  qualityCOP: number;
  commercialCOP: number;
  zonesDetected: Array<{
    zoneId: string;
    zoneName: string;
    sheetName: string;
    rowsCount: number;
    unitsCount: number;
    totalCOP: number;
  }>;
  items: ReturnLineItem[];
}

/**
 * Convierte un valor de fecha de Excel (serial numérico como 46328 o texto DD/MM/YYYY) a YYYY-MM-DD
 */
export function excelDateToISO(val: unknown, fallback = '2026-11-03'): string {
  if (val === null || val === undefined || val === '') return fallback;

  if (typeof val === 'number' && val > 30000 && val < 75000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  const str = String(val).trim();
  if (!str) return fallback;

  // Si es un número en string (ej. "46328")
  const asNum = Number(str);
  if (!Number.isNaN(asNum) && asNum > 30000 && asNum < 75000) {
    const utcDays = Math.floor(asNum - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY (incluso si trae texto extra como "05/11/2026/15/10" o "18/11/2026-20/11")
  const dmyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Formato YYYY-MM-DD
  const ymdMatch = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return fallback;
}

/**
 * Identifica a qué zona del sistema corresponde el nombre de una hoja del Excel
 */
export function resolveSheetZone(sheetName: string): {
  zoneId: string;
  zoneName: string;
} | null {
  const clean = sheetName.trim().toUpperCase();

  // Ignorar hojas de resumen o catálogos
  if (
    clean.startsWith('LISTA') ||
    clean === 'INFORME' ||
    clean === 'INF PRUEBA' ||
    clean === 'PRUEBA' ||
    clean === 'DATOS' ||
    clean === 'TABLA RESUMEN' ||
    clean === 'SIN VENDEDOR' ||
    clean.startsWith('GRÁFICO') ||
    clean.startsWith('GRAFICO') ||
    clean.includes('% DE VENTAS')
  ) {
    return null;
  }

  // 1. Zonas Z01 a Z16
  const zMatch = clean.match(/^(Z0?\d{1,2})\b/i);
  if (zMatch) {
    const rawCode = zMatch[1].toUpperCase();
    const numPart = rawCode.slice(1).padStart(2, '0');
    const zoneId = `Z${numPart}`;
    const existingZone = REAL_ZONES_SUMMARY.find((z) => z.id === zoneId);
    return {
      zoneId,
      zoneName: existingZone ? existingZone.consolidatedName : sheetName.trim(),
    };
  }

  // 2. Clientes Especiales Z14
  if (clean.includes('FRONTINO')) {
    return { zoneId: 'Z14-FRONTINO', zoneName: 'FRONTINO-GOMEZ ALBEIRO (Z14)' };
  }
  if (clean.includes('GAMALIEL') || clean.includes('MACHADO')) {
    return { zoneId: 'Z14-GAMALIEL', zoneName: 'MACHADO GAMALIEL (Z14)' };
  }
  if (clean.includes('CROCANTES')) {
    return { zoneId: 'Z14-CROCANTES', zoneName: 'ALIMENTOS CROCANTES (Z14)' };
  }
  if (clean.includes('URREGO')) {
    return { zoneId: 'Z14-URREGO', zoneName: 'URREGO NARIÑO ANTONIO (Z14)' };
  }

  // 3. Puntos de Venta (PDV)
  if (clean.includes('BELEN') || clean.includes('BELÉN')) {
    return { zoneId: 'PDV-BELEN', zoneName: 'PUNTOS DE VENTA BELÉN' };
  }
  if (clean.includes('BELLO')) {
    return { zoneId: 'PDV-BELLO', zoneName: 'PUNTOS DE VENTA BELLO' };
  }
  if (clean.includes('CARLA')) {
    return { zoneId: 'PDV-CARLA', zoneName: 'PUNTOS DE VENTA CARLA' };
  }
  if (clean.includes('CUMBRE')) {
    return { zoneId: 'PDV-CUMBRE', zoneName: 'PUNTOS DE VENTA CUMBRE' };
  }
  if (clean.includes('SABANETA')) {
    return { zoneId: 'PDV-SABANETA', zoneName: 'PUNTOS DE VENTA SABANETA' };
  }

  return null;
}

function matchProductCatalog(rawProductName: string, rawCost: number): {
  productId: string;
  productName: string;
  unitCost: number;
} {
  const cleanName = rawProductName.trim().toUpperCase();
  const normalized = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  const found = REAL_PRODUCTS_CATALOG.find((p) => {
    const pNorm = p.name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
    return pNorm === normalized || pNorm.includes(normalized) || normalized.includes(pNorm);
  });

  if (found) {
    return {
      productId: found.id,
      productName: cleanName,
      unitCost: rawCost > 0 ? rawCost : found.price2024,
    };
  }

  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28);

  return {
    productId: `p-${slug || 'item'}`,
    productName: cleanName,
    unitCost: rawCost > 0 ? rawCost : 8000,
  };
}

/**
 * Procesa un archivo Excel (.xlsx) completo y extrae todas las devoluciones de todas las hojas de vendedores y PDV
 */
export function parseReturnsExcelWorkbook(
  buffer: ArrayBuffer,
  fileName: string
): ExcelParseSummary {
  const wb = XLSX.read(buffer, { type: 'array' });
  const items: ReturnLineItem[] = [];
  const zonesDetected: ExcelParseSummary['zonesDetected'] = [];

  let totalUnits = 0;
  let totalCOP = 0;
  let qualityCOP = 0;
  let commercialCOP = 0;

  for (const sheetName of wb.SheetNames) {
    const zoneInfo = resolveSheetZone(sheetName);
    if (!zoneInfo) continue;

    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
    });

    let lastDate = '2026-11-03';
    let lastClient = 'CLIENTE EN RUTA';
    let zoneRowsCount = 0;
    let zoneUnitsCount = 0;
    let zoneTotalCOP = 0;

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !Array.isArray(r) || r.length === 0) continue;

      const rawDateCell = r[0];
      const rawClient = String(r[1] ?? '').trim();
      const rawProduct = String(r[2] ?? '').trim();

      // Si es fila de corte "TOTAL DE PRODUCTOS", reiniciar cliente y saltar
      if (/^TOTAL\s+DE\s+PRODUCTOS/i.test(rawClient) || /^TOTAL/i.test(rawProduct)) {
        continue;
      }

      if (rawDateCell !== '' && rawDateCell !== null && rawDateCell !== undefined) {
        lastDate = excelDateToISO(rawDateCell, lastDate);
      }

      if (rawClient && !/^CLIENTE$/i.test(rawClient)) {
        lastClient = rawClient.toUpperCase();
      }

      // Si no hay producto o es encabezado repetido, saltar
      if (!rawProduct || /^PRODUCTO$/i.test(rawProduct)) {
        continue;
      }

      const rawQty = Number(r[3]) || 0;
      const aCobrar = Number(r[6]) || 0;
      const xFecha = Number(r[7]) || 0;
      const vacio = Number(r[8]) || 0;
      const proxVencer = Number(r[9]) || 0;
      const vencido = Number(r[10]) || 0;
      const abomba = Number(r[11]) || 0;
      const lechozo = Number(r[12]) || 0;

      const causesSum =
        aCobrar + xFecha + vacio + proxVencer + vencido + abomba + lechozo;
      const observations = String(r[15] ?? '').trim();

      // Saltar filas vacías de plantilla (donde cantidad es 0 y no hay causas ni observación relevante)
      if (rawQty <= 0 && causesSum <= 0 && !observations) {
        continue;
      }

      const qtyToReceive = rawQty > 0 ? rawQty : Math.max(1, causesSum);
      const rawLot = String(r[4] ?? '').trim();
      const lotNumber = rawLot ? rawLot.replace(/^L-/i, '') : 'S/L';
      const productExpiryDate = r[5]
        ? excelDateToISO(r[5], lastDate)
        : lastDate;

      const rawCost = Number(r[14]) || 0;
      const prodMatch = matchProductCatalog(rawProduct, rawCost);

      // Determinar tipo de movimiento según observación o causas
      let movementType: MovementType = 'AVERIA_DEVOLUCION';
      if (/degustaci/i.test(observations)) {
        movementType = 'DEGUSTACION';
      } else if (/regresa\s+buena/i.test(observations) && causesSum === 0) {
        movementType = 'REINGRESO_BUENO';
      } else if (aCobrar > 0 || /fact#/i.test(observations)) {
        movementType = 'CAMBIO_FACTURA';
      }

      // Extraer referencia de factura si existe en observaciones
      const factMatch = observations.match(/fact\s*#?\s*([0-9a-zA-Z-]+)/i);
      const invoiceRef = factMatch ? `fact#${factMatch[1]}` : undefined;

      const causes: ReturnCausesBreakdown = {
        aCobrar,
        xFecha,
        vacio,
        proxVencer,
        vencido,
        abomba,
        lechozo,
      };

      // Determinar causa principal para diagnóstico automático técnico
      const causeEntries: Array<[keyof ReturnCausesBreakdown, number]> = [
        ['lechozo', lechozo],
        ['vacio', vacio],
        ['xFecha', xFecha],
        ['abomba', abomba],
        ['proxVencer', proxVencer],
        ['vencido', vencido],
        ['aCobrar', aCobrar],
      ];
      causeEntries.sort((a, b) => b[1] - a[1]);
      const dominantKey = causeEntries[0][1] > 0 ? causeEntries[0][0] : 'proxVencer';
      const causeMeta =
        CAUSE_METADATA.find((c) => c.key === dominantKey) || CAUSE_METADATA[1];

      // ID determinístico por zona y fila para permitir actualizaciones (UPSERT) sin duplicar
      const deterministicId = `xl-${zoneInfo.zoneId}-r${i}`;

      const item: ReturnLineItem = {
        id: deterministicId,
        date: lastDate,
        zoneId: zoneInfo.zoneId,
        zoneName: zoneInfo.zoneName,
        clientName: lastClient,
        productId: prodMatch.productId,
        productName: prodMatch.productName,
        qtyToReceive,
        lotNumber,
        productExpiryDate,
        causes,
        unitCost: prodMatch.unitCost,
        movementType,
        invoiceRef,
        observations,
        createdBy: `Excel HGI (${zoneInfo.zoneId})`,
        technicalDiagnosis: observations
          ? `${observations} — ${causeMeta.technicalExplanation}`
          : causeMeta.technicalExplanation,
        storageTempC: 4.0,
      };

      const computed = computeReturnRow(item);
      items.push(item);

      zoneRowsCount += 1;
      zoneUnitsCount += qtyToReceive;
      zoneTotalCOP += computed.totalValueCOP;

      totalUnits += qtyToReceive;
      totalCOP += computed.totalValueCOP;
      qualityCOP += computed.qualityValueCOP;
      commercialCOP += computed.commercialValueCOP;
    }

    if (zoneRowsCount > 0) {
      zonesDetected.push({
        zoneId: zoneInfo.zoneId,
        zoneName: zoneInfo.zoneName,
        sheetName,
        rowsCount: zoneRowsCount,
        unitsCount: zoneUnitsCount,
        totalCOP: zoneTotalCOP,
      });
    }
  }

  return {
    fileName,
    totalRowsParsed: items.length,
    totalUnits,
    totalCOP,
    qualityCOP,
    commercialCOP,
    zonesDetected,
    items,
  };
}

/**
 * Recalcula dinámicamente las métricas de todas las zonas a partir de las filas reales cargadas
 */
export function recalculateZonesFromRows(
  baseZones: ZoneSummary[],
  returnItems: ReturnLineItem[]
): ZoneSummary[] {
  const byZone = new Map<
    string,
    {
      count: number;
      units: ReturnCausesBreakdown;
      cop: ReturnCausesBreakdown;
    }
  >();

  for (const item of returnItems) {
    const computed = computeReturnRow(item);
    const prev = byZone.get(item.zoneId) || {
      count: 0,
      units: {
        aCobrar: 0,
        xFecha: 0,
        vacio: 0,
        proxVencer: 0,
        vencido: 0,
        abomba: 0,
        lechozo: 0,
      },
      cop: {
        aCobrar: 0,
        xFecha: 0,
        vacio: 0,
        proxVencer: 0,
        vencido: 0,
        abomba: 0,
        lechozo: 0,
      },
    };

    prev.count += 1;
    prev.units.aCobrar += item.causes.aCobrar;
    prev.units.xFecha += item.causes.xFecha;
    prev.units.vacio += item.causes.vacio;
    prev.units.proxVencer += item.causes.proxVencer;
    prev.units.vencido += item.causes.vencido;
    prev.units.abomba += item.causes.abomba;
    prev.units.lechozo += item.causes.lechozo;

    prev.cop.aCobrar += computed.copByCause.aCobrar;
    prev.cop.xFecha += computed.copByCause.xFecha;
    prev.cop.vacio += computed.copByCause.vacio;
    prev.cop.proxVencer += computed.copByCause.proxVencer;
    prev.cop.vencido += computed.copByCause.vencido;
    prev.cop.abomba += computed.copByCause.abomba;
    prev.cop.lechozo += computed.copByCause.lechozo;

    byZone.set(item.zoneId, prev);
  }

  return baseZones.map((zone) => {
    const stats = byZone.get(zone.id);
    if (!stats) {
      return {
        ...zone,
        lineItemsCount: 0,
        unitsByCause: {
          aCobrar: 0,
          xFecha: 0,
          vacio: 0,
          proxVencer: 0,
          vencido: 0,
          abomba: 0,
          lechozo: 0,
        },
        copByCause: {
          aCobrar: 0,
          xFecha: 0,
          vacio: 0,
          proxVencer: 0,
          vencido: 0,
          abomba: 0,
          lechozo: 0,
        },
      };
    }

    return {
      ...zone,
      lineItemsCount: stats.count,
      unitsByCause: stats.units,
      copByCause: stats.cop,
    };
  });
}
