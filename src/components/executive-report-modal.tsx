import React, { useMemo, useState } from 'react';
import {
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  FlaskConical,
  Briefcase,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  X,
  PackageCheck,
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
  const [productSortOrder, setProductSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [zoneSortBy, setZoneSortBy] = useState<'SALES_DESC' | 'SALES_ASC' | 'RETURNS_DESC'>('SALES_DESC');

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
      if (zoneSortBy === 'SALES_DESC') return b.monthlySalesCOP - a.monthlySalesCOP;
      if (zoneSortBy === 'SALES_ASC') return a.monthlySalesCOP - b.monthlySalesCOP;
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

  const handlePrintReport = () => {
    window.print();
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
    const csv = [headers.join(','), ...rows].join('\n');
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
      title="Informe Ejecutivo Gerencial — Control de Ventas, Calidad e Inventarios"
      subtitle={`Generado por: ${currentUser.name} (${currentUser.roleLabel}) · Datos actualizados desde ${minDate} hasta ${maxDate}`}
      maxWidthClass="max-w-6xl"
    >
      <div className="space-y-6 text-xs text-slate-200 print:bg-white print:text-black">
        {/* Barra de Controles del Informe (Filtro por Fecha, Orden de Escalafón e Impresión) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-white">Filtrar Informe por Fecha:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-white/20 bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-300 focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">
                Acumulado Completo ({minDate} a {maxDate})
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-all"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Escalafón Productos:{' '}
              {productSortOrder === 'ASC'
                ? 'De Menor a Mayor (↑)'
                : 'De Mayor a Menor (↓)'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition-all"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              Descargar Excel (.CSV)
            </button>
            <button
              type="button"
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / Guardar PDF Oficial
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MEMBRETE OFICIAL CON LOGO CARDISO S.A.S. — ALIMENTOS CARLA            */}
        {/* ===================================================================== */}
        <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/60 p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/15 pb-5">
            <div className="flex items-center gap-4">
              <img
                src="/cardiso_logo.png"
                alt="Logo Cardiso S.A.S. - Alimentos Carla"
                className="h-14 w-auto object-contain drop-shadow-md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    CARDISO S.A.S. · ALIMENTOS CARLA
                  </span>
                  <Badge variant="success" dot>
                    Documento Oficial de Auditoría
                  </Badge>
                </div>
                <h2 className="mt-0.5 text-lg sm:text-xl font-extrabold text-white">
                  INFORME GERENCIAL DE VENTAS, DEVOLUCIONES Y PLAN DE INVENTARIOS
                </h2>
                <p className="text-xs text-slate-300">
                  Responsable Administrativo: <strong>Sebastián (Administrador General)</strong> · Corte de cambios hasta: <strong className="text-emerald-300 font-mono">{dateFilter === 'ALL' ? maxDate : dateFilter}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-right shrink-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Fecha Máxima Registrada
              </div>
              <div className="font-mono text-base font-extrabold text-white">
                {maxDate}
              </div>
              <div className="text-[11px] text-slate-300">
                {formatNumber(filteredRows.length)} líneas auditadas
              </div>
            </div>
          </div>

          {/* 4 Indicadores Macro del Informe */}
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-white/15 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Ventas Totales Mes (Zonas)
              </span>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-emerald-400">
                {formatCOP(globalTotals.totalSales)}
              </div>
              <span className="text-[11px] text-slate-300">
                Incidencia Total: {formatPercent(globalTotals.pctOverSales)}
              </span>
            </div>

            <div className="rounded-2xl border border-white/15 bg-slate-900/80 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Total Devoluciones Periodo
              </span>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-white">
                {formatCOP(globalTotals.totalCOP)}
              </div>
              <span className="text-[11px] text-indigo-300">
                {formatNumber(globalTotals.totalUnits)} unidades devueltas
              </span>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Devolución Comercial (Rotación)
              </span>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-amber-300">
                {formatCOP(globalTotals.commCOP)}
              </div>
              <span className="text-[11px] text-amber-200/80">
                {formatNumber(globalTotals.commUnits)} unds (Bajar Inventario)
              </span>
            </div>

            <div className="rounded-2xl border border-sky-500/30 bg-sky-950/25 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                Devolución Calidad Planta
              </span>
              <div className="mt-1 font-mono text-lg sm:text-xl font-extrabold text-sky-300">
                {formatCOP(globalTotals.qualCOP)}
              </div>
              <span className="text-[11px] text-sky-200/80">
                {formatNumber(globalTotals.qualUnits)} unds (Lechoso: {globalTotals.lechozoUnits}u · Vacío: {globalTotals.vacioUnits}u)
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SECCIÓN 1: DIAGNÓSTICO RÁPIDO — ZONAS Y PRODUCTOS EXTREMOS            */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Zona que MÁS vende vs Zona que MENOS vende */}
          <div className="rounded-2xl border border-emerald-500/35 bg-slate-900/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Award className="h-4 w-4" />
                1. Rendimiento de Ventas por Zona
              </span>
              <Badge variant="success">Ventas Mes</Badge>
            </div>
            {topSellingZone && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-2.5">
                <div className="text-[10px] uppercase font-bold text-emerald-300">
                  🏆 Zona que MÁS Vende:
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {topSellingZone.consolidatedName}
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-mono font-bold text-emerald-300">
                    {formatCOP(topSellingZone.monthlySalesCOP)}
                  </span>
                  <span className="text-slate-300">
                    Dev: {formatCOP(topSellingZone.totalCOP)} ({formatPercent(topSellingZone.pctTotalOverSales)})
                  </span>
                </div>
              </div>
            )}
            {lowestSellingZone && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-950/25 p-2.5">
                <div className="text-[10px] uppercase font-bold text-amber-300">
                  📉 Zona de Menor Venta Actual:
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {lowestSellingZone.consolidatedName}
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-mono font-bold text-amber-300">
                    {formatCOP(lowestSellingZone.monthlySalesCOP)}
                  </span>
                  <span className="text-slate-300">
                    Dev: {formatCOP(lowestSellingZone.totalCOP)} ({formatPercent(lowestSellingZone.pctTotalOverSales)})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Producto más devuelto por LECHOSIDAD y por VACÍO */}
          <div className="rounded-2xl border border-sky-500/35 bg-slate-900/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" />
                2. Críticos Planta: Lechosidad & Vacío
              </span>
              <Badge variant="quality">Correctivo Planta</Badge>
            </div>
            {productAnalytics.topLechozo ? (
              <div className="rounded-xl border border-violet-500/30 bg-violet-950/30 p-2.5">
                <div className="text-[10px] uppercase font-bold text-violet-300">
                  🥛 Más devuelto por LECHOSIDAD:
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {productAnalytics.topLechozo.productName}
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-mono font-bold text-violet-300">
                    {productAnalytics.topLechozo.lechozoUnits} unds ({formatCOP(productAnalytics.topLechozo.lechozoCOP)})
                  </span>
                  <span className="font-mono text-[10px] text-slate-300">
                    Lotes: {Array.from(productAnalytics.topLechozo.lots).slice(0, 4).join(', ')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400">Sin registros por lechosidad</div>
            )}

            {productAnalytics.topVacio ? (
              <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 p-2.5">
                <div className="text-[10px] uppercase font-bold text-sky-300">
                  📦 Más devuelto por PÉRDIDA DE VACÍO:
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {productAnalytics.topVacio.productName}
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-mono font-bold text-sky-300">
                    {productAnalytics.topVacio.vacioUnits} unds ({formatCOP(productAnalytics.topVacio.vacioCOP)})
                  </span>
                  <span className="font-mono text-[10px] text-slate-300">
                    Lotes: {Array.from(productAnalytics.topVacio.lots).slice(0, 4).join(', ')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400">Sin registros por vacío</div>
            )}
          </div>

          {/* Producto con Mayor Sobrestock Comercial vs Menor Incidencia */}
          <div className="rounded-2xl border border-amber-500/35 bg-slate-900/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                3. Control de Inventario Comercial
              </span>
              <Badge variant="commercial">Bajar Inventario</Badge>
            </div>
            {productAnalytics.topCommercial && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5">
                <div className="text-[10px] uppercase font-bold text-amber-300">
                  ⚠️ Mayor Devolución Comercial (Bajar Pedido):
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {productAnalytics.topCommercial.productName}
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-mono font-bold text-amber-300">
                    {productAnalytics.topCommercial.commercialUnits} unds ({formatCOP(productAnalytics.topCommercial.commercialCOP)})
                  </span>
                  <span className="text-[10px] text-slate-300">
                    En {productAnalytics.topCommercial.zones.size} zonas
                  </span>
                </div>
              </div>
            )}
            {productAnalytics.leastReturnedProduct && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2.5">
                <div className="text-[10px] uppercase font-bold text-emerald-300">
                  ✅ Producto con Menor Devolución (Mejor Rotación):
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {productAnalytics.leastReturnedProduct.productName}
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-mono font-bold text-emerald-300">
                    Solo {productAnalytics.leastReturnedProduct.totalUnits} unds ({formatCOP(productAnalytics.leastReturnedProduct.totalCOP)})
                  </span>
                  <span className="text-[10px] text-emerald-200">
                    Óptima rotación
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SECCIÓN 2: ESCALAFÓN DE PRODUCTOS DEVUELTOS (CALIDAD Y COMERCIAL)     */}
        {/* ===================================================================== */}
        <div className="rounded-2xl border border-white/15 bg-slate-900/90 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 p-4 bg-slate-950/60">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-emerald-400" />
                Escalafón de Productos Devueltos ({productSortOrder === 'ASC' ? 'De Menor a Mayor ↑' : 'De Mayor a Menor ↓'}) — Toma de Correctivos e Inventarios
              </h3>
              <p className="text-[11px] text-slate-300">
                Desglose exacto por referencia separando Comercial vs. Calidad (Lechosidad y Vacío) para ajustar producción e inventarios.
              </p>
            </div>
            <div className="flex items-center gap-1.5 print:hidden">
              <button
                type="button"
                onClick={() => setProductSortOrder('ASC')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  productSortOrder === 'ASC'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Menor a Mayor (↑)
              </button>
              <button
                type="button"
                onClick={() => setProductSortOrder('DESC')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  productSortOrder === 'DESC'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Mayor a Menor (↓)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 print:max-h-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  <th className="py-2.5 pl-4 pr-2">#</th>
                  <th className="px-2 py-2.5">Producto / Referencia</th>
                  <th className="px-2 py-2.5 text-center text-amber-300">Comercial (Und / $)</th>
                  <th className="px-2 py-2.5 text-center text-sky-300">Calidad (Und / $)</th>
                  <th className="px-2 py-2.5 text-center text-violet-300">Lechoso</th>
                  <th className="px-2 py-2.5 text-center text-cyan-300">Vacío</th>
                  <th className="px-2 py-2.5 text-right">Total Devuelto</th>
                  <th className="py-2.5 pl-2 pr-4">Acción Correctiva / Inventario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07] text-xs">
                {productAnalytics.escalafonList.map((p, idx) => {
                  const action =
                    p.commercialUnits > p.qualityUnits
                      ? '📉 Bajar inventario en ruta / Reducir despacho comercial'
                      : p.lechozoUnits >= p.vacioUnits && p.lechozoUnits > 0
                      ? '🔬 Planta: Controlar lechosidad y cadena de frío'
                      : p.vacioUnits > 0
                      ? '🛡️ Planta: Revisar termoformado / sellado al vacío'
                      : '✅ Mantener stock controlado';

                  return (
                    <tr key={p.productName} className="hover:bg-white/[0.04]">
                      <td className="py-2.5 pl-4 pr-2 font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-semibold text-white">
                          {p.productName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Lotes: {Array.from(p.lots).slice(0, 4).join(', ') || 'S/L'} · {p.zones.size} zona(s)
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono">
                        <span className="font-bold text-amber-300">
                          {p.commercialUnits} u
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {formatCOP(p.commercialCOP)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono">
                        <span className="font-bold text-sky-300">
                          {p.qualityUnits} u
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {formatCOP(p.qualityCOP)}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-violet-300 font-semibold">
                        {p.lechozoUnits > 0 ? `${p.lechozoUnits} u` : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-cyan-300 font-semibold">
                        {p.vacioUnits > 0 ? `${p.vacioUnits} u` : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">
                        <div className="font-bold text-white">
                          {formatCOP(p.totalCOP)}
                        </div>
                        <div className="text-[10px] text-emerald-400">
                          {p.totalUnits} unds totales
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 pr-4 text-[11px] text-slate-200">
                        {action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SECCIÓN 3: RANKING DE ZONAS (QUÉ ZONA VENDE MÁS Y CUÁL VENDE MENOS)   */}
        {/* ===================================================================== */}
        <div className="rounded-2xl border border-white/15 bg-slate-900/90 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 p-4 bg-slate-950/60">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                Escalafón de Zonas y Vendedores — Ventas del Mes vs. Devoluciones
              </h3>
              <p className="text-[11px] text-slate-300">
                Comparativa oficial de las 14 zonas de vendedores (`Z01` a `Z13` y `Z16`), Clientes `Z14` y Puntos de Venta.
              </p>
            </div>
            <div className="flex items-center gap-1.5 print:hidden">
              <button
                type="button"
                onClick={() => setZoneSortBy('SALES_DESC')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  zoneSortBy === 'SALES_DESC'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Mayor Venta
              </button>
              <button
                type="button"
                onClick={() => setZoneSortBy('SALES_ASC')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  zoneSortBy === 'SALES_ASC'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Menor Venta
              </button>
              <button
                type="button"
                onClick={() => setZoneSortBy('RETURNS_DESC')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  zoneSortBy === 'RETURNS_DESC'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Mayor Devolución
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 print:max-h-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  <th className="py-2.5 pl-4 pr-2">#</th>
                  <th className="px-2 py-2.5">Zona / Vendedor Oficial</th>
                  <th className="px-2 py-2.5 text-right text-emerald-300">Ventas del Mes</th>
                  <th className="px-2 py-2.5 text-right text-amber-300">Dev. Comercial</th>
                  <th className="px-2 py-2.5 text-right text-sky-300">Dev. Calidad</th>
                  <th className="px-2 py-2.5 text-right">Total Devolución</th>
                  <th className="py-2.5 pl-2 pr-4 text-right">% Incidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07] text-xs">
                {sortedZones.map((z, idx) => (
                  <tr key={z.id} className="hover:bg-white/[0.04]">
                    <td className="py-2 pl-4 pr-2 font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="px-2 py-2 font-semibold text-white">
                      {z.consolidatedName}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-emerald-300">
                      {formatCOP(z.monthlySalesCOP)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-amber-300">
                      {formatCOP(z.commercialCOP)} ({z.commercialUnits}u)
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-sky-300">
                      {formatCOP(z.qualityCOP)} ({z.qualityUnits}u)
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-white">
                      {formatCOP(z.totalCOP)}
                    </td>
                    <td className="py-2 pl-2 pr-4 text-right font-mono">
                      <Badge
                        variant={
                          z.pctTotalOverSales > 8
                            ? 'danger'
                            : z.pctTotalOverSales > 5
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {formatPercent(z.pctTotalOverSales)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
