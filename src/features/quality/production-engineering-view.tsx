import React, { useMemo, useRef, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
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
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('ALL');
  const [selectedClientFilter, setSelectedClientFilter] =
    useState<string>('ALL');
  const [causeFilter, setCauseFilter] = useState<
    'ALL' | 'CALIDAD' | 'COMERCIAL' | ReturnCauseKey
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'MATRIX' | 'DETAIL'>('MATRIX');
  const [chartBarMode, setChartBarMode] = useState<'LOTS' | 'DATES'>('LOTS');
  const [detailLimit, setDetailLimit] = useState<number>(100);
  const semaforoScrollRef = useRef<HTMLDivElement | null>(null);

  const showCalidadGroup =
    causeFilter === 'ALL' ||
    causeFilter === 'CALIDAD' ||
    causeFilter === 'vacio' ||
    causeFilter === 'lechozo' ||
    causeFilter === 'xFecha' ||
    causeFilter === 'abomba';

  const showComercialGroup =
    causeFilter === 'ALL' ||
    causeFilter === 'COMERCIAL' ||
    causeFilter === 'proxVencer' ||
    causeFilter === 'vencido' ||
    causeFilter === 'aCobrar';

  const scrollSemaforo = (dir: 'LEFT' | 'RIGHT') => {
    const el = semaforoScrollRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;

    if (dir === 'RIGHT') {
      // Si ya llegó al final (última página), se devuelve automáticamente al inicio (#1)
      if (el.scrollLeft >= maxScrollLeft - 24) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const nextLeft = Math.min(maxScrollLeft, el.scrollLeft + el.clientWidth * 0.85);
        el.scrollTo({ left: nextLeft, behavior: 'smooth' });
      }
    } else {
      // Si está al inicio y da clic en Anterior, va al final
      if (el.scrollLeft <= 24) {
        el.scrollTo({ left: maxScrollLeft, behavior: 'smooth' });
      } else {
        const prevLeft = Math.max(0, el.scrollLeft - el.clientWidth * 0.85);
        el.scrollTo({ left: prevLeft, behavior: 'smooth' });
      }
    }
  };

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

  // Unique zones present in returnRows
  const uniqueZones = useMemo(() => {
    const map = new Map<string, string>();
    returnRows.forEach((r) => {
      if (r.zoneId) map.set(r.zoneId, r.zoneName || r.zoneId);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [returnRows]);

  // Unique clients present in returnRows
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    returnRows.forEach((r) => {
      const c = (r.clientName || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [returnRows]);

  // Filas base invariantes (filtradas por Fecha, Lote, Zona y Cliente cuando se seleccionan)
  const basePeriodRows = useMemo(() => {
    return returnRows.filter((row) => {
      if (selectedDateFilter !== 'ALL' && row.date !== selectedDateFilter) {
        return false;
      }
      if (selectedLotFilter !== 'ALL' && row.lotNumber !== selectedLotFilter) {
        return false;
      }
      if (selectedZoneFilter !== 'ALL' && row.zoneId !== selectedZoneFilter) {
        return false;
      }
      if (
        selectedClientFilter !== 'ALL' &&
        row.clientName.trim() !== selectedClientFilter
      ) {
        return false;
      }
      const qU =
        row.causes.vacio +
        row.causes.lechozo +
        row.causes.xFecha +
        row.causes.abomba;
      const cU =
        row.causes.proxVencer + row.causes.vencido + row.causes.aCobrar;
      return qU + cU > 0;
    });
  }, [
    returnRows,
    selectedDateFilter,
    selectedLotFilter,
    selectedZoneFilter,
    selectedClientFilter,
  ]);

  const isCauseIncluded = (k: ReturnCauseKey): boolean => {
    if (causeFilter === 'ALL') return true;
    if (causeFilter === 'CALIDAD') {
      return (
        k === 'vacio' ||
        k === 'lechozo' ||
        k === 'xFecha' ||
        k === 'abomba'
      );
    }
    if (causeFilter === 'COMERCIAL') {
      return k === 'proxVencer' || k === 'vencido' || k === 'aCobrar';
    }
    return causeFilter === k;
  };

  const filteredRows = useMemo(() => {
    const out: ComputedReturnRow[] = [];

    for (const row of basePeriodRows) {
      if (
        selectedProductFilter !== 'ALL' &&
        row.productName !== selectedProductFilter
      ) {
        continue;
      }

      const mVacio = isCauseIncluded('vacio') ? row.causes.vacio : 0;
      const mLechozo = isCauseIncluded('lechozo') ? row.causes.lechozo : 0;
      const mXFecha = isCauseIncluded('xFecha') ? row.causes.xFecha : 0;
      const mAbomba = isCauseIncluded('abomba') ? row.causes.abomba : 0;
      const mProx = isCauseIncluded('proxVencer') ? row.causes.proxVencer : 0;
      const mVenc = isCauseIncluded('vencido') ? row.causes.vencido : 0;
      const mCobrar = isCauseIncluded('aCobrar') ? row.causes.aCobrar : 0;

      const qSum = mVacio + mLechozo + mXFecha + mAbomba;
      const cSum = mProx + mVenc + mCobrar;
      const totalMatched = qSum + cSum;

      if (totalMatched <= 0) continue;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText =
          row.productName.toLowerCase().includes(q) ||
          row.lotNumber.toLowerCase().includes(q) ||
          row.clientName.toLowerCase().includes(q) ||
          row.zoneName.toLowerCase().includes(q) ||
          row.observations.toLowerCase().includes(q);
        if (!matchesText) continue;
      }

      if (causeFilter === 'ALL') {
        out.push(row);
      } else {
        const maskedCauses: Record<ReturnCauseKey, number> = {
          vacio: mVacio,
          lechozo: mLechozo,
          xFecha: mXFecha,
          abomba: mAbomba,
          proxVencer: mProx,
          vencido: mVenc,
          aCobrar: mCobrar,
        };
        const qCOP =
          (mVacio > 0 ? row.copByCause.vacio : 0) +
          (mLechozo > 0 ? row.copByCause.lechozo : 0) +
          (mXFecha > 0 ? row.copByCause.xFecha : 0) +
          (mAbomba > 0 ? row.copByCause.abomba : 0);
        const cCOP =
          (mProx > 0 ? row.copByCause.proxVencer : 0) +
          (mVenc > 0 ? row.copByCause.vencido : 0) +
          (mCobrar > 0 ? row.copByCause.aCobrar : 0);

        // Determine primaryCauseKey ONLY among the allowed causes
        let bestKey: ReturnCauseKey = 'proxVencer';
        let bestVal = -1;
        (Object.keys(maskedCauses) as ReturnCauseKey[]).forEach((k) => {
          if (maskedCauses[k] > bestVal) {
            bestVal = maskedCauses[k];
            bestKey = k;
          }
        });

        out.push({
          ...row,
          qtyToReceive: totalMatched,
          totalClassifiedUnits: totalMatched,
          qualityValueCOP: qCOP,
          commercialValueCOP: cCOP,
          totalValueCOP: qCOP + cCOP,
          causes: maskedCauses,
          primaryCauseKey: bestKey,
        });
      }
    }

    return out;
  }, [
    basePeriodRows,
    selectedProductFilter,
    causeFilter,
    searchQuery,
  ]);

  // Aggregate global KPI metrics (invariantes para el periodo/lote activo)
  const globalMetrics = useMemo(() => {
    return basePeriodRows.reduce(
      (acc, r) => {
        const qUnits =
          r.causes.vacio +
          r.causes.lechozo +
          r.causes.xFecha +
          r.causes.abomba;
        const cUnits =
          r.causes.proxVencer + r.causes.vencido + r.causes.aCobrar;
        acc.totalUnits += qUnits + cUnits;
        acc.qualityUnits += qUnits;
        acc.commercialUnits += cUnits;
        acc.totalCOP += r.qualityValueCOP + r.commercialValueCOP;
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
        qualityUnits: 0,
        commercialUnits: 0,
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
  }, [basePeriodRows]);

  // Datos para las Gráficas de Ingeniería de Producción (Causas, Lotes y Fechas sincronizados con el filtro activo: Comercial vs Calidad)
  const engineeringChartsData = useMemo(() => {
    const allCausesList = [
      {
        key: 'lechozo' as ReturnCauseKey,
        label: 'Lechosidad (Planta)',
        units: isCauseIncluded('lechozo') ? globalMetrics.lechozoUnits : 0,
        colorHex: '#8b5cf6',
        barClass: 'bg-violet-500',
        textClass: 'text-violet-300',
        group: 'CALIDAD',
      },
      {
        key: 'vacio' as ReturnCauseKey,
        label: 'Pérdida de Vacío (Planta)',
        units: isCauseIncluded('vacio') ? globalMetrics.vacioUnits : 0,
        colorHex: '#0ea5e9',
        barClass: 'bg-sky-500',
        textClass: 'text-sky-300',
        group: 'CALIDAD',
      },
      {
        key: 'xFecha' as ReturnCauseKey,
        label: 'X Fecha / Embombamiento (Planta)',
        units:
          (isCauseIncluded('xFecha') ? globalMetrics.xFechaUnits : 0) +
          (isCauseIncluded('abomba') ? globalMetrics.abombaUnits : 0),
        colorHex: '#06b6d4',
        barClass: 'bg-cyan-500',
        textClass: 'text-cyan-300',
        group: 'CALIDAD',
      },
      {
        key: 'proxVencer' as ReturnCauseKey,
        label: 'Próximo a Vencer (Comercial)',
        units: isCauseIncluded('proxVencer') ? globalMetrics.proxVencerUnits : 0,
        colorHex: '#f59e0b',
        barClass: 'bg-amber-500',
        textClass: 'text-amber-300',
        group: 'COMERCIAL',
      },
      {
        key: 'aCobrar' as ReturnCauseKey,
        label: 'Vencido / X Cobrar (Comercial)',
        units:
          (isCauseIncluded('aCobrar') ? globalMetrics.aCobrarUnits : 0) +
          (isCauseIncluded('vencido') ? globalMetrics.vencidoUnits : 0),
        colorHex: '#f43f5e',
        barClass: 'bg-rose-500',
        textClass: 'text-rose-300',
        group: 'COMERCIAL',
      },
    ];

    const causesList = allCausesList.filter((c) => {
      if (!showCalidadGroup && c.group === 'CALIDAD') return false;
      if (!showComercialGroup && c.group === 'COMERCIAL') return false;
      return true;
    });

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

    for (const r of basePeriodRows) {
      const qU =
        (isCauseIncluded('lechozo') ? r.causes.lechozo : 0) +
        (isCauseIncluded('vacio') ? r.causes.vacio : 0) +
        (isCauseIncluded('xFecha') ? r.causes.xFecha : 0) +
        (isCauseIncluded('abomba') ? r.causes.abomba : 0);
      const cU =
        (isCauseIncluded('aCobrar') ? r.causes.aCobrar : 0) +
        (isCauseIncluded('proxVencer') ? r.causes.proxVencer : 0) +
        (isCauseIncluded('vencido') ? r.causes.vencido : 0);

      if (qU + cU <= 0) continue;

      if (r.lotNumber && r.lotNumber !== 'S/L') {
        const prevLot = lotMap.get(r.lotNumber) || {
          lot: r.lotNumber,
          qualityUnits: 0,
          commercialUnits: 0,
          totalUnits: 0,
        };
        prevLot.qualityUnits += qU;
        prevLot.commercialUnits += cU;
        prevLot.totalUnits += qU + cU;
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
        prevDate.totalUnits += qU + cU;
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
  }, [basePeriodRows, globalMetrics, causeFilter, showCalidadGroup, showComercialGroup]);

  // Matriz de Productos sincronizada con el filtro de causa activo (cuando filtras Comercial o una causa específica, SOLO suma y muestra esa causa/grupo sin mezclar Planta con Comercial)
  const allProductsMatrix = useMemo<ProductQualitySummary[]>(() => {
    const map = new Map<string, ProductQualitySummary>();

    const isCauseIncluded = (k: ReturnCauseKey): boolean => {
      if (causeFilter === 'ALL') return true;
      if (causeFilter === 'CALIDAD') {
        return (
          k === 'vacio' ||
          k === 'lechozo' ||
          k === 'xFecha' ||
          k === 'abomba'
        );
      }
      if (causeFilter === 'COMERCIAL') {
        return k === 'proxVencer' || k === 'vencido' || k === 'aCobrar';
      }
      return causeFilter === k;
    };

    for (const r of basePeriodRows) {
      const mVacio = isCauseIncluded('vacio') ? r.causes.vacio : 0;
      const mLechozo = isCauseIncluded('lechozo') ? r.causes.lechozo : 0;
      const mXFecha = isCauseIncluded('xFecha') ? r.causes.xFecha : 0;
      const mAbomba = isCauseIncluded('abomba') ? r.causes.abomba : 0;

      const mProxVencer = isCauseIncluded('proxVencer')
        ? r.causes.proxVencer
        : 0;
      const mVencido = isCauseIncluded('vencido') ? r.causes.vencido : 0;
      const mACobrar = isCauseIncluded('aCobrar') ? r.causes.aCobrar : 0;

      // CALIDAD (Producción): vacío + lechosidad + x fecha + embombamiento
      const qUnits = mVacio + mLechozo + mXFecha + mAbomba;
      const qCOP =
        (isCauseIncluded('vacio') ? r.copByCause.vacio : 0) +
        (isCauseIncluded('lechozo') ? r.copByCause.lechozo : 0) +
        (isCauseIncluded('xFecha') ? r.copByCause.xFecha : 0) +
        (isCauseIncluded('abomba') ? r.copByCause.abomba : 0);

      // COMERCIAL (Ventas): próximo + vencido + x cobrar
      const cUnits = mProxVencer + mVencido + mACobrar;
      const cCOP =
        (isCauseIncluded('proxVencer') ? r.copByCause.proxVencer : 0) +
        (isCauseIncluded('vencido') ? r.copByCause.vencido : 0) +
        (isCauseIncluded('aCobrar') ? r.copByCause.aCobrar : 0);

      const classifiedTotal = qUnits + cUnits;
      if (classifiedTotal <= 0) continue;

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

      entry.totalUnits += classifiedTotal;
      entry.qualityUnits += qUnits;
      entry.commercialUnits += cUnits;
      entry.totalCOP += qCOP + cCOP;
      entry.qualityCOP += qCOP;
      entry.commercialCOP += cCOP;

      entry.causes.aCobrar += mACobrar;
      entry.causes.xFecha += mXFecha;
      entry.causes.vacio += mVacio;
      entry.causes.proxVencer += mProxVencer;
      entry.causes.vencido += mVencido;
      entry.causes.abomba += mAbomba;
      entry.causes.lechozo += mLechozo;

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
        lotItem.totalUnits += classifiedTotal;
        lotItem.lechozo += mLechozo;
        lotItem.vacio += mVacio;
        lotItem.xFecha += mXFecha;
        lotItem.abomba += mAbomba;
        lotItem.proxVencer += mProxVencer;
        entry.lotsMap.set(r.lotNumber, lotItem);
      }
    }

    const list = Array.from(map.values())
      .filter((item) => item.totalUnits > 0)
      .map((item) => {
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

    return list.sort((a, b) => {
      if (b.totalUnits !== a.totalUnits) {
        return b.totalUnits - a.totalUnits;
      }
      return b.totalCOP - a.totalCOP;
    });
  }, [basePeriodRows, causeFilter]);

  // Tabla visible (muestra exactamente los mismos objetos de allProductsMatrix)
  const productMatrix = useMemo<ProductQualitySummary[]>(() => {
    return allProductsMatrix.filter((item) => {
      if (
        selectedProductFilter !== 'ALL' &&
        item.productName !== selectedProductFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hasLot = Array.from(item.lotsMap.keys()).some((l) =>
          l.toLowerCase().includes(q)
        );
        if (!item.productName.toLowerCase().includes(q) && !hasLot) {
          return false;
        }
      }
      return true;
    });
  }, [allProductsMatrix, selectedProductFilter, searchQuery]);

  // Semáforo de Productos: incluye TODOS los productos (sin límite de 4) con scroll horizontal a la derecha y los mismos datos exactos de la tabla
  const topQualityAlerts = useMemo(() => {
    return allProductsMatrix.map((prod) => {
      const sortedLots = Array.from(prod.lotsMap.values())
        .filter((l) => l.totalUnits > 0)
        .sort((a, b) => b.totalUnits - a.totalUnits)
        .slice(0, 5)
        .map((l) => ({
          lot: l.lot,
          units: l.totalUnits,
        }));

      return {
        productName: prod.productName,
        totalUnits: prod.totalUnits,
        totalCOP: prod.totalCOP,
        qualityUnits: prod.qualityUnits,
        qualityCOP: prod.qualityCOP,
        commercialUnits: prod.commercialUnits,
        commercialCOP: prod.commercialCOP,
        causes: prod.causes,
        topLots: sortedLots,
      };
    });
  }, [allProductsMatrix]);

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

        {/* Bloques Oficiales Sincronizados con el Filtro: CALIDAD (Producción) y COMERCIAL (Ventas) */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Bloque CALIDAD (Producción): Vacío, Lechosidad, X Fecha, Embombamiento */}
          {showCalidadGroup && (
            <div
              className={`${
                showComercialGroup ? 'lg:col-span-7' : 'lg:col-span-12'
              } rounded-2xl border border-sky-500/35 bg-sky-950/25 p-4 space-y-3`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 pb-2.5">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                    1. CALIDAD (Producción) — Vacío · Lechosidad · X Fecha · Embombamiento
                  </span>
                  <p className="text-[11px] text-slate-300">
                    Suma exacta de las 4 causales de planta
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg sm:text-xl font-extrabold text-sky-300">
                    {formatNumber(globalMetrics.qualityUnits)} und · {formatCOP(globalMetrics.qualityCOP)}
                  </div>
                  <span className="text-[10px] text-sky-200/80">
                    {globalMetrics.totalUnits > 0
                      ? `${formatPercent((globalMetrics.qualityUnits / globalMetrics.totalUnits) * 100)} de las unidades`
                      : '0%'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-sky-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-sky-300">
                    • Vacío
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.vacioUnits)} und
                  </div>
                </div>
                <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-violet-300">
                    • Lechosidad
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.lechozoUnits)} und
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-cyan-300">
                    • X Fecha
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.xFechaUnits)} und
                  </div>
                </div>
                <div className="rounded-xl border border-fuchsia-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-fuchsia-300">
                    • Embombamiento
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.abombaUnits)} und
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bloque COMERCIAL (Ventas): Próximo, Vencido, X Cobrar */}
          {showComercialGroup && (
            <div
              className={`${
                showCalidadGroup ? 'lg:col-span-5' : 'lg:col-span-12'
              } rounded-2xl border border-amber-500/35 bg-amber-950/25 p-4 space-y-3`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    {showCalidadGroup ? '2. ' : ''}COMERCIAL (Ventas) — Próximo · Vencido · X Cobrar
                  </span>
                  <p className="text-[11px] text-slate-300">
                    Suma exacta de las 3 causales comerciales
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg sm:text-xl font-extrabold text-amber-300">
                    {formatNumber(globalMetrics.commercialUnits)} und · {formatCOP(globalMetrics.commercialCOP)}
                  </div>
                  <span className="text-[10px] text-amber-200/80">
                    {globalMetrics.totalUnits > 0
                      ? `${formatPercent((globalMetrics.commercialUnits / globalMetrics.totalUnits) * 100)} de las unidades`
                      : '0%'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-amber-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-amber-300">
                    • Próximo
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.proxVencerUnits)} und
                  </div>
                </div>
                <div className="rounded-xl border border-orange-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-orange-300">
                    • Vencido
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.vencidoUnits)} und
                  </div>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-slate-900/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-rose-300">
                    • X Cobrar
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {formatNumber(globalMetrics.aCobrarUnits)} und
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Radar of Critical Products & Lots (Semáforo de Productos con Scroll Horizontal y sincronizado 100% con el filtro y la Tabla) */}
      {topQualityAlerts.length > 0 && (
        <div className="rounded-3xl border border-violet-500/30 bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-violet-400" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Semáforo de Productos ({topQualityAlerts.length} Productos — Desliza a la derecha ▶)
                </h2>
              </div>
              <p className="text-xs text-emerald-300 font-medium mt-0.5">
                {showCalidadGroup && showComercialGroup
                  ? 'Mostrando Calidad (Planta) + Comercial (Ventas) = Total Devuelto'
                  : showCalidadGroup
                  ? 'Filtro Activo: Mostrando SOLO Calidad (Planta) sin Comercial'
                  : 'Filtro Activo: Mostrando SOLO Comercial (Ventas) sin Planta'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollSemaforo('LEFT')}
                className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition-all"
                title="Deslizar a la izquierda"
              >
                <ChevronLeft className="h-4 w-4 text-emerald-400" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => scrollSemaforo('RIGHT')}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-600/25 hover:bg-emerald-600/40 px-3.5 py-1.5 text-xs font-bold text-emerald-200 transition-all"
                title="Deslizar a la derecha para ver más productos"
              >
                Ver más productos
                <ChevronRight className="h-4 w-4 text-emerald-300" />
              </button>
            </div>
          </div>

          <div
            ref={semaforoScrollRef}
            className="flex gap-3.5 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth"
          >
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
                className={`min-w-[285px] sm:min-w-[310px] max-w-[325px] shrink-0 snap-start cursor-pointer rounded-2xl border p-4 transition-all ${
                  selectedProductFilter === alert.productName
                    ? 'border-violet-400 bg-violet-950/50 shadow-lg shadow-violet-500/20'
                    : 'border-white/15 bg-slate-900/80 hover:border-violet-400/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    #{idx + 1} de {topQualityAlerts.length}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-white">
                    Total: {formatNumber(alert.totalUnits)} und ({formatCOP(alert.totalCOP)})
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-white leading-snug truncate" title={alert.productName}>
                  {alert.productName}
                </h3>

                {/* Desglose Exacto Calidad (Producción) — Solo se muestra si el filtro incluye Calidad */}
                {showCalidadGroup && (
                  <div className="mt-2.5 rounded-xl border border-sky-500/25 bg-sky-950/30 p-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-sky-300">
                      <span>CALIDAD (Producción):</span>
                      <span className="font-mono">{alert.qualityUnits} und · {formatCOP(alert.qualityCOP)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-200">
                      <span>• Vacío: <strong>{alert.causes.vacio}</strong></span>
                      <span>• Lechosidad: <strong>{alert.causes.lechozo}</strong></span>
                      <span>• X Fecha: <strong>{alert.causes.xFecha}</strong></span>
                      <span>• Embomb.: <strong>{alert.causes.abomba}</strong></span>
                    </div>
                  </div>
                )}

                {/* Desglose Exacto Comercial (Ventas) — Solo se muestra si el filtro incluye Comercial */}
                {showComercialGroup && (
                  <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-950/25 p-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span>COMERCIAL (Ventas):</span>
                      <span className="font-mono">{alert.commercialUnits} und · {formatCOP(alert.commercialCOP)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-200">
                      <span>• Próx: <strong>{alert.causes.proxVencer}</strong></span>
                      <span>• Venc: <strong>{alert.causes.vencido}</strong></span>
                      <span>• Cobrar: <strong>{alert.causes.aCobrar}</strong></span>
                    </div>
                  </div>
                )}

                {/* Lots involved (Exact same filtered lot units as in the Table) */}
                <div className="mt-2.5 pt-2 border-t border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                    Lotes afectados (mismos de la tabla):
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
                          className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold border transition-all ${
                            selectedLotFilter === l.lot
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                              : 'bg-slate-950 text-emerald-300 border-emerald-500/30 hover:border-emerald-400'
                          }`}
                        >
                          L-{l.lot} ({l.units}u)
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500">Sin lote</span>
                    )}
                  </div>
                </div>
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
                      {!showCalidadGroup
                        ? '100%'
                        : !showComercialGroup
                        ? '100%'
                        : globalMetrics.totalUnits > 0
                        ? `${Math.round(
                            ((globalMetrics.lechozoUnits +
                              globalMetrics.vacioUnits +
                              globalMetrics.xFechaUnits +
                              globalMetrics.abombaUnits) /
                              globalMetrics.totalUnits) *
                              100
                          )}%`
                        : '0%'}
                    </span>
                    <span className="text-[9px] uppercase text-sky-300 font-bold">
                      {!showCalidadGroup ? 'Comercial' : 'Planta'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs flex-1 min-w-0">
                  {showCalidadGroup && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-violet-300 font-semibold">
                          🟣 Lechosidad:
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatNumber(
                            isCauseIncluded('lechozo')
                              ? globalMetrics.lechozoUnits
                              : 0
                          )}{' '}
                          u
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sky-300 font-semibold">
                          🔵 Vacío:
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatNumber(
                            isCauseIncluded('vacio')
                              ? globalMetrics.vacioUnits
                              : 0
                          )}{' '}
                          u
                        </span>
                      </div>
                    </>
                  )}
                  {showComercialGroup && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300 font-semibold">
                          🟠 Próximo:
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatNumber(
                            isCauseIncluded('proxVencer')
                              ? globalMetrics.proxVencerUnits
                              : 0
                          )}{' '}
                          u
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-rose-300 font-semibold">
                          🔴 Venc. + X Cobrar:
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatNumber(
                            (isCauseIncluded('vencido')
                              ? globalMetrics.vencidoUnits
                              : 0) +
                              (isCauseIncluded('aCobrar')
                                ? globalMetrics.aCobrarUnits
                                : 0)
                          )}{' '}
                          u
                        </span>
                      </div>
                    </>
                  )}
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
              onClick={() => setCauseFilter('COMERCIAL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                causeFilter === 'COMERCIAL'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-slate-800'
              }`}
            >
              🟠 Solo Comercial (Ventas: {globalMetrics.commercialUnits})
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
              🟠 Solo Próx. a Vencer ({globalMetrics.proxVencerUnits})
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-white/10">
          <div>
            <label className="block text-[11px] font-medium text-indigo-300 mb-1">
              Filtrar por Zona
            </label>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none"
            >
              <option value="ALL">
                Todas las Zonas ({uniqueZones.length})
              </option>
              {uniqueZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.id} — {z.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-emerald-300 mb-1">
              Filtrar por Cliente
            </label>
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">
                Todos los Clientes ({uniqueClients.length})
              </option>
              {uniqueClients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

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
              Búsqueda Rápida
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Producto, lote, cliente..."
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
              {(selectedProductFilter !== 'ALL' ||
                selectedDateFilter !== 'ALL' ||
                selectedLotFilter !== 'ALL' ||
                selectedZoneFilter !== 'ALL' ||
                selectedClientFilter !== 'ALL' ||
                causeFilter !== 'ALL' ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductFilter('ALL');
                    setSelectedDateFilter('ALL');
                    setSelectedLotFilter('ALL');
                    setSelectedZoneFilter('ALL');
                    setSelectedClientFilter('ALL');
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
                <tr className="border-b border-white/10 bg-slate-950 text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-4 text-slate-400" rowSpan={2}>
                    Producto
                  </th>
                  {showCalidadGroup && (
                    <th
                      colSpan={5}
                      className="py-1.5 px-2 text-center border-l border-r border-sky-500/25 bg-sky-950/35 text-sky-300 font-extrabold"
                    >
                      CALIDAD (Producción) — Vacío · Lechosidad · X Fecha · Embombamiento
                    </th>
                  )}
                  {showComercialGroup && (
                    <th
                      colSpan={4}
                      className="py-1.5 px-2 text-center border-l border-r border-amber-500/25 bg-amber-950/35 text-amber-300 font-extrabold"
                    >
                      COMERCIAL (Ventas) — Próximo · Vencido · X Cobrar
                    </th>
                  )}
                  <th className="py-2 px-3 text-right text-emerald-300 font-extrabold" rowSpan={2}>
                    Total Dev. (Filtrado)
                  </th>
                  <th className="py-2 px-3 text-slate-300" rowSpan={2}>
                    Lotes Afectados (Mismos del Semáforo)
                  </th>
                </tr>
                <tr className="border-b border-white/10 bg-slate-900/95 text-[10px] uppercase tracking-wider text-slate-300">
                  {showCalidadGroup && (
                    <>
                      <th className="py-2 px-2 text-center border-l border-sky-500/20 text-sky-300">
                        Vacío
                      </th>
                      <th className="py-2 px-2 text-center text-violet-300">
                        Lechosidad
                      </th>
                      <th className="py-2 px-2 text-center text-cyan-300">
                        X Fecha
                      </th>
                      <th className="py-2 px-2 text-center text-fuchsia-300">
                        Embomb.
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-sky-500/20 text-sky-200 font-bold">
                        Total Calidad
                      </th>
                    </>
                  )}
                  {showComercialGroup && (
                    <>
                      <th className="py-2 px-2 text-center border-l border-amber-500/20 text-amber-300">
                        Próximo
                      </th>
                      <th className="py-2 px-2 text-center text-orange-300">
                        Vencido
                      </th>
                      <th className="py-2 px-2 text-center text-rose-300">
                        X Cobrar
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-amber-500/20 text-amber-200 font-bold">
                        Total Comercial
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {productMatrix.map((prod) => {
                  const topLots = Array.from(prod.lotsMap.values())
                    .filter((l) => l.totalUnits > 0)
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

                      {showCalidadGroup && (
                        <>
                          {/* CALIDAD: Vacío */}
                          <td className="py-2.5 px-2 text-center font-mono border-l border-sky-500/10">
                            {prod.causes.vacio > 0 ? (
                              <span className="inline-block rounded-md bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 font-bold text-sky-300">
                                {prod.causes.vacio}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* CALIDAD: Lechosidad */}
                          <td className="py-2.5 px-2 text-center font-mono">
                            {prod.causes.lechozo > 0 ? (
                              <span className="inline-block rounded-md bg-violet-500/20 border border-violet-500/40 px-2 py-0.5 font-bold text-violet-300">
                                {prod.causes.lechozo}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* CALIDAD: X Fecha */}
                          <td className="py-2.5 px-2 text-center font-mono">
                            {prod.causes.xFecha > 0 ? (
                              <span className="inline-block rounded-md bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 font-bold text-cyan-300">
                                {prod.causes.xFecha}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* CALIDAD: Embombamiento */}
                          <td className="py-2.5 px-2 text-center font-mono">
                            {prod.causes.abomba > 0 ? (
                              <span className="inline-block rounded-md bg-fuchsia-500/20 border border-fuchsia-500/40 px-2 py-0.5 font-bold text-fuchsia-300">
                                {prod.causes.abomba}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* Subtotal CALIDAD */}
                          <td className="py-2.5 px-2.5 text-right font-mono border-r border-sky-500/10 bg-sky-950/15">
                            <div className="font-extrabold text-sky-300">
                              {formatNumber(prod.qualityUnits)} und
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatCOP(prod.qualityCOP)}
                            </div>
                          </td>
                        </>
                      )}

                      {showComercialGroup && (
                        <>
                          {/* COMERCIAL: Próximo */}
                          <td className="py-2.5 px-2 text-center font-mono border-l border-amber-500/10">
                            {prod.causes.proxVencer > 0 ? (
                              <span className="inline-block rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-semibold text-amber-300">
                                {prod.causes.proxVencer}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* COMERCIAL: Vencido */}
                          <td className="py-2.5 px-2 text-center font-mono">
                            {prod.causes.vencido > 0 ? (
                              <span className="inline-block rounded-md bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 font-semibold text-orange-300">
                                {prod.causes.vencido}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* COMERCIAL: X Cobrar */}
                          <td className="py-2.5 px-2 text-center font-mono">
                            {prod.causes.aCobrar > 0 ? (
                              <span className="inline-block rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-semibold text-rose-300">
                                {prod.causes.aCobrar}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* Subtotal COMERCIAL */}
                          <td className="py-2.5 px-2.5 text-right font-mono border-r border-amber-500/10 bg-amber-950/15">
                            <div className="font-extrabold text-amber-300">
                              {formatNumber(prod.commercialUnits)} und
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatCOP(prod.commercialCOP)}
                            </div>
                          </td>
                        </>
                      )}

                      {/* TOTAL DEVUELTO (Solo lo filtrado) */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-extrabold text-white">
                          {formatNumber(prod.totalUnits)} und
                        </div>
                        <div className="text-[10px] text-emerald-300 font-semibold">
                          {formatCOP(prod.totalCOP)}
                        </div>
                      </td>

                      {/* LOTES AFECTADOS */}
                      <td
                        className="py-2.5 px-3"
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
                {filteredRows.slice(0, detailLimit).map((row) => {
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
          {filteredRows.length > detailLimit && (
            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-slate-950 px-4 py-3 text-xs">
              <span className="text-slate-300">
                Mostrando <strong>{Math.min(detailLimit, filteredRows.length)}</strong> de{' '}
                <strong>{filteredRows.length}</strong> registros
              </span>
              <button
                type="button"
                onClick={() => setDetailLimit((prev) => prev + 150)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 font-semibold text-white transition-colors"
              >
                Cargar 150 más
              </button>
              <button
                type="button"
                onClick={() => setDetailLimit(filteredRows.length)}
                className="rounded-xl border border-white/15 bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 font-medium text-slate-200 transition-colors"
              >
                Ver todos ({filteredRows.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
