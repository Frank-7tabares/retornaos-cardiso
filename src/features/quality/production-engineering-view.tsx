import React, { useMemo, useState } from 'react';
import {
  FlaskConical,
  Search,
  Calendar,
  Tag,
  Camera,
  Thermometer,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Package,
  MapPin,
  User,
  Maximize2,
  ClipboardCheck,
  Filter,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { EmptyState } from '../../components/ui/empty-state';
import {
  CAUSE_METADATA,
  REAL_PRODUCTS_CATALOG,
} from '../../lib/real-excel-data';
import { formatCOP, formatNumber } from '../../lib/utils';
import { ComputedReturnRow, ReturnCauseKey } from '../../types/returns';

interface ProductionEngineeringViewProps {
  returnRows: ComputedReturnRow[];
  onUpdateRowEvidence: (
    rowId: string,
    photoUrl: string,
    technicalDiagnosis: string,
    storageTempC: number
  ) => void;
}

export const ProductionEngineeringView: React.FC<
  ProductionEngineeringViewProps
> = ({ returnRows, onUpdateRowEvidence }) => {
  const [selectedProductFilter, setSelectedProductFilter] =
    useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [selectedLotFilter, setSelectedLotFilter] = useState<string>('ALL');
  const [responsibilityFilter, setResponsibilityFilter] = useState<
    'ALL' | 'CALIDAD' | 'COMERCIAL'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomedRow, setZoomedRow] = useState<ComputedReturnRow | null>(null);
  const [engineerNotes, setEngineerNotes] = useState<Record<string, string>>(
    {}
  );
  const [approvedIds, setApprovedIds] = useState<Record<string, boolean>>({});

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
      if (r.lotNumber) set.add(r.lotNumber);
    });
    return Array.from(set).sort();
  }, [returnRows]);

  // Unique products present in returnRows
  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    returnRows.forEach((r) => {
      map.set(r.productId, r.productName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [returnRows]);

  const filteredRows = useMemo(() => {
    return returnRows.filter((row) => {
      if (
        selectedProductFilter !== 'ALL' &&
        row.productId !== selectedProductFilter
      ) {
        return false;
      }
      if (selectedDateFilter !== 'ALL' && row.date !== selectedDateFilter) {
        return false;
      }
      if (selectedLotFilter !== 'ALL' && row.lotNumber !== selectedLotFilter) {
        return false;
      }
      if (responsibilityFilter === 'CALIDAD' && row.qualityValueCOP <= 0) {
        return false;
      }
      if (responsibilityFilter === 'COMERCIAL' && row.commercialValueCOP <= 0) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.productName.toLowerCase().includes(q) ||
          row.lotNumber.toLowerCase().includes(q) ||
          row.clientName.toLowerCase().includes(q) ||
          row.zoneName.toLowerCase().includes(q) ||
          (row.technicalDiagnosis || '').toLowerCase().includes(q) ||
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
    responsibilityFilter,
    searchQuery,
  ]);

  const summaryMetrics = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.totalUnits += r.qtyToReceive;
        acc.totalCOP += r.totalValueCOP;
        acc.qualityCOP += r.qualityValueCOP;
        acc.commercialCOP += r.commercialValueCOP;
        return acc;
      },
      { totalUnits: 0, totalCOP: 0, qualityCOP: 0, commercialCOP: 0 }
    );
  }, [filteredRows]);

  const handleApproveCard = (row: ComputedReturnRow) => {
    setApprovedIds((prev) => ({ ...prev, [row.id]: !prev[row.id] }));
    const note = engineerNotes[row.id]?.trim();
    if (note) {
      onUpdateRowEvidence(
        row.id,
        row.evidencePhotoUrl || '',
        note,
        row.storageTempC ?? 4.0
      );
    }
    toast.success(
      `Ficha técnica verificada por Ingeniería: Lote L-${row.lotNumber}`,
      {
        description: `${row.productName} (${row.date}) marcado como revisado por Producción/Calidad.`,
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner for Production Engineers */}
      <div className="rounded-3xl border border-white/20 bg-slate-950/80 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="quality" dot>
                Módulo Exclusivo · Ingenieras de Producción & Calidad
              </Badge>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-medium text-emerald-300">
                Fichas Visuales de Devolución en Tiempo Real
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
              Monitor de Fichas Técnicas de Devolución por Producto, Día y Lote
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Todo lo que los vendedores y puntos de venta suben en su formulario aparece aquí convertido en <strong>fichas técnicas visuales</strong>. Filtra por <strong>Producto (ej. Chorizo)</strong>, por <strong>Día</strong> o por <strong>N° de Lote</strong> para revisar la foto, las 7 causas y el diagnóstico.
            </p>
          </div>

          {/* Summary KPI Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
            <div className="rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-2.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                Fichas Filtradas
              </span>
              <div className="mt-0.5 text-lg font-bold font-mono text-white">
                {filteredRows.length} fichas
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">
                {formatNumber(summaryMetrics.totalUnits)} unds
              </div>
            </div>

            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5">
              <span className="text-[10px] uppercase tracking-wider text-sky-300">
                Costo Planta / Calidad
              </span>
              <div className="mt-0.5 text-lg font-bold font-mono text-sky-300">
                {formatCOP(summaryMetrics.qualityCOP)}
              </div>
              <div className="text-[11px] text-sky-200/80">
                Lechoso, Vacío, Fecha
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <span className="text-[10px] uppercase tracking-wider text-amber-300">
                Costo Comercial
              </span>
              <div className="mt-0.5 text-lg font-bold font-mono text-amber-300">
                {formatCOP(summaryMetrics.commercialCOP)}
              </div>
              <div className="text-[11px] text-amber-200/80">
                Próx. Vencer, Cobrar
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls: Product, Date, Lot, Responsibility */}
        <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Filter by Product (e.g., Chorizo) */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-emerald-400" />
              1. Filtrar por Producto (ej. Chorizo)
            </label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">
                Todos los Productos ({uniqueProducts.length})
              </option>
              {uniqueProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filter by Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
              2. Filtrar por Día / Fecha Recepción
            </label>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-indigo-400 focus:outline-none"
            >
              <option value="ALL">Todos los Días ({uniqueDates.length})</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  Día: {d}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter by Lot */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-amber-400" />
              3. Filtrar por N° de Lote (Col E)
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

          {/* 4. Filter by Area Responsibility */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-sky-400" />
              4. Tipo de Causa
            </label>
            <select
              value={responsibilityFilter}
              onChange={(e) =>
                setResponsibilityFilter(
                  e.target.value as 'ALL' | 'CALIDAD' | 'COMERCIAL'
                )
              }
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
            >
              <option value="ALL">Todas (Calidad + Comercial)</option>
              <option value="CALIDAD">
                Solo Planta / Calidad (Lechoso, Vacío, Fecha, Abomba)
              </option>
              <option value="COMERCIAL">
                Solo Comercial (Próx. Vencer, A Cobrar, Vencido)
              </option>
            </select>
          </div>

          {/* 5. Free Search */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              5. Búsqueda Rápida
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. Chorizo, 259, Sabaneta..."
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
              {(selectedProductFilter !== 'ALL' ||
                selectedDateFilter !== 'ALL' ||
                selectedLotFilter !== 'ALL' ||
                responsibilityFilter !== 'ALL' ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductFilter('ALL');
                    setSelectedDateFilter('ALL');
                    setSelectedLotFilter('ALL');
                    setResponsibilityFilter('ALL');
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

      {/* Grid of Beautiful Inspection Cards (Exact design from user's screenshot) */}
      {filteredRows.length === 0 ? (
        <div className="rounded-3xl border border-white/15 bg-slate-950/80 p-8 backdrop-blur-2xl">
          <EmptyState
            icon={FlaskConical}
            title="No hay fichas de devolución para este filtro"
            description="Cambia el producto, fecha o lote seleccionado para ver las tarjetas técnicas con foto."
            actionLabel="Mostrar Todas las Fichas"
            onAction={() => {
              setSelectedProductFilter('ALL');
              setSelectedDateFilter('ALL');
              setSelectedLotFilter('ALL');
              setResponsibilityFilter('ALL');
              setSearchQuery('');
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredRows.map((row) => {
            const primaryCauseMeta =
              CAUSE_METADATA.find((c) => c.key === row.primaryCauseKey) ||
              CAUSE_METADATA[3];
            const isApproved = Boolean(approvedIds[row.id]);

            return (
              <div
                key={row.id}
                className="rounded-3xl border border-white/20 bg-neutral-950/90 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col justify-between space-y-4 transition-all hover:border-indigo-400/40"
              >
                {/* Card Top Header: Product, Date, Lot, Zone & Client */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-neutral-800 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                        Lote #{row.lotNumber}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-300">
                        <Calendar className="h-3 w-3" />
                        Día: {row.date}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        Vence: {row.productExpiryDate}
                      </span>
                    </div>

                    <h3 className="mt-2 text-base sm:text-lg font-bold text-white tracking-tight">
                      {row.productName} — {row.zoneName}
                    </h3>
                    <p className="text-xs text-neutral-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>
                        Cliente / Sede:{' '}
                        <strong className="text-neutral-200">
                          {row.clientName}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Costo Unitario:{' '}
                        <strong className="font-mono text-indigo-300">
                          {formatCOP(row.unitCost)}
                        </strong>
                      </span>
                      {row.storageTempC !== undefined && (
                        <>
                          <span>·</span>
                          <span
                            className={`inline-flex items-center gap-0.5 font-mono font-semibold ${
                              row.storageTempC > 5
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            <Thermometer className="h-3 w-3" />
                            Recepción: {row.storageTempC}°C
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {isApproved ? (
                    <Badge variant="success" dot>
                      Revisado Ingeniería
                    </Badge>
                  ) : (
                    <Badge
                      variant={
                        primaryCauseMeta.responsibility === 'CALIDAD'
                          ? 'quality'
                          : 'commercial'
                      }
                      dot
                    >
                      {primaryCauseMeta.responsibility === 'CALIDAD'
                        ? 'Planta / Calidad'
                        : 'Comercial'}
                    </Badge>
                  )}
                </div>

                {/* Section 1: Exact "Clasificación por Causa de Devolución (Cols G a M)" Box from Screenshot */}
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-100">
                      Clasificación por Causa de Devolución (Cols G a M)
                    </span>
                    <Badge
                      variant={
                        row.reconciliationStatus === 'REVISAR'
                          ? 'warning'
                          : 'success'
                      }
                      dot
                    >
                      {row.reconciliationStatus === 'REVISAR'
                        ? `REVISAR (${row.totalClassifiedUnits} de ${row.qtyToReceive} und)`
                        : `CUADRADO (${row.totalClassifiedUnits} = ${row.qtyToReceive} und)`}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {CAUSE_METADATA.map((c) => {
                      const units = row.causes[c.key];
                      const cop = row.copByCause[c.key];
                      const isActive = units > 0;

                      return (
                        <div
                          key={c.key}
                          className={`rounded-xl border p-2.5 transition-all ${
                            isActive
                              ? 'border-indigo-500/60 bg-indigo-950/40 shadow-sm'
                              : 'border-neutral-800/90 bg-neutral-950/60 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-300 mb-1">
                            <span className="truncate">{c.shortLabel}</span>
                            <span
                              className={`text-[10px] font-semibold ${
                                c.responsibility === 'COMERCIAL'
                                  ? 'text-amber-400'
                                  : 'text-sky-400'
                              }`}
                            >
                              {c.responsibility === 'COMERCIAL'
                                ? 'Com.'
                                : 'Cal.'}
                            </span>
                          </div>
                          <div
                            className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold ${
                              isActive
                                ? 'border-indigo-400/50 bg-neutral-950 text-white'
                                : 'border-neutral-800 bg-neutral-950 text-neutral-500'
                            }`}
                          >
                            {units}
                          </div>
                          <div
                            className={`mt-1 text-right font-mono text-[10px] ${
                              isActive
                                ? 'text-indigo-300 font-semibold'
                                : 'text-neutral-500'
                            }`}
                          >
                            {formatCOP(cop)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Blue Technical Ficha Box (Exact style from screenshot) */}
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3 text-xs">
                    <div className="font-semibold text-indigo-300">
                      Ficha Técnica de la Causa ({primaryCauseMeta.fullLabel}):
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-200 leading-relaxed">
                      {primaryCauseMeta.technicalExplanation}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-300">
                      <strong>Acción sugerida para Ingeniería:</strong>{' '}
                      {primaryCauseMeta.recommendedAction}
                    </p>
                  </div>
                </div>

                {/* Section 2: Exact "Evidencia Fotográfica del Producto Devuelto" Box from Screenshot */}
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Clickable Photo with Zoom Icon */}
                    <button
                      type="button"
                      onClick={() => setZoomedRow(row)}
                      className="group relative h-28 w-full sm:w-36 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900"
                      title="Haz clic para ver la evidencia fotográfica en pantalla completa"
                    >
                      <img
                        src={
                          row.evidencePhotoUrl ||
                          'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80'
                        }
                        alt={row.productName}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                          <Maximize2 className="h-3 w-3" />
                          Ampliar Foto
                        </span>
                      </div>
                    </button>

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-white">
                            Evidencia Fotográfica y Diagnóstico del Producto Devuelto
                          </div>
                          <p className="text-[11px] text-neutral-400">
                            Subido por: <strong className="text-neutral-200">{row.createdBy}</strong> · Ruta {row.zoneId}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setZoomedRow(row)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-all"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Inspeccionar Foto
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200">
                          <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                            Diagnóstico Recepción / Calidad
                          </span>
                          <span className="font-medium">
                            {row.technicalDiagnosis ||
                              'Sin nota técnica adicional.'}
                          </span>
                        </div>
                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200">
                          <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                            Observación / Factura (Col P)
                          </span>
                          <span className="font-medium">
                            {row.observations || 'Sin observaciones'}
                            {row.invoiceRef ? ` · ${row.invoiceRef}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Total Monetary Impact + Production Engineer Sign-Off */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-neutral-800 pt-3">
                  <div className="text-xs text-neutral-400">
                    Impacto Monetario Total:{' '}
                    <strong className="font-mono text-base text-white">
                      {formatCOP(row.totalValueCOP)}
                    </strong>{' '}
                    <span className="text-[11px] text-neutral-500">
                      ({row.qtyToReceive} und × {formatCOP(row.unitCost)})
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={engineerNotes[row.id] ?? ''}
                      onChange={(e) =>
                        setEngineerNotes((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      placeholder="Nota de Ing. de Producción..."
                      className="w-full sm:w-52 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 sm:py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleApproveCard(row)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                        isApproved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      {isApproved ? 'Dictamen Guardado' : 'Aprobar Revisión'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Photo & Ficha Zoom Modal */}
      <Modal
        open={Boolean(zoomedRow)}
        onClose={() => setZoomedRow(null)}
        title={
          zoomedRow
            ? `${zoomedRow.productName} — Lote #${zoomedRow.lotNumber} (Día: ${zoomedRow.date})`
            : ''
        }
        subtitle={
          zoomedRow
            ? `Ruta: ${zoomedRow.zoneName} · Cliente: ${zoomedRow.clientName} · Temperatura: ${zoomedRow.storageTempC ?? 4.0}°C`
            : ''
        }
        maxWidthClass="max-w-3xl"
      >
        {zoomedRow && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black max-h-[420px] flex items-center justify-center">
              <img
                src={
                  zoomedRow.evidencePhotoUrl ||
                  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=85'
                }
                alt={zoomedRow.productName}
                className="max-h-[420px] w-full object-contain"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <div className="text-neutral-400 font-medium">
                  Diagnóstico Registrado:
                </div>
                <div className="mt-1 text-white">
                  {zoomedRow.technicalDiagnosis}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <div className="text-neutral-400 font-medium">
                  Observaciones y Costo Total:
                </div>
                <div className="mt-1 text-white">
                  {zoomedRow.observations} —{' '}
                  <strong className="font-mono text-emerald-400">
                    {formatCOP(zoomedRow.totalValueCOP)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
