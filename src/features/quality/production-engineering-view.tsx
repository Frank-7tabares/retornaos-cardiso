import React, { useMemo, useState } from 'react';
import {
  FlaskConical,
  Search,
  Calendar,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Package,
  Download,
  X,
  FileSpreadsheet,
  BarChart3,
  Layers,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { CAUSE_METADATA } from '../../lib/real-excel-data';
import { formatCOP, formatNumber, formatPercent } from '../../lib/utils';
import { ComputedReturnRow, ReturnCauseKey } from '../../types/returns';

interface ProductionEngineeringViewProps {
  returnRows: ComputedReturnRow[];
  onUpdateRowEvidence?: (
    rowId: string,
    photoUrl: string,
    technicalDiagnosis: string,
    storageTempC: number
  ) => void;
  onOpenExcelModal?: () => void;
}

interface ProductQualitySummary {
  productId: string;
  productName: string;
  totalUnits: number;
  qualityUnits: number;
  commercialUnits: number;
  totalCOP: number;
  qualityCOP: number;
  commercialCOP: number;
  causes: Record<ReturnCauseKey, number>;
  dominantCauseKey: ReturnCauseKey;
  dominantCauseUnits: number;
  lotsMap: Map<
    string,
    {
      lot: string;
      totalUnits: number;
      lechozo: number;
      vacio: number;
      xFecha: number;
      abomba: number;
      proxVencer: number;
    }
  >;
}

export const ProductionEngineeringView: React.FC<
  ProductionEngineeringViewProps
> = ({ returnRows, onOpenExcelModal }) => {
  const [selectedProductFilter, setSelectedProductFilter] =
    useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [selectedLotFilter, setSelectedLotFilter] = useState<string>('ALL');
  const [causeFilter, setCauseFilter] = useState<'ALL' | 'CALIDAD' | ReturnCauseKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'MATRIX' | 'DETAIL'>('MATRIX');
  const [chartBarMode, setChartBarMode] = useState<'LOTS' | 'DATES'>('LOTS');

  // Unique dates present in returnRows
  const uniqueDates = useMemo(() => {
    const set = new Set<string>();
    returnRows.forEach((r) => {
      if (r.date) set.add(r.date);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [returnRows]);

  // Unique lots present in returnRows
  const uniqueLots = useMemo(() => {
    const set = new Set<string>();
    returnRows.forEach((r) => {
      if (r.lotNumber && r.lotNumber !== 'S/L') set.add(r.lotNumber);
    });
    return Array.from(set).sort();
  }, [returnRows]);

  // Unique products present in returnRows
  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    returnRows.forEach((r) => {
      map.set(r.productName, r.productName);
    });
    return Array.from(map.keys()).sort();
  }, [returnRows]);

  const filteredRows = useMemo(() => {
    return returnRows.filter((row) => {
      if (
        selectedProductFilter !== 'ALL' &&
        row.productName !== selectedProductFilter
      ) {
        return false;
      }
      if (selectedDateFilter !== 'ALL' && row.date !== selectedDateFilter) {
        return false;
      }
      if (selectedLotFilter !== 'ALL' && row.lotNumber !== selectedLotFilter) {
        return false;
      }
      if (causeFilter === 'CALIDAD') {
        const qSum =
          row.causes.lechozo +
          row.causes.vacio +
          row.causes.xFecha +
          row.causes.abomba;
        if (qSum <= 0) return false;
      } else if (causeFilter !== 'ALL') {
        if ((row.causes[causeFilter] || 0) <= 0) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.productName.toLowerCase().includes(q) ||
          row.lotNumber.toLowerCase().includes(q) ||
          row.clientName.toLowerCase().includes(q) ||
          row.zoneName.toLowerCase().includes(q) ||
          row.observations.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    returnRows,
    selectedProductFilter,
    selectedDateFilter,
    selectedLotFilter,
    causeFilter,
    searchQuery,
  ]);

  // Aggregate global KPI metrics
  const globalMetrics = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.totalUnits += r.qtyToReceive;
        acc.totalCOP += r.totalValueCOP;
        acc.qualityCOP += r.qualityValueCOP;
        acc.commercialCOP += r.commercialValueCOP;
        acc.lechozoUnits += r.causes.lechozo;
        acc.vacioUnits += r.causes.vacio;
        acc.xFechaUnits += r.causes.xFecha;
        acc.abombaUnits += r.causes.abomba;
        acc.proxVencerUnits += r.causes.proxVencer;
        acc.vencidoUnits += r.causes.vencido;
        acc.aCobrarUnits += r.causes.aCobrar;
        return acc;
      },
      {
        totalUnits: 0,
        totalCOP: 0,
        qualityCOP: 0,
        commercialCOP: 0,
        lechozoUnits: 0,
        vacioUnits: 0,
        xFechaUnits: 0,
        abombaUnits: 0,
        proxVencerUnits: 0,
        vencidoUnits: 0,
        aCobrarUnits: 0,
      }
    );
  }, [filteredRows]);

  // Datos para las Gráficas de Ingeniería de Producción (Causas, Lotes y Fechas)
  const engineeringChartsData = useMemo(() => {
    const causesList = [
      {
        key: 'lechozo' as ReturnCauseKey,
        label: 'Lechosidad (Planta)',
        units: globalMetrics.lechozoUnits,
        colorHex: '#8b5cf6',
        barClass: 'bg-violet-500',
        textClass: 'text-violet-300',
      },
      {
        key: 'vacio' as ReturnCauseKey,
        label: 'Pérdida de Vacío (Planta)',
        units: globalMetrics.vacioUnits,
        colorHex: '#0ea5e9',
        barClass: 'bg-sky-500',
        textClass: 'text-sky-300',
      },
      {
        key: 'proxVencer' as ReturnCauseKey,
        label: 'Próx. a Vencer (Comercial)',
        units: globalMetrics.proxVencerUnits,
        colorHex: '#f59e0b',
        barClass: 'bg-amber-500',
        textClass: 'text-amber-300',
      },
      {
        key: 'xFecha' as ReturnCauseKey,
        label: 'Por Fecha / Abombamiento',
        units: globalMetrics.xFechaUnits + globalMetrics.abombaUnits,
        colorHex: '#06b6d4',
        barClass: 'bg-cyan-500',
        textClass: 'text-cyan-300',
      },
      {
        key: 'aCobrar' as ReturnCauseKey,
        label: 'A Cobrar / Vencido',
        units: globalMetrics.aCobrarUnits + globalMetrics.vencidoUnits,
        colorHex: '#f43f5e',
        barClass: 'bg-rose-500',
        textClass: 'text-rose-300',
      },
    ];

    const totalCauseUnits = Math.max(
      1,
      causesList.reduce((acc, c) => acc + c.units, 0)
    );

    // Top 7 Lotes para gráfica de columnas
    const lotMap = new Map<
      string,
      { lot: string; qualityUnits: number; commercialUnits: number; totalUnits: number }
    >();
    // Fechas para gráfica de evolución temporal
    const dateMap = new Map<
      string,
      { date: string; qualityUnits: number; commercialUnits: number; totalUnits: number }
    >();

    for (const r of filteredRows) {
      const qU =
        r.causes.lechozo + r.causes.vacio + r.causes.xFecha + r.causes.abomba;
      const cU = r.causes.aCobrar + r.causes.proxVencer + r.causes.vencido;

      if (r.lotNumber && r.lotNumber !== 'S/L') {
        const prevLot = lotMap.get(r.lotNumber) || {
          lot: r.lotNumber,
          qualityUnits: 0,
          commercialUnits: 0,
          totalUnits: 0,
        };
        prevLot.qualityUnits += qU;
        prevLot.commercialUnits += cU;
        prevLot.totalUnits += r.qtyToReceive;
        lotMap.set(r.lotNumber, prevLot);
      }

      if (r.date) {
        const prevDate = dateMap.get(r.date) || {
          date: r.date,
          qualityUnits: 0,
          commercialUnits: 0,
          totalUnits: 0,
        };
        prevDate.qualityUnits += qU;
        prevDate.commercialUnits += cU;
        prevDate.totalUnits += r.qtyToReceive;
        dateMap.set(r.date, prevDate);
      }
    }

    const topLotsChart = Array.from(lotMap.values())
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 8);

    const timelineChart = Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8);

    return {
      causesList,
      totalCauseUnits,
      topLotsChart,
      timelineChart,
    };
  }, [filteredRows, globalMetrics]);

  // Consolidate Product vs Cause & Lots Matrix
  const productMatrix = useMemo<ProductQualitySummary[]>(() => {
    const map = new Map<string, ProductQualitySummary>();

    for (const r of filteredRows) {
      const key = r.productName;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          productId: r.productId,
          productName: r.productName,
          totalUnits: 0,
          qualityUnits: 0,
          commercialUnits: 0,
          totalCOP: 0,
          qualityCOP: 0,
          commercialCOP: 0,
          causes: {
            aCobrar: 0,
            xFecha: 0,
            vacio: 0,
            proxVencer: 0,
            vencido: 0,
            abomba: 0,
            lechozo: 0,
          },
          dominantCauseKey: 'lechozo',
          dominantCauseUnits: 0,
          lotsMap: new Map(),
        };
        map.set(key, entry);
      }

      const qUnits =
        r.causes.lechozo + r.causes.vacio + r.causes.xFecha + r.causes.abomba;
      const cUnits =
        r.causes.aCobrar + r.causes.proxVencer + r.causes.vencido;

      entry.totalUnits += r.qtyToReceive;
      entry.qualityUnits += qUnits;
      entry.commercialUnits += cUnits;
      entry.totalCOP += r.totalValueCOP;
      entry.qualityCOP += r.qualityValueCOP;
      entry.commercialCOP += r.commercialValueCOP;

      entry.causes.aCobrar += r.causes.aCobrar;
      entry.causes.xFecha += r.causes.xFecha;
      entry.causes.vacio += r.causes.vacio;
      entry.causes.proxVencer += r.causes.proxVencer;
      entry.causes.vencido += r.causes.vencido;
      entry.causes.abomba += r.causes.abomba;
      entry.causes.lechozo += r.causes.lechozo;

      if (r.lotNumber && r.lotNumber !== 'S/L') {
        const lotItem = entry.lotsMap.get(r.lotNumber) || {
          lot: r.lotNumber,
          totalUnits: 0,
          lechozo: 0,
          vacio: 0,
          xFecha: 0,
          abomba: 0,
          proxVencer: 0,
        };
        lotItem.totalUnits += r.qtyToReceive;
        lotItem.lechozo += r.causes.lechozo;
        lotItem.vacio += r.causes.vacio;
        lotItem.xFecha += r.causes.xFecha;
        lotItem.abomba += r.causes.abomba;
        lotItem.proxVencer += r.causes.proxVencer;
        entry.lotsMap.set(r.lotNumber, lotItem);
      }
    }

    const list = Array.from(map.values()).map((item) => {
      const pairs: Array<[ReturnCauseKey, number]> = [
        ['lechozo', item.causes.lechozo],
        ['vacio', item.causes.vacio],
        ['xFecha', item.causes.xFecha],
        ['abomba', item.causes.abomba],
        ['proxVencer', item.causes.proxVencer],
        ['vencido', item.causes.vencido],
        ['aCobrar', item.causes.aCobrar],
      ];
      pairs.sort((a, b) => b[1] - a[1]);
      item.dominantCauseKey = pairs[0][0];
      item.dominantCauseUnits = pairs[0][1];
      return item;
    });

    // Sort prioritizing quality defects (Lechozo + Vacío) or total units
    return list.sort((a, b) => {
      if (causeFilter !== 'ALL' && causeFilter !== 'CALIDAD') {
        return b.causes[causeFilter] - a.causes[causeFilter];
      }
      if (b.qualityUnits !== a.qualityUnits) {
        return b.qualityUnits - a.qualityUnits;
      }
      return b.totalUnits - a.totalUnits;
    });
  }, [filteredRows, causeFilter]);

  // Top Critical Quality Alerts (Product + Lot with high Lechosidad or Vacío)
  const topQualityAlerts = useMemo(() => {
    const alerts: Array<{
      productName: string;
      totalDefectUnits: number;
      mainDefectLabel: string;
      mainDefectKey: ReturnCauseKey;
      qualityCOP: number;
      topLots: Array<{ lot: string; units: number }>;
      recommendation: string;
    }> = [];

    for (const prod of productMatrix) {
      if (prod.qualityUnits <= 0) continue;
      const isLechozoMain = prod.causes.lechozo >= prod.causes.vacio;
      const mainKey: ReturnCauseKey = isLechozoMain ? 'lechozo' : 'vacio';
      const meta =
        CAUSE_METADATA.find((c) => c.key === mainKey) || CAUSE_METADATA[3];

      const sortedLots = Array.from(prod.lotsMap.values())
        .filter((l) => l.lechozo + l.vacio + l.xFecha + l.abomba > 0)
        .sort(
          (a, b) =>
            b.lechozo + b.vacio - (a.lechozo + a.vacio)
        )
        .slice(0, 4)
        .map((l) => ({
          lot: l.lot,
          units: l.lechozo + l.vacio + l.xFecha + l.abomba,
        }));

      alerts.push({
        productName: prod.productName,
        totalDefectUnits: prod.qualityUnits,
        mainDefectLabel: isLechozoMain
          ? `${prod.causes.lechozo} und por Lechosidad`
          : `${prod.causes.vacio} und por Pérdida de Vacío`,
        mainDefectKey: mainKey,
        qualityCOP: prod.qualityCOP,
        topLots: sortedLots,
        recommendation: meta.recommendedAction,
      });
    }

    return alerts.slice(0, 4);
  }, [productMatrix]);

  const handleExportQualityCSV = () => {
    const headers = [
      'Producto',
      'Total Unidades Devueltas',
      'Unidades Calidad (Planta)',
      'Unidades Comercial (Ruta)',
      'Lechoso (Und)',
      'Vacio (Und)',
      'Por Fecha (Und)',
      'Abombamiento (Und)',
      'Prox. a Vencer (Und)',
      'Vencido (Und)',
      'A Cobrar (Und)',
      'Lotes Criticos',
      'Costo Calidad COP',
      'Costo Comercial COP',
      'Total COP',
    ];

    const lines = productMatrix.map((p) => {
      const lotsStr = Array.from(p.lotsMap.values())
        .sort((a, b) => b.totalUnits - a.totalUnits)
        .slice(0, 5)
        .map((l) => `L-${l.lot}(${l.totalUnits}u)`)
        .join(' / ');

      return [
        `"${p.productName}"`,
        p.totalUnits,
        p.qualityUnits,
        p.commercialUnits,
        p.causes.lechozo,
        p.causes.vacio,
        p.causes.xFecha,
        p.causes.abomba,
        p.causes.proxVencer,
        p.causes.vencido,
        p.causes.aCobrar,
        `"${lotsStr}"`,
        p.qualityCOP,
        p.commercialCOP,
        p.totalCOP,
      ].join(';');
    });

    const csv = '\uFEFF' + [headers.join(';'), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_Calidad_Lotes_Cardiso_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Informe Ejecutivo de Calidad exportado', {
      description: 'Archivo CSV listo para abrir en Excel.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Executive Header */}
      <div className="rounded-3xl border border-white/20 bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="quality" dot>
                Informe Ejecutivo · Ingeniería de Calidad & Planta
              </Badge>
              <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-3 py-0.5 text-xs font-medium text-violet-300">
                Análisis Automático por Producto, Causa y Lote
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
              Diagnóstico de Calidad por Producto, Lotes Críticos y Causales
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Reporte consolidado generado directamente desde el Excel de devoluciones. Identifica al instante qué productos y qué <strong>Lotes</strong> presentan mayor incidencia por <strong>Lechosidad</strong>, <strong>Pérdida de Vacío</strong> o <strong>Rotación Comercial</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenExcelModal && (
              <button
                type="button"
                onClick={onOpenExcelModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Actualizar desde Excel (.xlsx)
              </button>
            )}
            <button
              type="button"
              onClick={handleExportQualityCSV}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-all"
            >
              <Download className="h-4 w-4 text-sky-400" />
              Descargar Informe Calidad (Excel)
            </button>
          </div>
        </div>

        {/* 5 Executive KPI Cards */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
              Devolución por Lechosidad
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-white">
              {formatNumber(globalMetrics.lechozoUnits)} und
            </div>
            <div className="text-[11px] text-violet-200/80 mt-0.5">
              Exudado / Choques térmicos
            </div>
          </div>

          <div className="rounded-2xl border border-sky-500/35 bg-sky-500/10 p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
              Pérdida de Vacío
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-white">
              {formatNumber(globalMetrics.vacioUnits)} und
            </div>
            <div className="text-[11px] text-sky-200/80 mt-0.5">
              Sellado / Empaque termoformado
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              Por Fecha / Abombamiento
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-white">
              {formatNumber(globalMetrics.xFechaUnits + globalMetrics.abombaUnits)} und
            </div>
            <div className="text-[11px] text-cyan-200/80 mt-0.5">
              Marcación / Gasificación
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Impacto Planta (Calidad)
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-emerald-300">
              {formatCOP(globalMetrics.qualityCOP)}
            </div>
            <div className="text-[11px] text-emerald-200/80 mt-0.5">
              {globalMetrics.totalCOP > 0
                ? `${formatPercent((globalMetrics.qualityCOP / globalMetrics.totalCOP) * 100)} del total`
                : '0%'}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Impacto Comercial (Ruta)
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-amber-300">
              {formatCOP(globalMetrics.commercialCOP)}
            </div>
            <div className="text-[11px] text-amber-200/80 mt-0.5">
              Próx. Vencer: {formatNumber(globalMetrics.proxVencerUnits)} und
            </div>
          </div>
        </div>
      </div>

      {/* Radar of Critical Products & Lots (Semáforo de Calidad) */}
      {topQualityAlerts.length > 0 && (
        <div className="rounded-3xl border border-violet-500/30 bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-violet-400" />
              <h2 className="text-sm sm:text-base font-bold text-white">
                Semáforo de Productos Críticos en Planta (Mayor Devolución por Lechosidad y Vacío)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Haz clic en cualquier tarjeta o lote para filtrar su trazabilidad
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {topQualityAlerts.map((alert, idx) => (
              <div
                key={alert.productName}
                onClick={() =>
                  setSelectedProductFilter(
                    selectedProductFilter === alert.productName
                      ? 'ALL'
                      : alert.productName
                  )
                }
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  selectedProductFilter === alert.productName
                    ? 'border-violet-400 bg-violet-950/50 shadow-lg shadow-violet-500/20'
                    : 'border-white/15 bg-slate-900/80 hover:border-violet-400/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    #{idx + 1} Crítico Planta
                  </span>
                  <span className="font-mono text-xs font-bold text-violet-300">
                    {formatCOP(alert.qualityCOP)}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-white leading-snug">
                  {alert.productName}
                </h3>

                <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{alert.mainDefectLabel}</span>
                </div>

                {/* Lots involved */}
                <div className="mt-3 pt-2.5 border-t border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                    Lotes más afectados:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {alert.topLots.length > 0 ? (
                      alert.topLots.map((l) => (
                        <button
                          key={l.lot}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLotFilter(
                              selectedLotFilter === l.lot ? 'ALL' : l.lot
                            );
                          }}
                          className={`rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold border transition-all ${
                            selectedLotFilter === l.lot
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                              : 'bg-slate-950 text-emerald-300 border-emerald-500/30 hover:border-emerald-400'
                          }`}
                        >
                          Lote #{l.lot} ({l.units}u)
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500">Sin lote</span>
                    )}
                  </div>
                </div>

                <p className="mt-2.5 text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                  {alert.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANEL DE GRÁFICAS ANALÍTICAS DE INGENIERÍA DE PRODUCCIÓN Y CALIDAD    */}
      {/* ===================================================================== */}
      {filteredRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Gráfica 1 (4 Cols): Anillo SVG + Distribución por Causa en Planta */}
          <div className="lg:col-span-4 rounded-3xl border border-white/15 bg-slate-950/90 backdrop-blur-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-violet-400" />
                    1. Gráfica de Distribución por Causa
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Haz clic en una barra para filtrar esa causal
                  </p>
                </div>
                <Badge variant="quality">
                  {formatNumber(globalMetrics.totalUnits)} unds
                </Badge>
              </div>

              {/* Donut SVG + Resumen Central */}
              <div className="flex items-center gap-4 my-3 p-3 rounded-2xl border border-white/10 bg-slate-900/70">
                <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="transparent"
                      stroke="#1e293b"
                      strokeWidth="4.5"
                    />
                    {(() => {
                      let accumulatedPct = 0;
                      const circumference = 2 * Math.PI * 14;
                      return engineeringChartsData.causesList.map((c) => {
                        const pct =
                          (c.units / engineeringChartsData.totalCauseUnits) *
                          100;
                        if (pct <= 0) return null;
                        const strokeDasharray = `${
                          (pct / 100) * circumference
                        } ${circumference}`;
                        const strokeDashoffset = -(
                          (accumulatedPct / 100) *
                          circumference
                        );
                        accumulatedPct += pct;
                        return (
                          <circle
                            key={c.key}
                            cx="18"
                            cy="18"
                            r="14"
                            fill="transparent"
                            stroke={c.colorHex}
                            strokeWidth="4.5"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-xs font-extrabold text-white">
                      {globalMetrics.totalUnits > 0
                        ? Math.round(
                            ((globalMetrics.lechozoUnits +
                              globalMetrics.vacioUnits +
                              globalMetrics.xFechaUnits +
                              globalMetrics.abombaUnits) /
                              globalMetrics.totalUnits) *
                              100
                          )
                        : 0}
                      %
                    </span>
                    <span className="text-[9px] uppercase text-sky-300 font-bold">
                      Planta
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-violet-300 font-semibold">
                      🟣 Lechosidad:
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatNumber(globalMetrics.lechozoUnits)} u
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sky-300 font-semibold">
                      🔵 Vacío:
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatNumber(globalMetrics.vacioUnits)} u
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-semibold">
                      🟠 Comercial:
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatNumber(
                        globalMetrics.proxVencerUnits +
                          globalMetrics.aCobrarUnits +
                          globalMetrics.vencidoUnits
                      )}{' '}
                      u
                    </span>
                  </div>
                </div>
              </div>

              {/* Barras horizontales por cada causa */}
              <div className="space-y-2 mt-3">
                {engineeringChartsData.causesList.map((c) => {
                  const pct =
                    (c.units / engineeringChartsData.totalCauseUnits) * 100;
                  const active = causeFilter === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() =>
                        setCauseFilter(active ? 'ALL' : c.key)
                      }
                      className={`w-full text-left rounded-xl p-2 border transition-all ${
                        active
                          ? 'border-white/40 bg-white/10'
                          : 'border-white/5 bg-slate-900/50 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={`font-semibold ${c.textClass}`}>
                          {c.label}
                        </span>
                        <span className="font-mono text-white font-bold">
                          {formatNumber(c.units)} u ({formatPercent(pct, 1)})
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.barClass} transition-all duration-500`}
                          style={{ width: `${Math.max(pct, c.units > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Gráfica 2 (4 Cols): Barras Apiladas Top Productos (Lechosidad / Vacío / Comercial) */}
          <div className="lg:col-span-4 rounded-3xl border border-white/15 bg-slate-950/90 backdrop-blur-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-sky-400" />
                    2. Gráfica Top Productos (Calidad vs. Ruta)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comparativa visual de Lechosidad, Vacío y Comercial
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-violet-300">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    Lech.
                  </span>
                  <span className="inline-flex items-center gap-1 text-sky-300">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Vacío
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Com.
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 mt-2">
                {(() => {
                  const topProds = productMatrix.slice(0, 7);
                  const maxProdUnits = Math.max(
                    1,
                    ...topProds.map((p) => p.totalUnits)
                  );
                  return topProds.map((p) => {
                    const lechPct = (p.causes.lechozo / maxProdUnits) * 100;
                    const vacPct =
                      ((p.causes.vacio + p.causes.xFecha + p.causes.abomba) /
                        maxProdUnits) *
                      100;
                    const commPct = (p.commercialUnits / maxProdUnits) * 100;
                    const isSelected = selectedProductFilter === p.productName;

                    return (
                      <div
                        key={p.productName}
                        onClick={() =>
                          setSelectedProductFilter(
                            isSelected ? 'ALL' : p.productName
                          )
                        }
                        className={`cursor-pointer rounded-xl p-2 border transition-all ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-950/30'
                            : 'border-white/5 bg-slate-900/60 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-white truncate max-w-[180px]">
                            {p.productName}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-200 shrink-0 ml-2">
                            {p.totalUnits} u · {formatCOP(p.totalCOP)}
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                          {p.causes.lechozo > 0 && (
                            <div
                              title={`Lechosidad: ${p.causes.lechozo}u`}
                              className="h-full bg-violet-500"
                              style={{ width: `${Math.max(lechPct, 3)}%` }}
                            />
                          )}
                          {p.causes.vacio + p.causes.xFecha + p.causes.abomba >
                            0 && (
                            <div
                              title={`Vacío / Fecha: ${
                                p.causes.vacio +
                                p.causes.xFecha +
                                p.causes.abomba
                              }u`}
                              className="h-full bg-sky-500"
                              style={{ width: `${Math.max(vacPct, 3)}%` }}
                            />
                          )}
                          {p.commercialUnits > 0 && (
                            <div
                              title={`Comercial: ${p.commercialUnits}u`}
                              className="h-full bg-amber-500"
                              style={{ width: `${Math.max(commPct, 3)}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Gráfica 3 (4 Cols): Columnas Verticales por Lotes Críticos o Evolución por Fecha */}
          <div className="lg:col-span-4 rounded-3xl border border-white/15 bg-slate-950/90 backdrop-blur-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-emerald-400" />
                    3. Gráfica por {chartBarMode === 'LOTS' ? 'Lotes Críticos' : 'Fecha de Registro'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Haz clic en cualquier columna para filtrar
                  </p>
                </div>

                <div className="inline-flex rounded-xl border border-white/15 bg-slate-900 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setChartBarMode('LOTS')}
                    className={`rounded-lg px-2 py-1 font-bold transition-all ${
                      chartBarMode === 'LOTS'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Por Lotes
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartBarMode('DATES')}
                    className={`rounded-lg px-2 py-1 font-bold transition-all ${
                      chartBarMode === 'DATES'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Por Fechas
                  </button>
                </div>
              </div>

              {/* Columnas Verticales Interactivas */}
              <div className="mt-4 h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2 rounded-2xl border border-white/10 bg-slate-900/60">
                {chartBarMode === 'LOTS' ? (
                  engineeringChartsData.topLotsChart.length > 0 ? (
                    (() => {
                      const maxLotU = Math.max(
                        1,
                        ...engineeringChartsData.topLotsChart.map(
                          (l) => l.totalUnits
                        )
                      );
                      return engineeringChartsData.topLotsChart.map((item) => {
                        const heightPct = Math.max(
                          12,
                          Math.round((item.totalUnits / maxLotU) * 100)
                        );
                        const qualRatio =
                          item.totalUnits > 0
                            ? Math.round(
                                (item.qualityUnits / item.totalUnits) * 100
                              )
                            : 0;
                        const active = selectedLotFilter === item.lot;
                        return (
                          <button
                            key={item.lot}
                            type="button"
                            onClick={() =>
                              setSelectedLotFilter(active ? 'ALL' : item.lot)
                            }
                            className="flex-1 flex flex-col items-center h-full justify-end group"
                            title={`Lote #${item.lot}: ${item.totalUnits} unds (${item.qualityUnits}u Calidad / ${item.commercialUnits}u Comercial)`}
                          >
                            <span className="font-mono text-[10px] font-bold text-slate-300 mb-1 group-hover:text-emerald-300">
                              {item.totalUnits}u
                            </span>
                            <div
                              className={`w-full max-w-[34px] rounded-t-xl overflow-hidden flex flex-col justify-end transition-all ${
                                active
                                  ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30'
                                  : 'opacity-90 group-hover:opacity-100'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            >
                              <div
                                className="w-full bg-amber-500"
                                style={{ height: `${100 - qualRatio}%` }}
                              />
                              <div
                                className="w-full bg-violet-500"
                                style={{ height: `${qualRatio}%` }}
                              />
                            </div>
                            <span
                              className={`mt-1.5 font-mono text-[10px] font-bold truncate max-w-full ${
                                active ? 'text-emerald-300' : 'text-slate-400'
                              }`}
                            >
                              L-{item.lot}
                            </span>
                          </button>
                        );
                      });
                    })()
                  ) : (
                    <div className="w-full text-center text-xs text-slate-400 self-center">
                      Sin lotes para mostrar
                    </div>
                  )
                ) : engineeringChartsData.timelineChart.length > 0 ? (
                  (() => {
                    const maxDateU = Math.max(
                      1,
                      ...engineeringChartsData.timelineChart.map(
                        (d) => d.totalUnits
                      )
                    );
                    return engineeringChartsData.timelineChart.map((item) => {
                      const heightPct = Math.max(
                        12,
                        Math.round((item.totalUnits / maxDateU) * 100)
                      );
                      const qualRatio =
                        item.totalUnits > 0
                          ? Math.round(
                              (item.qualityUnits / item.totalUnits) * 100
                            )
                          : 0;
                      const active = selectedDateFilter === item.date;
                      return (
                        <button
                          key={item.date}
                          type="button"
                          onClick={() =>
                            setSelectedDateFilter(active ? 'ALL' : item.date)
                          }
                          className="flex-1 flex flex-col items-center h-full justify-end group"
                          title={`Fecha ${item.date}: ${item.totalUnits} unds (${item.qualityUnits}u Calidad / ${item.commercialUnits}u Comercial)`}
                        >
                          <span className="font-mono text-[10px] font-bold text-slate-300 mb-1 group-hover:text-indigo-300">
                            {item.totalUnits}u
                          </span>
                          <div
                            className={`w-full max-w-[34px] rounded-t-xl overflow-hidden flex flex-col justify-end transition-all ${
                              active
                                ? 'ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/30'
                                : 'opacity-90 group-hover:opacity-100'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          >
                            <div
                              className="w-full bg-amber-500"
                              style={{ height: `${100 - qualRatio}%` }}
                            />
                            <div
                              className="w-full bg-sky-500"
                              style={{ height: `${qualRatio}%` }}
                            />
                          </div>
                          <span
                            className={`mt-1.5 font-mono text-[9px] font-bold truncate max-w-full ${
                              active ? 'text-indigo-300' : 'text-slate-400'
                            }`}
                          >
                            {item.date.slice(5)}
                          </span>
                        </button>
                      );
                    });
                  })()
                ) : (
                  <div className="w-full text-center text-xs text-slate-400 self-center">
                    Sin fechas para mostrar
                  </div>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-500 inline-block" />
                  Defectos Planta (Calidad)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" />
                  Rotación Comercial
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar & Quick Cause Pills */}
      <div className="rounded-3xl border border-white/15 bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Cause Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCauseFilter('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                causeFilter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                  : 'bg-slate-900 text-slate-300 border border-white/10 hover:bg-slate-800'
              }`}
            >
              Todas las Causas
            </button>
            <button
              type="button"
              onClick={() => setCauseFilter('CALIDAD')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                causeFilter === 'CALIDAD'
                  ? 'bg-sky-500 text-slate-950 shadow-sm font-bold'
                  : 'bg-slate-900 text-sky-300 border border-sky-500/30 hover:bg-slate-800'
              }`}
            >
              🔬 Solo Defectos Planta (Calidad)
            </button>
            <button
              type="button"
              onClick={() => setCauseFilter('lechozo')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                causeFilter === 'lechozo'
                  ? 'bg-violet-500 text-white shadow-sm font-bold'
                  : 'bg-slate-900 text-violet-300 border border-violet-500/30 hover:bg-slate-800'
              }`}
            >
              🟣 Solo Lechosidad ({globalMetrics.lechozoUnits})
            </button>
            <button
              type="button"
              onClick={() => setCauseFilter('vacio')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                causeFilter === 'vacio'
                  ? 'bg-sky-600 text-white shadow-sm font-bold'
                  : 'bg-slate-900 text-sky-300 border border-sky-500/30 hover:bg-slate-800'
              }`}
            >
              🔵 Solo Pérdida de Vacío ({globalMetrics.vacioUnits})
            </button>
            <button
              type="button"
              onClick={() => setCauseFilter('proxVencer')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                causeFilter === 'proxVencer'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-slate-800'
              }`}
            >
              🟠 Próx. a Vencer ({globalMetrics.proxVencerUnits})
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-xl border border-white/15 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setViewMode('MATRIX')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'MATRIX'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Matriz Consolidada por Producto ({productMatrix.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DETAIL')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'DETAIL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Trazabilidad Detallada ({filteredRows.length} filas)
            </button>
          </div>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Filtrar por Producto
            </label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">
                Todos los Productos ({uniqueProducts.length})
              </option>
              {uniqueProducts.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Filtrar por N° de Lote
            </label>
            <select
              value={selectedLotFilter}
              onChange={(e) => setSelectedLotFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-300 font-semibold focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">Todos los Lotes ({uniqueLots.length})</option>
              {uniqueLots.map((lot) => (
                <option key={lot} value={lot}>
                  Lote #{lot}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Filtrar por Fecha
            </label>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-indigo-400 focus:outline-none"
            >
              <option value="ALL">Todas las Fechas ({uniqueDates.length})</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Búsqueda por Producto, Lote o Cliente
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. Chorizo Carla, 281, 290..."
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
              {(selectedProductFilter !== 'ALL' ||
                selectedDateFilter !== 'ALL' ||
                selectedLotFilter !== 'ALL' ||
                causeFilter !== 'ALL' ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductFilter('ALL');
                    setSelectedDateFilter('ALL');
                    setSelectedLotFilter('ALL');
                    setCauseFilter('ALL');
                    setSearchQuery('');
                  }}
                  title="Limpiar filtros"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-2.5 text-rose-300 hover:bg-rose-500/25"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Consolidated Product Matrix OR Detailed Rows */}
      {filteredRows.length === 0 ? (
        <div className="rounded-3xl border border-white/15 bg-slate-950/80 p-8 backdrop-blur-2xl">
          <EmptyState
            icon={FlaskConical}
            title="No se encontraron devoluciones para este filtro"
            description="Limpia los filtros activos para visualizar todos los productos y lotes."
            actionLabel="Restablecer Filtros"
            onAction={() => {
              setSelectedProductFilter('ALL');
              setSelectedDateFilter('ALL');
              setSelectedLotFilter('ALL');
              setCauseFilter('ALL');
              setSearchQuery('');
            }}
          />
        </div>
      ) : viewMode === 'MATRIX' ? (
        <div className="rounded-3xl border border-white/20 bg-slate-950/90 backdrop-blur-2xl overflow-hidden shadow-2xl">
          <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Matriz Consolidada Producto vs. Causa de Devolución y Lotes
              </h3>
              <p className="text-xs text-slate-400">
                Haz clic en cualquier fila para ver el detalle de clientes y rutas que devolvieron ese producto.
              </p>
            </div>
            <Badge variant="indigo">
              {productMatrix.length} productos analizados
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-3 text-right">Total Dev.</th>
                  <th className="py-3 px-3">Causa Principal & %</th>
                  <th className="py-3 px-2.5 text-center text-violet-300">
                    Lechoso
                  </th>
                  <th className="py-3 px-2.5 text-center text-sky-300">
                    Vacío
                  </th>
                  <th className="py-3 px-2.5 text-center text-cyan-300">
                    Fecha / Abom
                  </th>
                  <th className="py-3 px-2.5 text-center text-amber-300">
                    Próx. Vencer
                  </th>
                  <th className="py-3 px-2.5 text-center text-rose-300">
                    Cobrar / Venc
                  </th>
                  <th className="py-3 px-3">Lotes Afectados (Clic para filtrar)</th>
                  <th className="py-3 px-4 text-right">Costo Calidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {productMatrix.map((prod) => {
                  const dominantMeta =
                    CAUSE_METADATA.find(
                      (c) => c.key === prod.dominantCauseKey
                    ) || CAUSE_METADATA[3];
                  const pctDominant =
                    prod.totalUnits > 0
                      ? Math.round(
                          (prod.dominantCauseUnits / prod.totalUnits) * 100
                        )
                      : 0;

                  const topLots = Array.from(prod.lotsMap.values())
                    .sort((a, b) => b.totalUnits - a.totalUnits)
                    .slice(0, 5);

                  return (
                    <tr
                      key={prod.productName}
                      onClick={() => {
                        setSelectedProductFilter(prod.productName);
                        setViewMode('DETAIL');
                      }}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{prod.productName}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        {formatNumber(prod.totalUnits)} und
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold ${dominantMeta.badgeClass}`}
                          >
                            {dominantMeta.shortLabel} ({pctDominant}%)
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-2.5 text-center font-mono">
                        {prod.causes.lechozo > 0 ? (
                          <span className="inline-block rounded-md bg-violet-500/20 border border-violet-500/40 px-2 py-0.5 font-bold text-violet-300">
                            {prod.causes.lechozo}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center font-mono">
                        {prod.causes.vacio > 0 ? (
                          <span className="inline-block rounded-md bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 font-bold text-sky-300">
                            {prod.causes.vacio}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center font-mono">
                        {prod.causes.xFecha + prod.causes.abomba > 0 ? (
                          <span className="inline-block rounded-md bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 font-bold text-cyan-300">
                            {prod.causes.xFecha + prod.causes.abomba}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center font-mono">
                        {prod.causes.proxVencer > 0 ? (
                          <span className="inline-block rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-semibold text-amber-300">
                            {prod.causes.proxVencer}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center font-mono">
                        {prod.causes.aCobrar + prod.causes.vencido > 0 ? (
                          <span className="inline-block rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-semibold text-rose-300">
                            {prod.causes.aCobrar + prod.causes.vencido}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td
                        className="py-3 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1">
                          {topLots.length > 0 ? (
                            topLots.map((l) => (
                              <button
                                key={l.lot}
                                type="button"
                                onClick={() => {
                                  setSelectedLotFilter(
                                    selectedLotFilter === l.lot ? 'ALL' : l.lot
                                  );
                                }}
                                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold border transition-all ${
                                  selectedLotFilter === l.lot
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold'
                                    : 'bg-slate-900 text-emerald-300 border-white/10 hover:border-emerald-400/50'
                                }`}
                              >
                                L-{l.lot} ({l.totalUnits}u)
                              </button>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              S/L
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-sky-300">
                          {formatCOP(prod.qualityCOP)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total: {formatCOP(prod.totalCOP)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed Row-by-Row Traceability Table */
        <div className="rounded-3xl border border-white/20 bg-slate-950/90 backdrop-blur-2xl overflow-hidden shadow-2xl">
          <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className="rounded-xl border border-white/15 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-300"
              >
                ← Volver a Matriz Consolidada
              </button>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Trazabilidad Detallada por Lote, Vendedor y Cliente
                </h3>
                <p className="text-xs text-slate-400">
                  Mostrando {filteredRows.length} registros individuales de devolución
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Zona / Vendedor</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-2.5 text-center">Lote</th>
                  <th className="py-3 px-2.5 text-center">Vencimiento</th>
                  <th className="py-3 px-2.5 text-center">Cant.</th>
                  <th className="py-3 px-3">Causa Registrada</th>
                  <th className="py-3 px-3">Diagnóstico / Observación</th>
                  <th className="py-3 px-3 text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredRows.map((row) => {
                  const causeMeta =
                    CAUSE_METADATA.find(
                      (c) => c.key === row.primaryCauseKey
                    ) || CAUSE_METADATA[3];

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-300">
                        {row.zoneName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        {row.clientName}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {row.productName}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono">
                        <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-bold text-emerald-300">
                          L-{row.lotNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono text-slate-400 whitespace-nowrap">
                        {row.productExpiryDate}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono font-bold text-white">
                        {row.qtyToReceive}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold ${causeMeta.badgeClass}`}
                        >
                          {causeMeta.shortLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">
                        {row.observations || causeMeta.technicalExplanation}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                        {formatCOP(row.totalValueCOP)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
