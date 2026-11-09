import React, { useMemo, useState } from 'react';
import {
  Printer,
  Download,
  TrendingUp,
  Award,
  FlaskConical,
  Briefcase,
  ArrowUpDown,
  Calendar,
  PackageCheck,
  FileCheck2,
} from 'lucide-react';
import { Modal } from './ui/modal';
import { Badge } from './ui/badge';
import { computeZoneMetrics } from '../lib/real-excel-data';
import {
  formatCOP,
  formatCompactCOP,
  formatNumber,
  formatPercent,
} from '../lib/utils';
import {
  ComputedReturnRow,
  UserProfile,
  ZoneSummary,
} from '../types/returns';

interface ExecutiveReportModalProps {
  open: boolean;
  onClose: () => void;
  zones: ZoneSummary[];
  returnRows: ComputedReturnRow[];
  currentUser: UserProfile;
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  open,
  onClose,
  zones,
  returnRows,
  currentUser,
}) => {
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [productSortOrder, setProductSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [zoneSortBy, setZoneSortBy] = useState<
    'SALES_DESC' | 'SALES_ASC' | 'RETURNS_DESC'
  >('SALES_DESC');

  // Fechas disponibles y fecha máxima de corte
  const { availableDates, minDate, maxDate } = useMemo(() => {
    const dates = new Set<string>();
    for (const r of returnRows) {
      if (r.date) dates.add(r.date);
    }
    const sorted = Array.from(dates).sort();
    return {
      availableDates: [...sorted].reverse(),
      minDate: sorted[0] || '2026-11-01',
      maxDate: sorted[sorted.length - 1] || '2026-11-05',
    };
  }, [returnRows]);

  // Filas filtradas por fecha seleccionada
  const filteredRows = useMemo(() => {
    if (dateFilter === 'ALL') return returnRows;
    return returnRows.filter((r) => r.date === dateFilter);
  }, [returnRows, dateFilter]);

  // Zonas con métricas recalculadas según filtro de fecha
  const zoneMetricsList = useMemo(() => {
    const sellerZones = zones.filter((z) => z.id !== 'Z15');
    return sellerZones.map((z) => {
      if (dateFilter === 'ALL') {
        return computeZoneMetrics(z);
      }
      const zRows = filteredRows.filter((r) => r.zoneId === z.id);
      const customZone: ZoneSummary = {
        ...z,
        lineItemsCount: zRows.length,
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
      for (const r of zRows) {
        customZone.unitsByCause.aCobrar += r.causes.aCobrar;
        customZone.unitsByCause.xFecha += r.causes.xFecha;
        customZone.unitsByCause.vacio += r.causes.vacio;
        customZone.unitsByCause.proxVencer += r.causes.proxVencer;
        customZone.unitsByCause.vencido += r.causes.vencido;
        customZone.unitsByCause.abomba += r.causes.abomba;
        customZone.unitsByCause.lechozo += r.causes.lechozo;

        customZone.copByCause.aCobrar += r.copByCause.aCobrar;
        customZone.copByCause.xFecha += r.copByCause.xFecha;
        customZone.copByCause.vacio += r.copByCause.vacio;
        customZone.copByCause.proxVencer += r.copByCause.proxVencer;
        customZone.copByCause.vencido += r.copByCause.vencido;
        customZone.copByCause.abomba += r.copByCause.abomba;
        customZone.copByCause.lechozo += r.copByCause.lechozo;
      }
      return computeZoneMetrics(customZone);
    });
  }, [zones, filteredRows, dateFilter]);

  // Zona que MÁS vende y zona que MENOS vende (entre rutas de vendedores)
  const { topSellingZone, lowestSellingZone, sortedZones } = useMemo(() => {
    const rutas = zoneMetricsList.filter(
      (z) => z.type === 'RUTA_VENDEDOR' && z.monthlySalesCOP > 0
    );
    const bySalesDesc = [...rutas].sort(
      (a, b) => b.monthlySalesCOP - a.monthlySalesCOP
    );
    const top = bySalesDesc[0] || zoneMetricsList[0];
    const low = bySalesDesc[bySalesDesc.length - 1] || zoneMetricsList[0];

    const sorted = [...zoneMetricsList].sort((a, b) => {
      if (zoneSortBy === 'SALES_DESC')
        return b.monthlySalesCOP - a.monthlySalesCOP;
      if (zoneSortBy === 'SALES_ASC')
        return a.monthlySalesCOP - b.monthlySalesCOP;
      return b.totalCOP - a.totalCOP;
    });

    return {
      topSellingZone: top,
      lowestSellingZone: low,
      sortedZones: sorted,
    };
  }, [zoneMetricsList, zoneSortBy]);

  // Consolidado por Producto (Comercial vs Calidad, Lechosidad, Vacío, Próx Vencer)
  const productAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        productName: string;
        unitCost: number;
        totalUnits: number;
        totalCOP: number;
        commercialUnits: number;
        commercialCOP: number;
        qualityUnits: number;
        qualityCOP: number;
        lechozoUnits: number;
        lechozoCOP: number;
        vacioUnits: number;
        vacioCOP: number;
        proxVencerUnits: number;
        proxVencerCOP: number;
        xFechaUnits: number;
        aCobrarUnits: number;
        lots: Set<string>;
        zones: Set<string>;
      }
    >();

    for (const r of filteredRows) {
      const key = r.productName;
      let item = map.get(key);
      if (!item) {
        item = {
          productName: r.productName,
          unitCost: r.unitCost,
          totalUnits: 0,
          totalCOP: 0,
          commercialUnits: 0,
          commercialCOP: 0,
          qualityUnits: 0,
          qualityCOP: 0,
          lechozoUnits: 0,
          lechozoCOP: 0,
          vacioUnits: 0,
          vacioCOP: 0,
          proxVencerUnits: 0,
          proxVencerCOP: 0,
          xFechaUnits: 0,
          aCobrarUnits: 0,
          lots: new Set<string>(),
          zones: new Set<string>(),
        };
        map.set(key, item);
      }
      const commU =
        r.causes.aCobrar + r.causes.proxVencer + r.causes.vencido;
      const qualU =
        r.causes.vacio + r.causes.xFecha + r.causes.abomba + r.causes.lechozo;
      item.totalUnits += r.qtyToReceive;
      item.totalCOP += r.totalValueCOP;
      item.commercialUnits += commU;
      item.commercialCOP += r.commercialValueCOP;
      item.qualityUnits += qualU;
      item.qualityCOP += r.qualityValueCOP;
      item.lechozoUnits += r.causes.lechozo;
      item.lechozoCOP += r.copByCause.lechozo;
      item.vacioUnits += r.causes.vacio;
      item.vacioCOP += r.copByCause.vacio;
      item.proxVencerUnits += r.causes.proxVencer + r.causes.vencido;
      item.proxVencerCOP += r.copByCause.proxVencer + r.copByCause.vencido;
      item.xFechaUnits += r.causes.xFecha + r.causes.abomba;
      item.aCobrarUnits += r.causes.aCobrar;
      if (r.lotNumber && r.lotNumber !== 'S/L') item.lots.add(r.lotNumber);
      item.zones.add(r.zoneId);
    }

    const all = Array.from(map.values());
    const byUnitsDesc = [...all].sort((a, b) => b.totalUnits - a.totalUnits);
    const byLechozo = [...all]
      .filter((p) => p.lechozoUnits > 0)
      .sort((a, b) => b.lechozoUnits - a.lechozoUnits);
    const byVacio = [...all]
      .filter((p) => p.vacioUnits > 0)
      .sort((a, b) => b.vacioUnits - a.vacioUnits);
    const byCommercial = [...all]
      .filter((p) => p.commercialUnits > 0)
      .sort((a, b) => b.commercialUnits - a.commercialUnits);

    const escalafonList = [...all].sort((a, b) =>
      productSortOrder === 'ASC'
        ? a.totalUnits - b.totalUnits || a.totalCOP - b.totalCOP
        : b.totalUnits - a.totalUnits || b.totalCOP - a.totalCOP
    );

    return {
      all,
      mostReturnedProduct: byUnitsDesc[0] || null,
      leastReturnedProduct: byUnitsDesc[byUnitsDesc.length - 1] || null,
      topLechozo: byLechozo[0] || null,
      topVacio: byVacio[0] || null,
      topCommercial: byCommercial[0] || null,
      escalafonList,
    };
  }, [filteredRows, productSortOrder]);

  // Totales Generales del Informe
  const globalTotals = useMemo(() => {
    const totalSales = zoneMetricsList.reduce(
      (acc, z) => acc + z.monthlySalesCOP,
      0
    );
    const totalCOP = filteredRows.reduce((acc, r) => acc + r.totalValueCOP, 0);
    const totalUnits = filteredRows.reduce((acc, r) => acc + r.qtyToReceive, 0);
    const commCOP = filteredRows.reduce(
      (acc, r) => acc + r.commercialValueCOP,
      0
    );
    const commUnits = filteredRows.reduce(
      (acc, r) =>
        acc + r.causes.aCobrar + r.causes.proxVencer + r.causes.vencido,
      0
    );
    const qualCOP = filteredRows.reduce((acc, r) => acc + r.qualityValueCOP, 0);
    const qualUnits = filteredRows.reduce(
      (acc, r) =>
        acc +
        r.causes.vacio +
        r.causes.xFecha +
        r.causes.abomba +
        r.causes.lechozo,
      0
    );
    const lechozoUnits = filteredRows.reduce(
      (acc, r) => acc + r.causes.lechozo,
      0
    );
    const vacioUnits = filteredRows.reduce((acc, r) => acc + r.causes.vacio, 0);

    return {
      totalSales,
      totalCOP,
      totalUnits,
      commCOP,
      commUnits,
      qualCOP,
      qualUnits,
      lechozoUnits,
      vacioUnits,
      pctOverSales: totalSales > 0 ? (totalCOP / totalSales) * 100 : 0,
    };
  }, [zoneMetricsList, filteredRows]);

  // Generador de Impresión / PDF en 1 SOLA HOJA (A4 Horizontal ultra-organizado)
  const handlePrintSinglePageReport = () => {
    const logoUrl = `${window.location.origin}/cardiso_logo.png`;
    const activePeriodLabel =
      dateFilter === 'ALL' ? `${minDate} al ${maxDate}` : `Fecha: ${dateFilter}`;

    const productsRowsHtml = productAnalytics.escalafonList
      .slice(0, 15)
      .map((p, idx) => {
        const action =
          p.commercialUnits > p.qualityUnits
            ? 'Bajar stock ruta'
            : p.lechozoUnits >= p.vacioUnits && p.lechozoUnits > 0
            ? 'Control Lechosidad'
            : p.vacioUnits > 0
            ? 'Revisar Vacío'
            : 'Stock OK';
        return `
          <tr>
            <td style="text-align:center;font-weight:700;color:#475569;">${idx + 1}</td>
            <td style="font-weight:700;color:#0f172a;">${p.productName}</td>
            <td style="text-align:right;color:#b45309;font-weight:600;">${p.commercialUnits}u (${formatCompactCOP(p.commercialCOP)})</td>
            <td style="text-align:right;color:#0369a1;font-weight:600;">${p.qualityUnits}u (${formatCompactCOP(p.qualityCOP)})</td>
            <td style="text-align:center;color:#6d28d9;font-weight:700;">${p.lechozoUnits || '-'}</td>
            <td style="text-align:center;color:#0284c7;font-weight:700;">${p.vacioUnits || '-'}</td>
            <td style="text-align:right;font-weight:800;color:#0f172a;">${p.totalUnits}u · ${formatCompactCOP(p.totalCOP)}</td>
            <td style="font-size:8.5px;color:#1e293b;">${action}</td>
          </tr>
        `;
      })
      .join('');

    const zonesRowsHtml = sortedZones
      .slice(0, 16)
      .map(
        (z, idx) => `
          <tr>
            <td style="text-align:center;font-weight:700;color:#475569;">${idx + 1}</td>
            <td style="font-weight:700;color:#0f172a;">${z.consolidatedName}</td>
            <td style="text-align:right;color:#047857;font-weight:700;">${formatCompactCOP(z.monthlySalesCOP)}</td>
            <td style="text-align:right;color:#b45309;">${formatCompactCOP(z.commercialCOP)} (${z.commercialUnits}u)</td>
            <td style="text-align:right;color:#0369a1;">${formatCompactCOP(z.qualityCOP)} (${z.qualityUnits}u)</td>
            <td style="text-align:right;font-weight:800;color:#0f172a;">${formatCompactCOP(z.totalCOP)}</td>
            <td style="text-align:right;font-weight:700;color:${z.pctTotalOverSales > 6 ? '#be123c' : '#047857'};">${formatPercent(z.pctTotalOverSales)}</td>
          </tr>
        `
      )
      .join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Informe Ejecutivo Cardiso - ${maxDate}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            background: #ffffff;
            color: #0f172a;
            font-size: 9.5px;
            line-height: 1.25;
            padding: 4px;
          }
          .sheet {
            width: 100%;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px 12px;
            background: #ffffff;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #059669;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo {
            height: 40px;
            width: auto;
            object-fit: contain;
          }
          .company-tag {
            font-size: 8.5px;
            font-weight: 800;
            color: #059669;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .report-title {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
          }
          .report-sub {
            font-size: 9px;
            color: #475569;
          }
          .cutoff-box {
            text-align: right;
            background: #ecfdf5;
            border: 1px solid #6ee7b7;
            border-radius: 8px;
            padding: 4px 10px;
          }
          .cutoff-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            color: #047857;
          }
          .cutoff-date {
            font-size: 13px;
            font-weight: 900;
            color: #065f46;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 8px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 5px 8px;
            background: #f8fafc;
          }
          .kpi-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
          }
          .kpi-val {
            font-size: 13px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 1px;
          }
          .kpi-sub {
            font-size: 8px;
            color: #475569;
          }
          .insights-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 8px;
          }
          .insight-box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 6px 8px;
            background: #ffffff;
          }
          .insight-title {
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 4px;
            color: #1e293b;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 2px;
          }
          .insight-line {
            display: flex;
            justify-content: space-between;
            font-size: 8.8px;
            margin-top: 2px;
          }
          .tables-grid {
            display: grid;
            grid-template-columns: 1.12fr 0.88fr;
            gap: 10px;
          }
          .table-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
          }
          .table-header {
            background: #0f172a;
            color: #ffffff;
            padding: 4px 8px;
            font-size: 9px;
            font-weight: 800;
            display: flex;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.4px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            text-transform: uppercase;
            font-size: 7.5px;
            font-weight: 800;
            padding: 3px 4px;
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 2.4px 4px;
            border-bottom: 1px solid #f1f5f9;
            white-space: nowrap;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .footer {
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="header-left">
              <img src="${logoUrl}" class="logo" alt="Cardiso Logo" />
              <div>
                <div class="company-tag">CARDISO S.A.S. · ALIMENTOS CARLA — INFORME EJECUTIVO EN 1 HOJA</div>
                <div class="report-title">RESUMEN GERENCIAL DE VENTAS, CALIDAD E INVENTARIOS</div>
                <div class="report-sub">Administrador General: <strong>${currentUser.name}</strong> · Periodo auditado: <strong>${activePeriodLabel}</strong> (${filteredRows.length} registros)</div>
              </div>
            </div>
            <div class="cutoff-box">
              <div class="cutoff-label">Cambios actualizados hasta</div>
              <div class="cutoff-date">${maxDate}</div>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-label">1. Ventas Totales Mes</div>
              <div class="kpi-val" style="color:#047857;">${formatCOP(globalTotals.totalSales)}</div>
              <div class="kpi-sub">Incidencia global: ${formatPercent(globalTotals.pctOverSales)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">2. Total Devoluciones</div>
              <div class="kpi-val">${formatCOP(globalTotals.totalCOP)}</div>
              <div class="kpi-sub">${formatNumber(globalTotals.totalUnits)} unidades totales</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">3. Devolución Comercial (Ruta)</div>
              <div class="kpi-val" style="color:#b45309;">${formatCOP(globalTotals.commCOP)}</div>
              <div class="kpi-sub">${formatNumber(globalTotals.commUnits)} unds (Bajar Inventario)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">4. Devolución Calidad (Planta)</div>
              <div class="kpi-val" style="color:#0369a1;">${formatCOP(globalTotals.qualCOP)}</div>
              <div class="kpi-sub">Lechoso: ${globalTotals.lechozoUnits}u · Vacío: ${globalTotals.vacioUnits}u</div>
            </div>
          </div>

          <div class="insights-row">
            <div class="insight-box">
              <div class="insight-title">🏆 Desempeño de Ventas por Zona</div>
              <div class="insight-line">
                <span><strong>Más Vende:</strong> ${topSellingZone ? topSellingZone.consolidatedName : 'N/A'}</span>
                <strong style="color:#047857;">${topSellingZone ? formatCompactCOP(topSellingZone.monthlySalesCOP) : '$0'}</strong>
              </div>
              <div class="insight-line">
                <span><strong>Menos Vende:</strong> ${lowestSellingZone ? lowestSellingZone.consolidatedName : 'N/A'}</span>
                <strong style="color:#b45309;">${lowestSellingZone ? formatCompactCOP(lowestSellingZone.monthlySalesCOP) : '$0'}</strong>
              </div>
            </div>

            <div class="insight-box">
              <div class="insight-title">🔬 Productos Críticos en Planta</div>
              <div class="insight-line">
                <span><strong>Más Lechosidad:</strong> ${productAnalytics.topLechozo ? productAnalytics.topLechozo.productName : 'N/A'}</span>
                <strong style="color:#6d28d9;">${productAnalytics.topLechozo ? `${productAnalytics.topLechozo.lechozoUnits}u (${formatCompactCOP(productAnalytics.topLechozo.lechozoCOP)})` : '0u'}</strong>
              </div>
              <div class="insight-line">
                <span><strong>Más Vacío:</strong> ${productAnalytics.topVacio ? productAnalytics.topVacio.productName : 'N/A'}</span>
                <strong style="color:#0284c7;">${productAnalytics.topVacio ? `${productAnalytics.topVacio.vacioUnits}u (${formatCompactCOP(productAnalytics.topVacio.vacioCOP)})` : '0u'}</strong>
              </div>
            </div>

            <div class="insight-box">
              <div class="insight-title">📦 Control de Inventario Comercial</div>
              <div class="insight-line">
                <span><strong>Bajar Pedido:</strong> ${productAnalytics.topCommercial ? productAnalytics.topCommercial.productName : 'N/A'}</span>
                <strong style="color:#b45309;">${productAnalytics.topCommercial ? `${productAnalytics.topCommercial.commercialUnits}u` : '0u'}</strong>
              </div>
              <div class="insight-line">
                <span><strong>Mejor Rotación:</strong> ${productAnalytics.leastReturnedProduct ? productAnalytics.leastReturnedProduct.productName : 'N/A'}</span>
                <strong style="color:#047857;">Solo ${productAnalytics.leastReturnedProduct ? `${productAnalytics.leastReturnedProduct.totalUnits}u` : '0u'}</strong>
              </div>
            </div>
          </div>

          <div class="tables-grid">
            <div class="table-card">
              <div class="table-header">
                <span>ESCALAFÓN DE PRODUCTOS (${productSortOrder === 'ASC' ? 'DE MENOR A MAYOR ↑' : 'DE MAYOR A MENOR ↓'}) — CALIDAD Y COMERCIAL</span>
                <span>Top ${Math.min(15, productAnalytics.escalafonList.length)} de ${productAnalytics.escalafonList.length} ref.</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="text-align:center;">#</th>
                    <th>Producto</th>
                    <th style="text-align:right;">Comercial</th>
                    <th style="text-align:right;">Calidad</th>
                    <th style="text-align:center;">Lech.</th>
                    <th style="text-align:center;">Vacío</th>
                    <th style="text-align:right;">Total</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsRowsHtml}
                </tbody>
              </table>
            </div>

            <div class="table-card">
              <div class="table-header">
                <span>ESCALAFÓN DE ZONAS Y VENDEDORES OFICIALES</span>
                <span>14 Vendedores + Z14/PDV</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="text-align:center;">#</th>
                    <th>Zona / Vendedor</th>
                    <th style="text-align:right;">Ventas Mes</th>
                    <th style="text-align:right;">Comercial</th>
                    <th style="text-align:right;">Calidad</th>
                    <th style="text-align:right;">Total Dev</th>
                    <th style="text-align:right;">% Inc</th>
                  </tr>
                </thead>
                <tbody>
                  ${zonesRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <div class="footer">
            <span>Generado por RetornaOS Enterprise · Cardiso S.A.S. (Alimentos Carla)</span>
            <span>Firma Autorizada: <strong>${currentUser.name} (Administrador General)</strong> · Fecha de corte: ${maxDate}</span>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadCSV = () => {
    const headers = [
      'POSICION_ESCALAFON',
      'PRODUCTO',
      'UNIDADES_COMERCIAL',
      'VALOR_COMERCIAL_COP',
      'UNIDADES_CALIDAD',
      'VALOR_CALIDAD_COP',
      'UNIDADES_LECHOSIDAD',
      'UNIDADES_VACIO',
      'TOTAL_UNIDADES',
      'TOTAL_COP',
      'LOTES_AFECTADOS',
      'ACCION_RECOMENDADA',
    ];
    const rows = productAnalytics.escalafonList.map((p, idx) => {
      const action =
        p.commercialUnits > p.qualityUnits
          ? 'Bajar inventario en ruta / Ajustar pedido comercial'
          : p.lechozoUnits >= p.vacioUnits
          ? 'Correctivo Planta: Revisar choque termico (Lechosidad)'
          : 'Correctivo Planta: Auditar sellado al vacio';
      return [
        idx + 1,
        `"${p.productName}"`,
        p.commercialUnits,
        p.commercialCOP,
        p.qualityUnits,
        p.qualityCOP,
        p.lechozoUnits,
        p.vacioUnits,
        p.totalUnits,
        p.totalCOP,
        `"${Array.from(p.lots).slice(0, 6).join(' | ')}"`,
        `"${action}"`,
      ].join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INFORME_EJECUTIVO_SEBASTIAN_CORTE_${maxDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hoja Única Ejecutiva — Informe Gerencial Compacto (1 Sola Página)"
      subtitle={`Administrador: ${currentUser.name} · Cambios actualizados hasta el día: ${maxDate}`}
      maxWidthClass="max-w-7xl"
    >
      <div className="space-y-4 text-xs text-slate-200">
        {/* Barra Superior de Controles Rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-slate-900/90 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-white">Fecha:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-white/20 bg-slate-950 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300 focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">
                Acumulado ({minDate} a {maxDate})
              </option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  Solo Fecha: {d}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setProductSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
              }
              className="inline-flex items-center gap-1 rounded-xl border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 text-xs font-semibold text-amber-200 transition-all"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Escalafón:{' '}
              {productSortOrder === 'ASC'
                ? 'Menor a Mayor (↑)'
                : 'Mayor a Menor (↓)'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-slate-950 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-all"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={handlePrintSinglePageReport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF en 1 Sola Hoja
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* HOJA ÚNICA EJECUTIVA COMPACTA (TODO EN UNA SOLA VISTA SIN DESORDEN)   */}
        {/* ===================================================================== */}
        <div className="rounded-2xl border border-white/20 bg-slate-950/95 p-4 shadow-2xl space-y-3.5">
          {/* Encabezado Compacto con Logo + 4 KPIs en la misma franja */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-emerald-500/30 pb-3">
            <div className="flex items-center gap-3">
              <img
                src="/cardiso_logo.png"
                alt="Logo Cardiso S.A.S."
                className="h-11 w-auto object-contain drop-shadow"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                    CARDISO S.A.S. · ALIMENTOS CARLA
                  </span>
                  <Badge variant="success" dot>
                    Formato Hoja Única
                  </Badge>
                </div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  INFORME EJECUTIVO DE VENTAS, CALIDAD E INVENTARIOS
                </h2>
                <p className="text-[11px] text-slate-300">
                  Generado por: <strong>Sebastián (Administrador General)</strong> · Cambios hasta:{' '}
                  <strong className="font-mono text-emerald-300">
                    {dateFilter === 'ALL' ? maxDate : dateFilter}
                  </strong>
                </p>
              </div>
            </div>

            {/* 4 Mini KPIs Horizontales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 px-3 py-1.5">
                <div className="text-[9px] uppercase font-bold text-emerald-300">
                  Ventas Mes
                </div>
                <div className="font-mono text-xs sm:text-sm font-extrabold text-white">
                  {formatCompactCOP(globalTotals.totalSales)}
                </div>
                <div className="text-[9px] text-emerald-200">
                  Inc: {formatPercent(globalTotals.pctOverSales)}
                </div>
              </div>

              <div className="rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5">
                <div className="text-[9px] uppercase font-bold text-slate-400">
                  Total Devuelto
                </div>
                <div className="font-mono text-xs sm:text-sm font-extrabold text-white">
                  {formatCompactCOP(globalTotals.totalCOP)}
                </div>
                <div className="text-[9px] text-indigo-300">
                  {formatNumber(globalTotals.totalUnits)} unds
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-950/25 px-3 py-1.5">
                <div className="text-[9px] uppercase font-bold text-amber-300">
                  Comercial (Stock)
                </div>
                <div className="font-mono text-xs sm:text-sm font-extrabold text-amber-300">
                  {formatCompactCOP(globalTotals.commCOP)}
                </div>
                <div className="text-[9px] text-amber-200">
                  {formatNumber(globalTotals.commUnits)} unds
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/25 bg-sky-950/25 px-3 py-1.5">
                <div className="text-[9px] uppercase font-bold text-sky-300">
                  Calidad (Planta)
                </div>
                <div className="font-mono text-xs sm:text-sm font-extrabold text-sky-300">
                  {formatCompactCOP(globalTotals.qualCOP)}
                </div>
                <div className="text-[9px] text-sky-200">
                  Lech: {globalTotals.lechozoUnits}u · Vac: {globalTotals.vacioUnits}u
                </div>
              </div>
            </div>
          </div>

          {/* Fila 2: 3 Tarjetas Ejecutivas Ultra-Compactas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-emerald-500/30 bg-slate-900/90 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                <Award className="h-3.5 w-3.5" />
                1. ¿Qué Zona Vende Más y Cuál Menos?
              </div>
              {topSellingZone && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white truncate">
                    🏆 <strong>Más vende:</strong> {topSellingZone.consolidatedName}
                  </span>
                  <span className="font-mono font-bold text-emerald-300 ml-1">
                    {formatCompactCOP(topSellingZone.monthlySalesCOP)}
                  </span>
                </div>
              )}
              {lowestSellingZone && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 truncate">
                    📉 <strong>Menos vende:</strong> {lowestSellingZone.consolidatedName}
                  </span>
                  <span className="font-mono font-bold text-amber-300 ml-1">
                    {formatCompactCOP(lowestSellingZone.monthlySalesCOP)}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-sky-500/30 bg-slate-900/90 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase text-sky-400 flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5" />
                2. Críticos por Lechosidad y Vacío
              </div>
              {productAnalytics.topLechozo && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white truncate">
                    🥛 <strong>Lechosidad:</strong> {productAnalytics.topLechozo.productName}
                  </span>
                  <span className="font-mono font-bold text-violet-300 ml-1">
                    {productAnalytics.topLechozo.lechozoUnits}u ({formatCompactCOP(productAnalytics.topLechozo.lechozoCOP)})
                  </span>
                </div>
              )}
              {productAnalytics.topVacio && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 truncate">
                    📦 <strong>Vacío:</strong> {productAnalytics.topVacio.productName}
                  </span>
                  <span className="font-mono font-bold text-sky-300 ml-1">
                    {productAnalytics.topVacio.vacioUnits}u ({formatCompactCOP(productAnalytics.topVacio.vacioCOP)})
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                3. Ajuste de Inventarios Comercial
              </div>
              {productAnalytics.topCommercial && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white truncate">
                    ⚠️ <strong>Bajar stock:</strong> {productAnalytics.topCommercial.productName}
                  </span>
                  <span className="font-mono font-bold text-amber-300 ml-1">
                    {productAnalytics.topCommercial.commercialUnits}u
                  </span>
                </div>
              )}
              {productAnalytics.leastReturnedProduct && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 truncate">
                    ✅ <strong>Menor dev.:</strong> {productAnalytics.leastReturnedProduct.productName}
                  </span>
                  <span className="font-mono font-bold text-emerald-300 ml-1">
                    Solo {productAnalytics.leastReturnedProduct.totalUnits}u
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Fila 3: Dos Columnas Lado a Lado (Izquierda: Escalafón Productos | Derecha: Escalafón Zonas) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Columna Izquierda (7 cols): Escalafón de Productos */}
            <div className="lg:col-span-7 rounded-xl border border-white/15 bg-slate-900/90 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between bg-slate-950 px-3 py-2 border-b border-white/10">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Escalafón de Productos ({productSortOrder === 'ASC' ? 'Menor a Mayor ↑' : 'Mayor a Menor ↓'})
                </span>
                <span className="text-[10px] text-slate-400">
                  {productAnalytics.escalafonList.length} referencias
                </span>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-950/60 text-[9px] font-bold uppercase text-slate-400">
                      <th className="py-1.5 pl-2.5 pr-1">#</th>
                      <th className="px-1.5 py-1.5">Producto</th>
                      <th className="px-1.5 py-1.5 text-right text-amber-300">Comerc.</th>
                      <th className="px-1.5 py-1.5 text-right text-sky-300">Calidad</th>
                      <th className="px-1 py-1.5 text-center text-violet-300">Lech</th>
                      <th className="px-1 py-1.5 text-center text-cyan-300">Vac</th>
                      <th className="px-1.5 py-1.5 text-right">Total</th>
                      <th className="py-1.5 pl-1.5 pr-2.5">Correctivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {productAnalytics.escalafonList.map((p, idx) => {
                      const shortAction =
                        p.commercialUnits > p.qualityUnits
                          ? '📉 Bajar stock'
                          : p.lechozoUnits >= p.vacioUnits && p.lechozoUnits > 0
                          ? '🔬 Frío/Lechoso'
                          : p.vacioUnits > 0
                          ? '🛡️ Sello Vacío'
                          : '✅ OK';
                      return (
                        <tr key={p.productName} className="hover:bg-white/[0.04]">
                          <td className="py-1.5 pl-2.5 pr-1 font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-1.5 py-1.5 font-semibold text-white truncate max-w-[155px]">
                            {p.productName}
                          </td>
                          <td className="px-1.5 py-1.5 text-right font-mono text-amber-300">
                            {p.commercialUnits}u
                          </td>
                          <td className="px-1.5 py-1.5 text-right font-mono text-sky-300">
                            {p.qualityUnits}u
                          </td>
                          <td className="px-1 py-1.5 text-center font-mono text-violet-300">
                            {p.lechozoUnits || '-'}
                          </td>
                          <td className="px-1 py-1.5 text-center font-mono text-cyan-300">
                            {p.vacioUnits || '-'}
                          </td>
                          <td className="px-1.5 py-1.5 text-right font-mono font-bold text-white">
                            {p.totalUnits}u · {formatCompactCOP(p.totalCOP)}
                          </td>
                          <td className="py-1.5 pl-1.5 pr-2.5 text-[10px] text-slate-300 whitespace-nowrap">
                            {shortAction}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Columna Derecha (5 cols): Escalafón de Zonas y Vendedores */}
            <div className="lg:col-span-5 rounded-xl border border-white/15 bg-slate-900/90 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between bg-slate-950 px-3 py-2 border-b border-white/10">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
                  Ventas vs. Devoluciones por Zona
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoneSortBy('SALES_DESC')}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      zoneSortBy === 'SALES_DESC'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    +Venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoneSortBy('SALES_ASC')}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      zoneSortBy === 'SALES_ASC'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    -Venta
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-950/60 text-[9px] font-bold uppercase text-slate-400">
                      <th className="py-1.5 pl-2.5 pr-1">#</th>
                      <th className="px-1.5 py-1.5">Zona / Vendedor</th>
                      <th className="px-1.5 py-1.5 text-right text-emerald-300">Ventas</th>
                      <th className="px-1.5 py-1.5 text-right">Dev. Total</th>
                      <th className="py-1.5 pl-1 pr-2.5 text-right">% Inc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {sortedZones.map((z, idx) => (
                      <tr key={z.id} className="hover:bg-white/[0.04]">
                        <td className="py-1.5 pl-2.5 pr-1 font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-1.5 py-1.5 font-semibold text-white truncate max-w-[140px]">
                          {z.consolidatedName}
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono font-bold text-emerald-300">
                          {formatCompactCOP(z.monthlySalesCOP)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono text-white">
                          {formatCompactCOP(z.totalCOP)}
                        </td>
                        <td className="py-1.5 pl-1 pr-2.5 text-right font-mono font-bold">
                          <span
                            className={
                              z.pctTotalOverSales > 6
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }
                          >
                            {formatPercent(z.pctTotalOverSales)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pie de Firma en Hoja Única */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
              <FileCheck2 className="h-3.5 w-3.5" />
              Al pulsar &ldquo;Imprimir / PDF en 1 Sola Hoja&rdquo;, el sistema genera automáticamente la planilla corporativa en formato A4 Horizontal de 1 página.
            </span>
            <span>
              Responsable Administrativo: <strong className="text-white">Sebastián</strong>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
