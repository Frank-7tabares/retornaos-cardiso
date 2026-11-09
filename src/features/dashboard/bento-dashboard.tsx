import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown,
  ShieldAlert,
  Briefcase,
  FlaskConical,
  ArrowUpRight,
  DollarSign,
  Hash,
  Search,
  Sparkles,
  FileSpreadsheet,
  SlidersHorizontal,
  Pencil,
  HelpCircle,
  ClipboardList,
  Calculator,
  BarChart3,
  ChevronRight,
  Plus,
  Camera,
  Tag,
  Stethoscope,
  Calendar,
  ArrowUpDown,
  Award,
  Printer,
  PackageCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { BentoCard } from '../../components/ui/bento-card';
import { Badge } from '../../components/ui/badge';
import { TooltipHint, Modal } from '../../components/ui/modal';
import { EmptyState } from '../../components/ui/empty-state';
import { CAUSE_METADATA, computeZoneMetrics } from '../../lib/real-excel-data';
import {
  formatCOP,
  formatCompactCOP,
  formatNumber,
  formatPercent,
} from '../../lib/utils';
import {
  ComputedReturnRow,
  ReturnCauseKey,
  ZoneSummary,
  ZoneType,
} from '../../types/returns';

interface BentoDashboardProps {
  zones: ZoneSummary[];
  returnRows: ComputedReturnRow[];
  onSelectZone: (zoneId: string) => void;
  onSelectLot: (lotNumber: string) => void;
  onUpdateZoneSales: (zoneId: string, newSalesCOP: number) => void;
  onOpenQuickGuide: () => void;
  onOpenExecutiveReport?: () => void;
}

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  zones,
  returnRows,
  onSelectZone,
  onSelectLot,
  onUpdateZoneSales,
  onOpenQuickGuide,
  onOpenExecutiveReport,
}) => {
  const [channelFilter, setChannelFilter] = useState<'ALL' | ZoneType>('ALL');
  const [metricMode, setMetricMode] = useState<'COP' | 'UNITS'>('COP');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [escalafonOrder, setEscalafonOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [escalafonCategory, setEscalafonCategory] = useState<
    'ALL' | 'COMERCIAL' | 'CALIDAD'
  >('ALL');
  const [showWorkflowBanner, setShowWorkflowBanner] = useState(true);
  const [selectedCauseKey, setSelectedCauseKey] =
    useState<ReturnCauseKey>('lechozo');
  const [editingSalesZone, setEditingSalesZone] = useState<ZoneSummary | null>(
    null
  );
  const [salesInput, setSalesInput] = useState('');

  // Fechas disponibles y fecha máxima de corte ("hasta el día que están los cambios")
  const { availableDates, minDate, maxDate } = useMemo(() => {
    const set = new Set<string>();
    for (const r of returnRows) {
      if (r.date) set.add(r.date);
    }
    const sorted = Array.from(set).sort();
    return {
      availableDates: [...sorted].reverse(),
      minDate: sorted[0] || '2026-11-01',
      maxDate: sorted[sorted.length - 1] || '2026-11-05',
    };
  }, [returnRows]);

  // Filas filtradas por fecha seleccionada en la pantalla de inicio
  const dateFilteredRows = useMemo(() => {
    if (dateFilter === 'ALL') return returnRows;
    return returnRows.filter((r) => r.date === dateFilter);
  }, [returnRows, dateFilter]);

  const enrichedZones = useMemo(() => {
    const activeZones = zones.filter((z) => z.id !== 'Z15');
    return activeZones.map((z) => {
      if (dateFilter === 'ALL') {
        return computeZoneMetrics(z);
      }
      const zRows = dateFilteredRows.filter((r) => r.zoneId === z.id);
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
  }, [zones, dateFilteredRows, dateFilter]);

  const filteredZones = useMemo(() => {
    return enrichedZones.filter((z) => {
      if (channelFilter !== 'ALL' && z.type !== channelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          z.code.toLowerCase().includes(q) ||
          z.consolidatedName.toLowerCase().includes(q) ||
          z.sheetName.toLowerCase().includes(q) ||
          z.currentSeller.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enrichedZones, channelFilter, searchQuery]);

  const totals = useMemo(() => {
    const acc = {
      salesCOP: 0,
      totalCOP: 0,
      totalUnits: 0,
      commercialCOP: 0,
      commercialUnits: 0,
      qualityCOP: 0,
      qualityUnits: 0,
      lineItems: 0,
      causesCOP: {
        aCobrar: 0,
        xFecha: 0,
        vacio: 0,
        proxVencer: 0,
        vencido: 0,
        abomba: 0,
        lechozo: 0,
      } as Record<ReturnCauseKey, number>,
      causesUnits: {
        aCobrar: 0,
        xFecha: 0,
        vacio: 0,
        proxVencer: 0,
        vencido: 0,
        abomba: 0,
        lechozo: 0,
      } as Record<ReturnCauseKey, number>,
    };

    for (const z of filteredZones) {
      acc.salesCOP += z.monthlySalesCOP;
      acc.totalCOP += z.totalCOP;
      acc.totalUnits += z.totalUnits;
      acc.commercialCOP += z.commercialCOP;
      acc.commercialUnits += z.commercialUnits;
      acc.qualityCOP += z.qualityCOP;
      acc.qualityUnits += z.qualityUnits;
      acc.lineItems += z.lineItemsCount;

      (Object.keys(acc.causesCOP) as ReturnCauseKey[]).forEach((k) => {
        acc.causesCOP[k] += z.copByCause[k];
        acc.causesUnits[k] += z.unitsByCause[k];
      });
    }

    const pctTotalOverSales =
      acc.salesCOP > 0 ? (acc.totalCOP / acc.salesCOP) * 100 : 0;
    const pctCommShare =
      acc.totalCOP > 0 ? (acc.commercialCOP / acc.totalCOP) * 100 : 0;
    const pctQualShare =
      acc.totalCOP > 0 ? (acc.qualityCOP / acc.totalCOP) * 100 : 0;

    return {
      ...acc,
      pctTotalOverSales,
      pctCommShare,
      pctQualShare,
    };
  }, [filteredZones]);

  const unconciledCount = useMemo(
    () =>
      dateFilteredRows.filter((r) => r.reconciliationStatus === 'REVISAR')
        .length,
    [dateFilteredRows]
  );

  // Escalafón de productos devueltos (de menor a mayor o de mayor a menor) por Calidad y Comercial
  const productEscalafonData = useMemo(() => {
    const map = new Map<
      string,
      {
        productName: string;
        totalUnits: number;
        totalCOP: number;
        commercialUnits: number;
        commercialCOP: number;
        qualityUnits: number;
        qualityCOP: number;
        lechozoUnits: number;
        vacioUnits: number;
        proxVencerUnits: number;
        lots: Set<string>;
        zones: Set<string>;
      }
    >();

    for (const r of dateFilteredRows) {
      const key = r.productName;
      let item = map.get(key);
      if (!item) {
        item = {
          productName: r.productName,
          totalUnits: 0,
          totalCOP: 0,
          commercialUnits: 0,
          commercialCOP: 0,
          qualityUnits: 0,
          qualityCOP: 0,
          lechozoUnits: 0,
          vacioUnits: 0,
          proxVencerUnits: 0,
          lots: new Set<string>(),
          zones: new Set<string>(),
        };
        map.set(key, item);
      }
      const cUnits =
        r.causes.aCobrar + r.causes.proxVencer + r.causes.vencido;
      const qUnits =
        r.causes.vacio + r.causes.xFecha + r.causes.abomba + r.causes.lechozo;

      item.totalUnits += r.qtyToReceive;
      item.totalCOP += r.totalValueCOP;
      item.commercialUnits += cUnits;
      item.commercialCOP += r.commercialValueCOP;
      item.qualityUnits += qUnits;
      item.qualityCOP += r.qualityValueCOP;
      item.lechozoUnits += r.causes.lechozo;
      item.vacioUnits += r.causes.vacio;
      item.proxVencerUnits += r.causes.proxVencer + r.causes.vencido;
      if (r.lotNumber && r.lotNumber !== 'S/L') item.lots.add(r.lotNumber);
      item.zones.add(r.zoneId);
    }

    let list = Array.from(map.values());
    if (escalafonCategory === 'COMERCIAL') {
      list = list.filter((p) => p.commercialUnits > 0);
    } else if (escalafonCategory === 'CALIDAD') {
      list = list.filter((p) => p.qualityUnits > 0);
    }

    const sorted = [...list].sort((a, b) => {
      const valA =
        escalafonCategory === 'COMERCIAL'
          ? a.commercialUnits
          : escalafonCategory === 'CALIDAD'
          ? a.qualityUnits
          : a.totalUnits;
      const valB =
        escalafonCategory === 'COMERCIAL'
          ? b.commercialUnits
          : escalafonCategory === 'CALIDAD'
          ? b.qualityUnits
          : b.totalUnits;
      if (escalafonOrder === 'ASC') {
        return valA - valB || a.totalCOP - b.totalCOP;
      }
      return valB - valA || b.totalCOP - a.totalCOP;
    });

    const allList = Array.from(map.values());
    const topLechozo =
      [...allList]
        .filter((p) => p.lechozoUnits > 0)
        .sort((a, b) => b.lechozoUnits - a.lechozoUnits)[0] || null;
    const topVacio =
      [...allList]
        .filter((p) => p.vacioUnits > 0)
        .sort((a, b) => b.vacioUnits - a.vacioUnits)[0] || null;
    const topCommercial =
      [...allList]
        .filter((p) => p.commercialUnits > 0)
        .sort((a, b) => b.commercialUnits - a.commercialUnits)[0] || null;

    return {
      sorted,
      topLechozo,
      topVacio,
      topCommercial,
    };
  }, [dateFilteredRows, escalafonOrder, escalafonCategory]);

  // Zona que MÁS vende y zona que MENOS vende
  const zoneSalesRanking = useMemo(() => {
    const rutas = enrichedZones.filter(
      (z) => z.type === 'RUTA_VENDEDOR' && z.monthlySalesCOP > 0
    );
    const bySales = [...rutas].sort(
      (a, b) => b.monthlySalesCOP - a.monthlySalesCOP
    );
    return {
      topZone: bySales[0] || null,
      bottomZone: bySales[bySales.length - 1] || null,
    };
  }, [enrichedZones]);

  const topLots = useMemo(() => {
    const map = new Map<
      string,
      {
        lot: string;
        units: number;
        valueCOP: number;
        mainCause: string;
        samplePhoto?: string;
        zonesInvolved: Set<string>;
      }
    >();
    for (const r of dateFilteredRows) {
      if (!r.lotNumber || r.movementType !== 'AVERIA_DEVOLUCION') continue;
      const prev = map.get(r.lotNumber) || {
        lot: r.lotNumber,
        units: 0,
        valueCOP: 0,
        mainCause: 'Próx. Vencer / Lechoso',
        samplePhoto: r.evidencePhotoUrl,
        zonesInvolved: new Set<string>(),
      };
      prev.units += r.qtyToReceive;
      prev.valueCOP += r.totalValueCOP;
      prev.zonesInvolved.add(r.zoneId);
      if (!prev.samplePhoto && r.evidencePhotoUrl) {
        prev.samplePhoto = r.evidencePhotoUrl;
      }
      if (r.causes.lechozo > 0) prev.mainCause = 'Lechoso (Calidad)';
      else if (r.causes.vacio > 0) prev.mainCause = 'Vacío (Calidad)';
      else if (r.causes.xFecha > 0) prev.mainCause = 'Por Fecha (Calidad)';
      map.set(r.lotNumber, prev);
    }
    return Array.from(map.values())
      .sort((a, b) => b.valueCOP - a.valueCOP)
      .slice(0, 6);
  }, [dateFilteredRows]);

  const selectedCauseMeta = useMemo(
    () =>
      CAUSE_METADATA.find((c) => c.key === selectedCauseKey) ||
      CAUSE_METADATA[6],
    [selectedCauseKey]
  );

  const openEditSales = (zone: ZoneSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSalesZone(zone);
    setSalesInput(String(zone.monthlySalesCOP));
  };

  const handleSaveSales = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalesZone) return;
    const numeric = Number(salesInput.replace(/[^0-9]/g, ''));
    if (Number.isNaN(numeric) || numeric < 0) {
      toast.error('Monto inválido');
      return;
    }
    onUpdateZoneSales(editingSalesZone.id, numeric);
    toast.success(`Ventas Mes actualizadas para ${editingSalesZone.code}`, {
      description: `Nuevo presupuesto base: ${formatCOP(numeric)}. Indicadores % COME y % CALIDAD recalculados.`,
    });
    setEditingSalesZone(null);
  };

  return (
    <div className="space-y-6">
      {/* Visual Hero Banner with Nature / Farm / Countryside Atmosphere & Glass Overlay */}
      <div className="relative overflow-hidden rounded-3xl border border-white/25 dark:border-white/15 shadow-2xl">
        <img
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80"
          alt="Campo y Granja Agroalimentaria"
          className="absolute inset-0 h-full w-full object-cover object-center scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-emerald-950/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" dot>
                📅 Cambios actualizados hasta el día: {maxDate}
              </Badge>
              <span className="rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 px-3 py-0.5 text-xs font-semibold text-emerald-200">
                Periodo cargado: {minDate} al {maxDate} · 14 Vendedores Oficiales
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Centro de Control Gerencial, Escalafón de Inventarios y Lotes
            </h1>
            <p className="text-xs sm:text-sm text-slate-200/95 leading-relaxed">
              Información actualizada hasta el <strong>{maxDate}</strong>. Filtra por <strong>Fecha</strong> o por <strong>N° de Lote</strong>, consulta el <strong>Escalafón de Menor a Mayor</strong> de productos devueltos por <strong>Calidad y Comercial</strong> para bajar inventarios, y genera el <strong>Informe Ejecutivo Oficial</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenExecutiveReport && (
              <button
                type="button"
                onClick={onOpenExecutiveReport}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-300/40 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-600/30 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Printer className="h-4 w-4" />
                Generar Informe Detallado (Sebastián)
              </button>
            )}
            <button
              type="button"
              onClick={onOpenQuickGuide}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 hover:bg-white/25 backdrop-blur-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5"
            >
              <HelpCircle className="h-4 w-4 text-emerald-300" />
              Guía Fácil
            </button>
            <button
              type="button"
              onClick={() => onSelectZone('Z01')}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5"
            >
              <Camera className="h-4 w-4" />
              Ir a Planilla / Lotes
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Corte de Fecha y Filtro por Fecha en la Pantalla de Inicio */}
      <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 backdrop-blur-xl p-3.5 sm:px-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-white">
                Fecha de Corte en Sistema (Hasta el día que están los cambios):
              </span>
              <span className="rounded-lg bg-emerald-500/25 border border-emerald-400/40 px-2.5 py-0.5 font-mono text-xs font-extrabold text-emerald-300">
                {maxDate}
              </span>
              {dateFilter !== 'ALL' && (
                <Badge variant="warning" dot>
                  Filtrando solo fecha: {dateFilter}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-300">
              Filtra todo el resumen de inicio por una fecha específica o visualiza el acumulado completo ({availableDates.length} fechas registradas).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDateFilter('ALL')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              dateFilter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800/90 text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            Todas las Fechas ({minDate} a {maxDate})
          </button>
          {availableDates.slice(0, 6).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDateFilter(dateFilter === d ? 'ALL' : d)}
              className={`rounded-xl px-2.5 py-1.5 font-mono text-xs font-semibold transition-all ${
                dateFilter === d
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/80 text-emerald-300 hover:bg-slate-700 border border-emerald-500/25'
              }`}
            >
              📅 {d}
            </button>
          ))}
          {availableDates.length > 6 && (
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-white/20 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">Ver todas ({availableDates.length})</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  Fecha: {d}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Interactive 3-Step Visual Explainer Strip */}
      <AnimatePresence>
        {showWorkflowBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <div
              onClick={() => onSelectZone('Z01')}
              className="group cursor-pointer rounded-2xl border border-white/20 bg-slate-900/65 hover:bg-slate-900/80 backdrop-blur-2xl p-4 transition-all hover:border-emerald-400/50"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <Camera className="h-3.5 w-3.5" />
                  Paso 1: Registro con Foto y Lote
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-emerald-300 transition-transform" />
              </div>
              <p className="mt-2 text-xs text-slate-200 leading-relaxed">
                Cada <strong>Vendedor (Z01–Z15)</strong> o <strong>Punto de Venta</strong> registra el producto devuelto, su <strong>N° de Lote</strong>, temperatura y sube la <strong>foto de evidencia</strong>.
              </p>
            </div>

            <div
              onClick={() => onSelectLot('259')}
              className="group cursor-pointer rounded-2xl border border-white/20 bg-slate-900/65 hover:bg-slate-900/80 backdrop-blur-2xl p-4 transition-all hover:border-indigo-400/50"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                  <Tag className="h-3.5 w-3.5" />
                  Paso 2: Filtro por Lotes y Diagnóstico
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-indigo-300 transition-transform" />
              </div>
              <p className="mt-2 text-xs text-slate-200 leading-relaxed">
                Haz clic aquí o en cualquier <strong>Lote (ej. L-259)</strong> para rastrear en qué rutas salió defectuoso y ver por qué ocurrió la causa (Lechoso, Vacío, etc.).
              </p>
            </div>

            <div className="relative rounded-2xl border border-white/20 bg-slate-900/65 backdrop-blur-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Paso 3: Liquidación (% DE VENTAS)
                </span>
                <button
                  type="button"
                  onClick={() => setShowWorkflowBanner(false)}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Ocultar ayuda
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-200 leading-relaxed">
                El sistema multiplica todo por el catálogo 2024 sin errores <code className="text-amber-200">#REF!</code> y separa el costo entre <strong>Comercial</strong> y <strong>Calidad/Planta</strong>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Resumen Financiero y Operativo por Canal
          </h2>
          <p className="text-xs text-neutral-600 dark:text-slate-300">
            Filtra entre las rutas de vendedores, clientes especiales Z14 o sedes de puntos de venta.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-white/30 dark:border-white/15 bg-white/75 dark:bg-slate-900/70 p-1 backdrop-blur-xl shadow-lg">
          {[
            { id: 'ALL', label: 'Todos los Canales (23)' },
            { id: 'RUTA_VENDEDOR', label: 'Vendedores Z01–Z16 (14)' },
            { id: 'CLIENTE_ESPECIAL_Z14', label: 'Clientes Z14 (4)' },
            { id: 'PUNTO_DE_VENTA', label: 'Puntos de Venta (5)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setChannelFilter(tab.id as 'ALL' | ZoneType)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                channelFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: 4 Primary KPI Bento Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BentoCard interactive className="group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                Costo Total Devoluciones
              </span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white font-mono">
                {formatCOP(totals.totalCOP)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-500 dark:text-indigo-300">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300">
              Sobre Ventas ({formatCompactCOP(totals.salesCOP)})
            </span>
            <Badge
              variant={totals.pctTotalOverSales > 6 ? 'warning' : 'indigo'}
              dot
            >
              {formatPercent(totals.pctTotalOverSales)} del mes
            </Badge>
          </div>
        </BentoCard>

        <BentoCard interactive>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                  Responsabilidad Comercial
                </span>
                <TooltipHint label="Suma: Por Cobrar + Próximo a Vencer + Vencido">
                  <Badge variant="commercial">Comercial</Badge>
                </TooltipHint>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-300 font-mono">
                {formatCOP(totals.commercialCOP)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500 dark:text-amber-300">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300">
              {formatNumber(totals.commercialUnits)} unds (PR/V, Cobrar, Venc.)
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-300">
              {formatPercent(totals.pctCommShare, 1)} del total
            </span>
          </div>
        </BentoCard>

        <BentoCard interactive>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                  Responsabilidad Calidad
                </span>
                <TooltipHint label="Suma: Vacío + Por Fecha + Abombamiento + Lechoso">
                  <Badge variant="quality">Planta / Calidad</Badge>
                </TooltipHint>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-300 font-mono">
                {formatCOP(totals.qualityCOP)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-500 dark:text-sky-300">
              <FlaskConical className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300">
              {formatNumber(totals.qualityUnits)} unds (Lechoso, Vacío, Fecha)
            </span>
            <span className="font-semibold text-sky-600 dark:text-sky-300">
              {formatPercent(totals.pctQualShare, 1)} del total
            </span>
          </div>
        </BentoCard>

        <BentoCard
          interactive
          onClick={() => onSelectZone('PDV-SABANETA')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                Unidades & Auditoría Cuadre
              </span>
              <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white font-mono">
                {formatNumber(totals.totalUnits)}{' '}
                <span className="text-sm font-normal text-neutral-500 dark:text-slate-400">
                  unds
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300">
              {formatNumber(totals.lineItems)} registros procesados
            </span>
            {unconciledCount > 0 ? (
              <Badge variant="warning" dot>
                {unconciledCount} por REVISAR
              </Badge>
            ) : (
              <Badge variant="success" dot>
                100% Cuadrado
              </Badge>
            )}
          </div>
        </BentoCard>
      </div>

      {/* ===================================================================== */}
      {/* RESUMEN GERENCIAL Y ESCALAFÓN DE PRODUCTOS (DE MENOR A MAYOR ↑)       */}
      {/* ===================================================================== */}
      <BentoCard noPadding className="overflow-hidden">
        <div className="border-b border-neutral-200/70 dark:border-white/10 bg-slate-950/50 p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <PackageCheck className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                  Escalafón de Productos Devueltos por Calidad y Comercial ({escalafonOrder === 'ASC' ? 'De Menor a Mayor ↑' : 'De Mayor a Menor ↓'})
                </h2>
                <Badge variant="success" dot>
                  Corte al {dateFilter === 'ALL' ? maxDate : dateFilter}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-600 dark:text-slate-300">
                Resumen ordenado de productos devueltos por <strong>Calidad (Lechosidad, Vacío)</strong> y <strong>Comercial (Próx. a Vencer, A Cobrar)</strong> para <strong>bajar inventarios en ruta</strong> y <strong>tomar correctivos en planta</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="inline-flex rounded-xl border border-white/15 bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setEscalafonOrder('ASC')}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    escalafonOrder === 'ASC'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  De Menor a Mayor (↑)
                </button>
                <button
                  type="button"
                  onClick={() => setEscalafonOrder('DESC')}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    escalafonOrder === 'DESC'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  De Mayor a Menor (↓)
                </button>
              </div>

              <div className="inline-flex rounded-xl border border-white/15 bg-slate-900 p-1">
                {[
                  { id: 'ALL', label: 'Todos' },
                  { id: 'COMERCIAL', label: 'Comercial (Inventario)' },
                  { id: 'CALIDAD', label: 'Calidad (Planta)' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setEscalafonCategory(
                        cat.id as 'ALL' | 'COMERCIAL' | 'CALIDAD'
                      )
                    }
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      escalafonCategory === cat.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {onOpenExecutiveReport && (
                <button
                  type="button"
                  onClick={onOpenExecutiveReport}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Abrir Informe Detallado con Logo
                </button>
              )}
            </div>
          </div>

          {/* 3 Tarjetas de Resumen Rápido: Ventas por Zona, Críticos Lechosidad/Vacío y Comercial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" />
                  ¿Qué Zona Vende Más y Cuál Menos?
                </span>
                <span>Ventas Mes</span>
              </div>
              {zoneSalesRanking.topZone && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-200 truncate">
                    🏆 <strong>Más vende:</strong> {zoneSalesRanking.topZone.consolidatedName}
                  </span>
                  <span className="font-mono font-bold text-emerald-300 shrink-0 ml-2">
                    {formatCompactCOP(zoneSalesRanking.topZone.monthlySalesCOP)}
                  </span>
                </div>
              )}
              {zoneSalesRanking.bottomZone && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 truncate">
                    📉 <strong>Menos vende:</strong> {zoneSalesRanking.bottomZone.consolidatedName}
                  </span>
                  <span className="font-mono font-bold text-amber-300 shrink-0 ml-2">
                    {formatCompactCOP(zoneSalesRanking.bottomZone.monthlySalesCOP)}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-sky-500/30 bg-slate-900/90 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-sky-400">
                <span className="flex items-center gap-1">
                  <FlaskConical className="h-3.5 w-3.5" />
                  ¿Cuál Devuelven Más por Lechosidad y Vacío?
                </span>
                <span>Planta</span>
              </div>
              {productEscalafonData.topLechozo && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-200 truncate">
                    🥛 <strong>Lechosidad:</strong> {productEscalafonData.topLechozo.productName}
                  </span>
                  <span className="font-mono font-bold text-violet-300 shrink-0 ml-2">
                    {productEscalafonData.topLechozo.lechozoUnits} unds
                  </span>
                </div>
              )}
              {productEscalafonData.topVacio && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200 truncate">
                    📦 <strong>Vacío:</strong> {productEscalafonData.topVacio.productName}
                  </span>
                  <span className="font-mono font-bold text-sky-300 shrink-0 ml-2">
                    {productEscalafonData.topVacio.vacioUnits} unds
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-400">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Control de Inventarios (Comercial)
                </span>
                <span>Rotación</span>
              </div>
              {productEscalafonData.topCommercial && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-200 truncate">
                    ⚠️ <strong>Bajar stock:</strong> {productEscalafonData.topCommercial.productName}
                  </span>
                  <span className="font-mono font-bold text-amber-300 shrink-0 ml-2">
                    {productEscalafonData.topCommercial.commercialUnits} unds
                  </span>
                </div>
              )}
              <div className="text-[11px] text-slate-400">
                Usa la tabla inferior en escalafón para ajustar pedidos por ruta y lote.
              </div>
            </div>
          </div>
        </div>

        {/* Tabla del Escalafón de Productos (De Menor a Mayor / Mayor a Menor) */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/70 dark:border-white/10 bg-neutral-100/70 dark:bg-slate-950/70 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-slate-300">
                <th className="py-3 pl-5 pr-2">Escalafón</th>
                <th className="px-3 py-3">Producto / Referencia</th>
                <th className="px-3 py-3 text-right text-amber-600 dark:text-amber-300">
                  Comercial (Und / $)
                </th>
                <th className="px-3 py-3 text-right text-sky-600 dark:text-sky-300">
                  Calidad Planta (Und / $)
                </th>
                <th className="px-2.5 py-3 text-center text-violet-400">
                  Lechosidad
                </th>
                <th className="px-2.5 py-3 text-center text-cyan-400">
                  Vacío
                </th>
                <th className="px-3 py-3 text-right">Total Devuelto</th>
                <th className="py-3 pl-3 pr-5">Acción p/ Bajar Inventario y Correctivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-white/[0.07] text-xs">
              {productEscalafonData.sorted.map((prod, idx) => {
                const actionLabel =
                  prod.commercialUnits > prod.qualityUnits
                    ? '📉 Bajar inventario en ruta / Ajustar pedido comercial'
                    : prod.lechozoUnits >= prod.vacioUnits && prod.lechozoUnits > 0
                    ? '🔬 Correctivo Planta: Revisar choque térmico (Lechosidad)'
                    : prod.vacioUnits > 0
                    ? '🛡️ Correctivo Planta: Auditar sellado al vacío'
                    : '✅ Rotación estable (Mantener stock)';

                return (
                  <tr
                    key={prod.productName}
                    className="hover:bg-indigo-500/10 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <td className="py-2.5 pl-5 pr-2 font-mono font-bold text-indigo-400">
                      #{idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {prod.productName}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-500 dark:text-slate-400">
                        {prod.zones.size} zona(s) · Lotes:{' '}
                        {Array.from(prod.lots).slice(0, 4).join(', ') || 'S/L'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className="font-bold text-amber-600 dark:text-amber-300">
                        {formatNumber(prod.commercialUnits)} und
                      </span>
                      <div className="text-[10px] text-neutral-500 dark:text-slate-400">
                        {formatCOP(prod.commercialCOP)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className="font-bold text-sky-600 dark:text-sky-300">
                        {formatNumber(prod.qualityUnits)} und
                      </span>
                      <div className="text-[10px] text-neutral-500 dark:text-slate-400">
                        {formatCOP(prod.qualityCOP)}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 text-center font-mono font-semibold text-violet-300">
                      {prod.lechozoUnits > 0 ? `${prod.lechozoUnits} u` : '—'}
                    </td>
                    <td className="px-2.5 py-2.5 text-center font-mono font-semibold text-cyan-300">
                      {prod.vacioUnits > 0 ? `${prod.vacioUnits} u` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {formatNumber(prod.totalUnits)} unds
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        {formatCOP(prod.totalCOP)}
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-[11px] text-neutral-700 dark:text-slate-200">
                      {actionLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BentoCard>

      {/* Row 2: Main Bento Grid (8 Cols Consolidated Matrix + 4 Cols Cause & Lot Intelligence) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 8 Cols: Matriz Consolidada % DE VENTAS */}
        <BentoCard noPadding className="lg:col-span-8 flex flex-col">
          <div className="flex flex-col gap-3 border-b border-neutral-200/70 dark:border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Matriz Consolidada por Zona, Cliente Z14 y Punto de Venta
                </h2>
                <Badge variant="success">Sin #REF!</Badge>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-slate-300">
                Haz clic en cualquier fila para abrir la planilla de ese vendedor/punto de venta o edita sus Ventas del Mes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar zona o vendedor..."
                  className="w-full sm:w-48 rounded-xl border border-neutral-300 dark:border-white/15 bg-white/80 dark:bg-slate-950/60 pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="inline-flex rounded-xl border border-neutral-300 dark:border-white/15 bg-neutral-100/80 dark:bg-slate-950/70 p-0.5">
                <button
                  type="button"
                  onClick={() => setMetricMode('COP')}
                  className={`flex-1 sm:flex-initial justify-center inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    metricMode === 'COP'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Pesos ($)
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('UNITS')}
                  className={`flex-1 sm:flex-initial justify-center inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    metricMode === 'UNITS'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Hash className="h-3.5 w-3.5" />
                  Unidades
                </button>
              </div>
            </div>
          </div>

          {filteredZones.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Search}
                title="No se encontraron zonas o puntos de venta"
                description="No hay rutas que coincidan con el filtro actual. Intenta limpiar la búsqueda."
                actionLabel="Restablecer filtros"
                onAction={() => {
                  setChannelFilter('ALL');
                  setSearchQuery('');
                }}
              />
            </div>
          ) : (
            <>
              {/* Mobile Responsive Cards for Zones (md:hidden) */}
              <div className="md:hidden divide-y divide-white/10 p-3 space-y-2.5">
                {filteredZones.map((z) => (
                  <div
                    key={z.id}
                    onClick={() => onSelectZone(z.id)}
                    className="rounded-2xl border border-white/15 bg-slate-900/75 p-3.5 space-y-2.5 active:scale-[0.99] transition-transform cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-7 px-2 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 font-mono text-xs font-bold text-indigo-300">
                          {z.code}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-white truncate">
                            {z.consolidatedName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {z.lineItemsCount} registros · Ventas:{' '}
                            <span className="font-mono text-slate-200">
                              {formatCompactCOP(z.monthlySalesCOP)}
                            </span>
                          </div>
                        </div>
                      </div>
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
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5">
                        <span className="block text-[9px] uppercase text-amber-300">
                          Comercial ({formatPercent(z.pctCommercialOverSales)})
                        </span>
                        <span className="font-mono font-bold text-amber-200">
                          {metricMode === 'COP'
                            ? formatCompactCOP(z.commercialCOP)
                            : `${formatNumber(z.commercialUnits)} u`}
                        </span>
                      </div>
                      <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5">
                        <span className="block text-[9px] uppercase text-sky-300">
                          Calidad ({formatPercent(z.pctQualityOverSales)})
                        </span>
                        <span className="font-mono font-bold text-sky-200">
                          {metricMode === 'COP'
                            ? formatCompactCOP(z.qualityCOP)
                            : `${formatNumber(z.qualityUnits)} u`}
                        </span>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-slate-950/80 px-2.5 py-1.5">
                        <span className="block text-[9px] uppercase text-slate-400">
                          Total Dev.
                        </span>
                        <span className="font-mono font-bold text-white">
                          {metricMode === 'COP'
                            ? formatCompactCOP(z.totalCOP)
                            : `${formatNumber(z.totalUnits)} u`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/70 dark:border-white/10 bg-neutral-100/60 dark:bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-slate-300">
                    <th className="py-3 pl-5 pr-3">Zona / Titular</th>
                    <th className="px-2.5 py-3 text-right">Ventas Mes</th>
                    <th className="px-2.5 py-3 text-right text-amber-600 dark:text-amber-300">
                      Comercial ({metricMode === 'COP' ? '$' : 'Und'})
                    </th>
                    <th className="px-2 py-3 text-right text-amber-600 dark:text-amber-300">
                      % Come
                    </th>
                    <th className="px-2.5 py-3 text-right text-sky-600 dark:text-sky-300">
                      Calidad ({metricMode === 'COP' ? '$' : 'Und'})
                    </th>
                    <th className="px-2 py-3 text-right text-sky-600 dark:text-sky-300">
                      % Calid
                    </th>
                    <th className="px-2.5 py-3 text-right">
                      Total Dev ({metricMode === 'COP' ? '$' : 'Und'})
                    </th>
                    <th className="py-3 pl-2 pr-5 text-right">% Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/50 dark:divide-white/[0.07] text-xs">
                  {filteredZones.map((z) => {
                    const hasSheetNameMismatch =
                      z.sheetName.trim().toLowerCase() !==
                      z.consolidatedName.trim().toLowerCase();

                    return (
                      <tr
                        key={z.id}
                        onClick={() => onSelectZone(z.id)}
                        className="group hover:bg-indigo-500/10 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
                      >
                        <td className="py-3 pl-5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex h-7 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-300 dark:border-white/15 bg-white/80 dark:bg-slate-950/70 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 group-hover:border-indigo-400 transition-colors">
                              {z.code}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-white truncate">
                                <span>{z.consolidatedName}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity" />
                              </div>
                              <div className="text-[11px] text-neutral-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                                <span>{z.lineItemsCount} registros</span>
                                {hasSheetNameMismatch && (
                                  <span className="text-amber-600 dark:text-amber-300/90">
                                    · Pestaña Excel: {z.sheetName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-2.5 py-3 text-right font-mono text-neutral-700 dark:text-slate-200">
                          <button
                            type="button"
                            onClick={(e) => openEditSales(z, e)}
                            title="Editar Ventas Mes de esta zona"
                            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-neutral-200/70 dark:hover:bg-white/10 text-right transition-colors"
                          >
                            <span>{formatCompactCOP(z.monthlySalesCOP)}</span>
                            <Pencil className="h-2.5 w-2.5 text-slate-400 opacity-0 group-hover:opacity-100" />
                          </button>
                        </td>

                        <td className="px-2.5 py-3 text-right font-mono font-medium text-amber-600 dark:text-amber-300">
                          {metricMode === 'COP'
                            ? formatCOP(z.commercialCOP)
                            : formatNumber(z.commercialUnits)}
                        </td>

                        <td className="px-2 py-3 text-right font-mono text-[11px] text-neutral-500 dark:text-slate-400">
                          {formatPercent(z.pctCommercialOverSales)}
                        </td>

                        <td className="px-2.5 py-3 text-right font-mono font-medium text-sky-600 dark:text-sky-300">
                          {metricMode === 'COP'
                            ? formatCOP(z.qualityCOP)
                            : formatNumber(z.qualityUnits)}
                        </td>

                        <td className="px-2 py-3 text-right font-mono text-[11px] text-neutral-500 dark:text-slate-400">
                          {formatPercent(z.pctQualityOverSales)}
                        </td>

                        <td className="px-2.5 py-3 text-right font-mono font-semibold text-neutral-900 dark:text-white">
                          {metricMode === 'COP'
                            ? formatCOP(z.totalCOP)
                            : `${formatNumber(z.totalUnits)} und`}
                        </td>

                        <td className="py-3 pl-2 pr-5 text-right">
                          {z.totalCOP === 0 ? (
                            <Badge variant="neutral">0.00%</Badge>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-300 dark:border-white/20 bg-neutral-100/90 dark:bg-slate-950/80 font-mono text-xs font-bold text-neutral-900 dark:text-white">
                    <td className="py-3.5 pl-5 pr-3 font-sans">
                      SUBTOTAL CONSOLIDADO ({filteredZones.length} Zonas)
                    </td>
                    <td className="px-2.5 py-3.5 text-right">
                      {formatCompactCOP(totals.salesCOP)}
                    </td>
                    <td className="px-2.5 py-3.5 text-right text-amber-600 dark:text-amber-300">
                      {metricMode === 'COP'
                        ? formatCOP(totals.commercialCOP)
                        : formatNumber(totals.commercialUnits)}
                    </td>
                    <td className="px-2 py-3.5 text-right text-amber-600 dark:text-amber-300">
                      {formatPercent(
                        totals.salesCOP > 0
                          ? (totals.commercialCOP / totals.salesCOP) * 100
                          : 0
                      )}
                    </td>
                    <td className="px-2.5 py-3.5 text-right text-sky-600 dark:text-sky-300">
                      {metricMode === 'COP'
                        ? formatCOP(totals.qualityCOP)
                        : formatNumber(totals.qualityUnits)}
                    </td>
                    <td className="px-2 py-3.5 text-right text-sky-600 dark:text-sky-300">
                      {formatPercent(
                        totals.salesCOP > 0
                          ? (totals.qualityCOP / totals.salesCOP) * 100
                          : 0
                      )}
                    </td>
                    <td className="px-2.5 py-3.5 text-right">
                      {metricMode === 'COP'
                        ? formatCOP(totals.totalCOP)
                        : `${formatNumber(totals.totalUnits)} und`}
                    </td>
                    <td className="py-3.5 pl-2 pr-5 text-right">
                      <Badge variant="indigo">
                        {formatPercent(totals.pctTotalOverSales)}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </>
          )}
        </BentoCard>

        {/* Right 4 Cols: Interactive 7 Causes Diagnosis + Clickable Lot Radar with Photos */}
        <div className="lg:col-span-4 space-y-6">
          {/* Interactive Breakdown of the 7 Causes */}
          <BentoCard>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Desglose y Ficha Técnica de las 7 Causas
                </h3>
                <p className="text-xs text-neutral-600 dark:text-slate-300">
                  Haz clic en una causa para ver por qué ocurre y cómo actuar
                </p>
              </div>
              <Stethoscope className="h-4 w-4 text-indigo-400" />
            </div>

            <div className="space-y-2.5">
              {CAUSE_METADATA.map((cause) => {
                const cop = totals.causesCOP[cause.key];
                const units = totals.causesUnits[cause.key];
                const share =
                  totals.totalCOP > 0 ? (cop / totals.totalCOP) * 100 : 0;
                const isSelected = selectedCauseKey === cause.key;

                return (
                  <button
                    key={cause.key}
                    type="button"
                    onClick={() => setSelectedCauseKey(cause.key)}
                    className={`w-full text-left rounded-xl border p-2.5 transition-all ${
                      isSelected
                        ? 'border-indigo-400/60 bg-indigo-500/15 shadow-sm'
                        : 'border-transparent hover:border-white/15 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${cause.colorClass}`}
                        />
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {cause.shortLabel}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500 dark:text-slate-400">
                          ({cause.responsibility === 'COMERCIAL' ? 'Com.' : 'Cal.'})
                        </span>
                      </div>
                      <div className="font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                        {formatCOP(cop)}{' '}
                        <span className="text-[11px] font-normal text-neutral-500 dark:text-slate-400">
                          ({formatNumber(units)}u)
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/70 dark:bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(share, cop > 0 ? 2 : 0)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full rounded-full ${cause.colorClass}`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Cause Technical Explanation Box */}
            <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-slate-950/75 p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300">
                  Diagnóstico: {selectedCauseMeta.fullLabel}
                </span>
                <Badge
                  variant={
                    selectedCauseMeta.responsibility === 'COMERCIAL'
                      ? 'commercial'
                      : 'quality'
                  }
                >
                  {selectedCauseMeta.responsibility}
                </Badge>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {selectedCauseMeta.technicalExplanation}
              </p>
              <div className="pt-1 border-t border-white/10 text-[11px] text-emerald-300">
                <strong>Acción:</strong> {selectedCauseMeta.recommendedAction}
              </div>
            </div>
          </BentoCard>

          {/* Radar de Lotes Críticos con Foto & Salto Directo al Filtro */}
          <BentoCard>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Radar de Trazabilidad por Lote (Col E)
                </h3>
                <p className="text-xs text-neutral-600 dark:text-slate-300">
                  Haz clic en un lote para filtrar sus devoluciones y ver sus fotos
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {topLots.map((lot) => (
                <button
                  key={lot.lot}
                  type="button"
                  onClick={() => {
                    onSelectLot(lot.lot);
                    toast.info(`Filtrando Planilla por Lote L-${lot.lot}`, {
                      description:
                        'Mostrando todos los registros y fotos de evidencia de este lote.',
                    });
                  }}
                  className="group w-full flex items-center justify-between rounded-xl border border-neutral-200/80 dark:border-white/15 bg-white/70 dark:bg-slate-950/55 hover:border-indigo-400/60 hover:bg-indigo-500/10 p-2.5 text-xs text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    {lot.samplePhoto && (
                      <img
                        src={lot.samplePhoto}
                        alt={`Lote ${lot.lot}`}
                        className="h-10 w-12 rounded-lg object-cover border border-white/15 shrink-0 group-hover:scale-105 transition-transform"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300 group-hover:underline">
                          Lote #{lot.lot}
                        </span>
                        <Badge variant="neutral">{lot.units} unds</Badge>
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-slate-400">
                        {lot.mainCause} · {lot.zonesInvolved.size} zona(s)
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-neutral-900 dark:text-white">
                      {formatCOP(lot.valueCOP)}
                    </div>
                    <span className="text-[10px] text-indigo-400 inline-flex items-center gap-0.5">
                      Ver lote y foto <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>

      {/* Modal para Editar Presupuesto de Ventas Mes */}
      <Modal
        open={Boolean(editingSalesZone)}
        onClose={() => setEditingSalesZone(null)}
        title={`Actualizar Ventas del Mes — ${editingSalesZone?.consolidatedName ?? ''}`}
        subtitle="Al ingresar las Ventas del Mes se calculan automáticamente los porcentajes % Comercial y % Calidad."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveSales} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Ventas Totales del Mes (COP $)
            </label>
            <input
              type="number"
              required
              min={0}
              step={1000}
              value={salesInput}
              onChange={(e) => setSalesInput(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-neutral-400">
              Valor formateado:{' '}
              <strong className="text-neutral-200">
                {formatCOP(Number(salesInput) || 0)}
              </strong>
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingSalesZone(null)}
              className="rounded-xl border border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-medium text-white shadow-sm"
            >
              Guardar y Recalcular %
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
