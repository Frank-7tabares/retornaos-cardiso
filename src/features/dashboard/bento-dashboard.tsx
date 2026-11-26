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
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [dashZoneFilter, setDashZoneFilter] = useState<string>('ALL');
  const [dashClientFilter, setDashClientFilter] = useState<string>('ALL');
  const [dashProductFilter, setDashProductFilter] = useState<string>('ALL');
  const [dashLotFilter, setDashLotFilter] = useState<string>('ALL');
  const [dashCauseFilter, setDashCauseFilter] = useState<
    'ALL' | 'COMERCIAL' | 'CALIDAD' | ReturnCauseKey
  >('ALL');
  const [matrixSortBy, setMatrixSortBy] = useState<
    'CODE_ASC' | 'SALES_DESC' | 'SALES_ASC' | 'TOTAL_DEV_DESC' | 'PCT_DESC' | 'COMM_DESC' | 'QUAL_DESC'
  >('CODE_ASC');
  const [salesRankingOrder, setSalesRankingOrder] = useState<'DESC' | 'ASC'>('DESC');
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
  const {
    availableDatesChronological,
    availableDates,
    minDate,
    maxDate,
    secondToLastDate,
  } = useMemo(() => {
    const set = new Set<string>();
    for (const r of returnRows) {
      if (r.date) set.add(r.date);
    }
    const sorted = Array.from(set).sort();
    const minD = sorted[0] || '2026-11-01';
    const maxD = sorted[sorted.length - 1] || '2026-11-05';
    const prevD = sorted.length >= 2 ? sorted[sorted.length - 2] : maxD;
    return {
      availableDatesChronological: sorted,
      availableDates: [...sorted].reverse(),
      minDate: minD,
      maxDate: maxD,
      secondToLastDate: prevD,
    };
  }, [returnRows]);

  const effectiveDateFrom = dateFrom || minDate;
  const effectiveDateTo = dateTo || maxDate;
  const isDateRangeActive = Boolean(dateFrom || dateTo);

  // Listas de opciones únicas en todo el sistema para los filtros del Administrador
  const dashboardFilterOptions = useMemo(() => {
    const clientsMap = new Map<string, number>();
    const productsMap = new Map<string, number>();
    const lotsMap = new Map<string, number>();

    for (const r of returnRows) {
      if (dateFrom && r.date < dateFrom) continue;
      if (dateTo && r.date > dateTo) continue;
      if (dashZoneFilter !== 'ALL' && r.zoneId !== dashZoneFilter) continue;

      const cName = (r.clientName || '').trim();
      if (cName) clientsMap.set(cName, (clientsMap.get(cName) || 0) + r.qtyToReceive);

      const pName = (r.productName || '').trim();
      if (pName) productsMap.set(pName, (productsMap.get(pName) || 0) + r.qtyToReceive);

      const lNum = (r.lotNumber || '').trim();
      if (lNum && lNum !== 'S/L') lotsMap.set(lNum, (lotsMap.get(lNum) || 0) + r.qtyToReceive);
    }

    return {
      clients: Array.from(clientsMap.entries())
        .map(([name, units]) => ({ name, units }))
        .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name)),
      products: Array.from(productsMap.entries())
        .map(([name, units]) => ({ name, units }))
        .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name)),
      lots: Array.from(lotsMap.entries())
        .map(([lot, units]) => ({ lot, units }))
        .sort((a, b) => b.units - a.units),
    };
  }, [returnRows, dateFrom, dateTo, dashZoneFilter]);

  const hasAnyAdminFilter = Boolean(
    dateFrom ||
      dateTo ||
      dashZoneFilter !== 'ALL' ||
      dashClientFilter !== 'ALL' ||
      dashProductFilter !== 'ALL' ||
      dashLotFilter !== 'ALL' ||
      dashCauseFilter !== 'ALL' ||
      channelFilter !== 'ALL' ||
      searchQuery.trim()
  );

  // Filas filtradas por todos los filtros activos del panel del Administrador (Sebastián)
  const dateFilteredRows = useMemo(() => {
    return returnRows.filter((r) => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (dashZoneFilter !== 'ALL' && r.zoneId !== dashZoneFilter) return false;
      if (dashClientFilter !== 'ALL' && r.clientName.trim() !== dashClientFilter)
        return false;
      if (dashProductFilter !== 'ALL' && r.productName.trim() !== dashProductFilter)
        return false;
      if (dashLotFilter !== 'ALL' && r.lotNumber !== dashLotFilter) return false;
      if (dashCauseFilter === 'COMERCIAL') {
        if (r.causes.proxVencer + r.causes.vencido + r.causes.aCobrar <= 0)
          return false;
      } else if (dashCauseFilter === 'CALIDAD') {
        if (
          r.causes.vacio +
            r.causes.lechozo +
            r.causes.xFecha +
            r.causes.abomba <=
          0
        )
          return false;
      } else if (dashCauseFilter !== 'ALL') {
        if ((r.causes[dashCauseFilter] || 0) <= 0) return false;
      }
      return true;
    });
  }, [
    returnRows,
    dateFrom,
    dateTo,
    dashZoneFilter,
    dashClientFilter,
    dashProductFilter,
    dashLotFilter,
    dashCauseFilter,
  ]);

  const isAdminCauseAllowed = (k: ReturnCauseKey): boolean => {
    if (dashCauseFilter === 'ALL') return true;
    if (dashCauseFilter === 'COMERCIAL') {
      return k === 'proxVencer' || k === 'vencido' || k === 'aCobrar';
    }
    if (dashCauseFilter === 'CALIDAD') {
      return (
        k === 'vacio' ||
        k === 'lechozo' ||
        k === 'xFecha' ||
        k === 'abomba'
      );
    }
    return dashCauseFilter === k;
  };

  const showAdminComercialCols =
    dashCauseFilter === 'ALL' ||
    dashCauseFilter === 'COMERCIAL' ||
    dashCauseFilter === 'proxVencer' ||
    dashCauseFilter === 'vencido' ||
    dashCauseFilter === 'aCobrar';

  const showAdminCalidadCols =
    dashCauseFilter === 'ALL' ||
    dashCauseFilter === 'CALIDAD' ||
    dashCauseFilter === 'vacio' ||
    dashCauseFilter === 'lechozo' ||
    dashCauseFilter === 'xFecha' ||
    dashCauseFilter === 'abomba';

  const enrichedZones = useMemo(() => {
    const activeZones = zones.filter((z) => z.id !== 'Z15');
    return activeZones.map((z) => {
      const cleanZoneLabel =
        z.type === 'RUTA_VENDEDOR'
          ? `ZONA ${z.code}`
          : z.consolidatedName;
      const normalizedBase: ZoneSummary = {
        ...z,
        consolidatedName: cleanZoneLabel,
        sheetName: cleanZoneLabel,
        currentSeller: cleanZoneLabel,
      };

      if (returnRows.length === 0) {
        return computeZoneMetrics(normalizedBase);
      }
      const zRows = dateFilteredRows.filter((r) => r.zoneId === z.id);
      const customZone: ZoneSummary = {
        ...normalizedBase,
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
        if (isAdminCauseAllowed('aCobrar')) {
          customZone.unitsByCause.aCobrar += r.causes.aCobrar;
          customZone.copByCause.aCobrar += r.copByCause.aCobrar;
        }
        if (isAdminCauseAllowed('proxVencer')) {
          customZone.unitsByCause.proxVencer += r.causes.proxVencer;
          customZone.copByCause.proxVencer += r.copByCause.proxVencer;
        }
        if (isAdminCauseAllowed('vencido')) {
          customZone.unitsByCause.vencido += r.causes.vencido;
          customZone.copByCause.vencido += r.copByCause.vencido;
        }
        if (isAdminCauseAllowed('vacio')) {
          customZone.unitsByCause.vacio += r.causes.vacio;
          customZone.copByCause.vacio += r.copByCause.vacio;
        }
        if (isAdminCauseAllowed('lechozo')) {
          customZone.unitsByCause.lechozo += r.causes.lechozo;
          customZone.copByCause.lechozo += r.copByCause.lechozo;
        }
        if (isAdminCauseAllowed('xFecha')) {
          customZone.unitsByCause.xFecha += r.causes.xFecha;
          customZone.copByCause.xFecha += r.copByCause.xFecha;
        }
        if (isAdminCauseAllowed('abomba')) {
          customZone.unitsByCause.abomba += r.causes.abomba;
          customZone.copByCause.abomba += r.copByCause.abomba;
        }
      }
      return computeZoneMetrics(customZone);
    });
  }, [zones, dateFilteredRows, isDateRangeActive, dashCauseFilter]);

  const filteredZones = useMemo(() => {
    const base = enrichedZones.filter((z) => {
      if (channelFilter !== 'ALL' && z.type !== channelFilter) return false;
      if (dashZoneFilter !== 'ALL' && z.id !== dashZoneFilter) return false;
      if (
        (dashClientFilter !== 'ALL' ||
          dashProductFilter !== 'ALL' ||
          dashLotFilter !== 'ALL' ||
          dashCauseFilter !== 'ALL') &&
        z.lineItemsCount === 0
      ) {
        return false;
      }
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

    return [...base].sort((a, b) => {
      if (matrixSortBy === 'SALES_DESC')
        return b.monthlySalesCOP - a.monthlySalesCOP;
      if (matrixSortBy === 'SALES_ASC')
        return a.monthlySalesCOP - b.monthlySalesCOP;
      if (matrixSortBy === 'TOTAL_DEV_DESC') return b.totalCOP - a.totalCOP;
      if (matrixSortBy === 'PCT_DESC')
        return b.pctTotalOverSales - a.pctTotalOverSales;
      if (matrixSortBy === 'COMM_DESC')
        return b.commercialCOP - a.commercialCOP;
      if (matrixSortBy === 'QUAL_DESC') return b.qualityCOP - a.qualityCOP;
      return a.code.localeCompare(b.code);
    });
  }, [
    enrichedZones,
    channelFilter,
    dashZoneFilter,
    dashClientFilter,
    dashProductFilter,
    dashLotFilter,
    dashCauseFilter,
    searchQuery,
    matrixSortBy,
  ]);

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
        vacioUnits: number;
        lechozoUnits: number;
        xFechaUnits: number;
        abombaUnits: number;
        proxVencerOnlyUnits: number;
        vencidoUnits: number;
        aCobrarUnits: number;
        proxVencerUnits: number;
        lots: Set<string>;
        zones: Set<string>;
      }
    >();

    const effectiveCategory =
      dashCauseFilter === 'COMERCIAL' ||
      dashCauseFilter === 'proxVencer' ||
      dashCauseFilter === 'vencido' ||
      dashCauseFilter === 'aCobrar'
        ? 'COMERCIAL'
        : dashCauseFilter === 'CALIDAD' ||
          dashCauseFilter === 'vacio' ||
          dashCauseFilter === 'lechozo' ||
          dashCauseFilter === 'xFecha' ||
          dashCauseFilter === 'abomba'
        ? 'CALIDAD'
        : escalafonCategory;

    for (const r of dateFilteredRows) {
      const mProx =
        effectiveCategory !== 'CALIDAD' && isAdminCauseAllowed('proxVencer')
          ? r.causes.proxVencer
          : 0;
      const mVenc =
        effectiveCategory !== 'CALIDAD' && isAdminCauseAllowed('vencido')
          ? r.causes.vencido
          : 0;
      const mCobrar =
        effectiveCategory !== 'CALIDAD' && isAdminCauseAllowed('aCobrar')
          ? r.causes.aCobrar
          : 0;

      const mVacio =
        effectiveCategory !== 'COMERCIAL' && isAdminCauseAllowed('vacio')
          ? r.causes.vacio
          : 0;
      const mLechozo =
        effectiveCategory !== 'COMERCIAL' && isAdminCauseAllowed('lechozo')
          ? r.causes.lechozo
          : 0;
      const mXFecha =
        effectiveCategory !== 'COMERCIAL' && isAdminCauseAllowed('xFecha')
          ? r.causes.xFecha
          : 0;
      const mAbomba =
        effectiveCategory !== 'COMERCIAL' && isAdminCauseAllowed('abomba')
          ? r.causes.abomba
          : 0;

      // COMERCIAL (Ventas): próximo + vencido + x cobrar
      const cUnits = mProx + mVenc + mCobrar;
      const cCOP =
        (mProx > 0 ? r.copByCause.proxVencer : 0) +
        (mVenc > 0 ? r.copByCause.vencido : 0) +
        (mCobrar > 0 ? r.copByCause.aCobrar : 0);

      // CALIDAD (Producción): vacío + lechosidad + x fecha + embombamiento
      const qUnits = mVacio + mLechozo + mXFecha + mAbomba;
      const qCOP =
        (mVacio > 0 ? r.copByCause.vacio : 0) +
        (mLechozo > 0 ? r.copByCause.lechozo : 0) +
        (mXFecha > 0 ? r.copByCause.xFecha : 0) +
        (mAbomba > 0 ? r.copByCause.abomba : 0);

      const classifiedTotal = cUnits + qUnits;
      if (classifiedTotal <= 0) continue;

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
          vacioUnits: 0,
          lechozoUnits: 0,
          xFechaUnits: 0,
          abombaUnits: 0,
          proxVencerOnlyUnits: 0,
          vencidoUnits: 0,
          aCobrarUnits: 0,
          proxVencerUnits: 0,
          lots: new Set<string>(),
          zones: new Set<string>(),
        };
        map.set(key, item);
      }

      item.totalUnits += classifiedTotal;
      item.totalCOP += cCOP + qCOP;
      item.commercialUnits += cUnits;
      item.commercialCOP += cCOP;
      item.qualityUnits += qUnits;
      item.qualityCOP += qCOP;
      item.vacioUnits += mVacio;
      item.lechozoUnits += mLechozo;
      item.xFechaUnits += mXFecha;
      item.abombaUnits += mAbomba;
      item.proxVencerOnlyUnits += mProx;
      item.vencidoUnits += mVenc;
      item.aCobrarUnits += mCobrar;
      item.proxVencerUnits += mProx + mVenc;
      if (r.lotNumber && r.lotNumber !== 'S/L') item.lots.add(r.lotNumber);
      item.zones.add(r.zoneId);
    }

    let list = Array.from(map.values()).filter((p) => p.totalUnits > 0);
    if (effectiveCategory === 'COMERCIAL') {
      list = list.filter((p) => p.commercialUnits > 0);
    } else if (effectiveCategory === 'CALIDAD') {
      list = list.filter((p) => p.qualityUnits > 0);
    }

    const sorted = [...list].sort((a, b) => {
      const valA =
        effectiveCategory === 'COMERCIAL'
          ? a.commercialUnits
          : effectiveCategory === 'CALIDAD'
          ? a.qualityUnits
          : a.totalUnits;
      const valB =
        effectiveCategory === 'COMERCIAL'
          ? b.commercialUnits
          : effectiveCategory === 'CALIDAD'
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

    const qualityRankedList = [...allList]
      .filter((p) => p.qualityUnits > 0)
      .sort((a, b) => b.qualityUnits - a.qualityUnits || b.qualityCOP - a.qualityCOP);

    const commercialRankedList = [...allList]
      .filter((p) => p.commercialUnits > 0)
      .sort((a, b) => b.commercialUnits - a.commercialUnits || b.commercialCOP - a.commercialCOP);

    return {
      sorted,
      topLechozo,
      topVacio,
      topCommercial,
      qualityRankedList,
      commercialRankedList,
      effectiveCategory,
    };
  }, [dateFilteredRows, escalafonOrder, escalafonCategory, dashCauseFilter]);

  // Ranking completo de TODAS las zonas según sus ventas mensuales (de mayor a menor o menor a mayor)
  const zoneSalesRanking = useMemo(() => {
    const rutas = enrichedZones.filter((z) => z.monthlySalesCOP > 0);
    const bySalesDesc = [...rutas].sort(
      (a, b) => b.monthlySalesCOP - a.monthlySalesCOP
    );
    const orderedAll =
      salesRankingOrder === 'DESC'
        ? bySalesDesc
        : [...bySalesDesc].reverse();
    const maxSales = bySalesDesc[0]?.monthlySalesCOP || 1;
    return {
      topZone: bySalesDesc[0] || null,
      bottomZone: bySalesDesc[bySalesDesc.length - 1] || null,
      allZonesRanked: orderedAll,
      maxSales,
    };
  }, [enrichedZones, salesRankingOrder]);

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
                Rango activo: {effectiveDateFrom} al {effectiveDateTo} · Control por Zonas
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Centro de Control Gerencial por Zonas, Inventarios y Lotes
            </h1>
            <p className="text-xs sm:text-sm text-slate-200/95 leading-relaxed">
              Información actualizada hasta el <strong>{maxDate}</strong>. Filtra por <strong>Rango de Día a Día</strong> (ej. del 1 al 17 sin el 18), analiza el rendimiento por <strong>Zonas Oficiales (Z01–Z16)</strong> y consulta el <strong>Escalafón de Productos</strong> para bajar inventarios.
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

      {/* Barra de Corte de Fecha y Centro Completo de Filtros en la Pantalla del Administrador (Sebastián) */}
      <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-4 sm:px-5 space-y-3.5 shadow-lg">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-white">
                  Centro de Filtros Gerenciales (Sebastián) · Corte: {maxDate}
                </span>
                <span className="rounded-lg bg-emerald-500/25 border border-emerald-400/40 px-2.5 py-0.5 font-mono text-xs font-extrabold text-emerald-300">
                  Del {effectiveDateFrom} al {effectiveDateTo}
                </span>
                {dashZoneFilter !== 'ALL' && (
                  <Badge variant="indigo" dot>
                    Zona: {dashZoneFilter}
                  </Badge>
                )}
                {dashClientFilter !== 'ALL' && (
                  <Badge variant="success" dot>
                    Cliente: {dashClientFilter}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Filtra todo el sistema por <strong>Rango de Día a Día</strong>, <strong>Zona</strong>, <strong>Cliente</strong>, <strong>Producto</strong>, <strong>Lote</strong> o <strong>Causa</strong>. Todos los paneles y tablas se actualizan al instante.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/85 px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-emerald-300">
                Desde:
              </span>
              <select
                value={dateFrom || minDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateFrom(val);
                  if (dateTo && val > dateTo) setDateTo(val);
                }}
                className="bg-transparent font-mono text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {availableDatesChronological.map((d) => (
                  <option key={`dash-from-${d}`} value={d} className="bg-slate-900 text-white">
                    Día {d.slice(8, 10)} ({d})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom || minDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateFrom(val);
                  if (dateTo && val > dateTo) setDateTo(val);
                }}
                className="w-6 bg-transparent text-xs text-emerald-300 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/85 px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-amber-300">
                Hasta:
              </span>
              <select
                value={dateTo || maxDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateTo(val);
                  if (dateFrom && val < dateFrom) setDateFrom(val);
                }}
                className="bg-transparent font-mono text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {availableDatesChronological.map((d) => (
                  <option key={`dash-to-${d}`} value={d} className="bg-slate-900 text-white">
                    Día {d.slice(8, 10)} ({d})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateTo || maxDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateTo(val);
                  if (dateFrom && val < dateFrom) setDateFrom(val);
                }}
                className="w-6 bg-transparent text-xs text-amber-300 focus:outline-none cursor-pointer"
              />
            </div>

            {availableDatesChronological.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom(minDate);
                  setDateTo(secondToLastDate);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  dateFrom === minDate && dateTo === secondToLastDate
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                }`}
              >
                Sin el último día (Día {minDate.slice(8, 10)} al {secondToLastDate.slice(8, 10)})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                !isDateRangeActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800/90 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              Todos los Días ({availableDates.length})
            </button>

            {hasAnyAdminFilter && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setDashZoneFilter('ALL');
                  setDashClientFilter('ALL');
                  setDashProductFilter('ALL');
                  setDashLotFilter('ALL');
                  setDashCauseFilter('ALL');
                  setChannelFilter('ALL');
                  setSearchQuery('');
                }}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 px-3 py-1.5 text-xs font-bold text-rose-300 transition-all"
              >
                ✕ Limpiar Todos los Filtros
              </button>
            )}
          </div>
        </div>

        {/* Segunda fila de filtros gerenciales: Zona, Cliente, Producto, Lote y Causa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3 border-t border-white/10">
          {/* Filtro por Zona */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
              📍 Filtrar por Zona Comercial
            </label>
            <select
              value={dashZoneFilter}
              onChange={(e) => setDashZoneFilter(e.target.value)}
              className="w-full rounded-xl border border-indigo-500/35 bg-slate-950/90 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-indigo-400 focus:outline-none"
            >
              <option value="ALL">
                Todas las Zonas ({enrichedZones.length})
              </option>
              {enrichedZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} — {z.consolidatedName} ({formatCompactCOP(z.monthlySalesCOP)})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Cliente */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
              👤 Filtrar por Cliente / Sede
            </label>
            <select
              value={dashClientFilter}
              onChange={(e) => setDashClientFilter(e.target.value)}
              className="w-full rounded-xl border border-emerald-500/35 bg-slate-950/90 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">
                Todos los Clientes ({dashboardFilterOptions.clients.length})
              </option>
              {dashboardFilterOptions.clients.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.units} unds)
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Producto */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sky-300 mb-1">
              📦 Filtrar por Producto
            </label>
            <select
              value={dashProductFilter}
              onChange={(e) => setDashProductFilter(e.target.value)}
              className="w-full rounded-xl border border-sky-500/35 bg-slate-950/90 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-sky-400 focus:outline-none"
            >
              <option value="ALL">
                Todos los Productos ({dashboardFilterOptions.products.length})
              </option>
              {dashboardFilterOptions.products.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.units} unds)
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Lote */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-violet-300 mb-1">
              🏷️ Filtrar por N° de Lote
            </label>
            <select
              value={dashLotFilter}
              onChange={(e) => setDashLotFilter(e.target.value)}
              className="w-full rounded-xl border border-violet-500/35 bg-slate-950/90 px-2.5 py-1.5 font-mono text-xs font-semibold text-white focus:border-violet-400 focus:outline-none"
            >
              <option value="ALL">
                Todos los Lotes ({dashboardFilterOptions.lots.length})
              </option>
              {dashboardFilterOptions.lots.map((l) => (
                <option key={l.lot} value={l.lot}>
                  Lote #{l.lot} ({l.units} unds)
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Causa / Responsabilidad */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1">
              🔬 Filtrar por Causa / Área
            </label>
            <select
              value={dashCauseFilter}
              onChange={(e) =>
                setDashCauseFilter(
                  e.target.value as
                    | 'ALL'
                    | 'COMERCIAL'
                    | 'CALIDAD'
                    | ReturnCauseKey
                )
              }
              className="w-full rounded-xl border border-amber-500/35 bg-slate-950/90 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-amber-400 focus:outline-none"
            >
              <option value="ALL">Todas las Causas (Comercial + Calidad)</option>
              <option value="COMERCIAL">🟠 Solo Comercial (Próx. + Vencido + Cobrar)</option>
              <option value="CALIDAD">🔵 Solo Calidad (Vacío + Lechoso + Fecha + Emb.)</option>
              {CAUSE_METADATA.map((c) => (
                <option key={c.key} value={c.key}>
                  • {c.fullLabel} ({c.responsibility})
                </option>
              ))}
            </select>
          </div>
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
            { id: 'ALL', label: ' Todas las Zonas (23)' },
            { id: 'RUTA_VENDEDOR', label: 'Zonas Z01–Z16 (14)' },
            { id: 'CLIENTE_ESPECIAL_Z14', label: 'Zonas Z14 (4)' },
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
        <BentoCard interactive className="group flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-neutral-600 dark:text-slate-300">
                Costo Total Devoluciones
              </span>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white font-mono">
                {formatCOP(totals.totalCOP)}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-500 dark:text-indigo-300">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300 truncate">
              Sobre Ventas ({formatCompactCOP(totals.salesCOP)})
            </span>
            <Badge
              variant={totals.pctTotalOverSales > 6 ? 'warning' : 'indigo'}
              dot
              className="shrink-0 whitespace-nowrap"
            >
              {formatPercent(totals.pctTotalOverSales)} del mes
            </Badge>
          </div>
        </BentoCard>

        <BentoCard interactive className="flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                  Resp. Comercial
                </span>
                <TooltipHint label="Suma: Por Cobrar + Próximo a Vencer + Vencido">
                  <Badge variant="commercial" className="whitespace-nowrap">
                    Comercial
                  </Badge>
                </TooltipHint>
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-300 font-mono">
                {formatCOP(totals.commercialCOP)}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500 dark:text-amber-300">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300 truncate">
              {formatNumber(totals.commercialUnits)} unds (PR/V, Cobrar, Venc.)
            </span>
            <span className="shrink-0 whitespace-nowrap font-semibold text-amber-600 dark:text-amber-300">
              {formatPercent(totals.pctCommShare, 1)} del total
            </span>
          </div>
        </BentoCard>

        <BentoCard interactive className="flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-neutral-600 dark:text-slate-300">
                  Resp. Calidad
                </span>
                <TooltipHint label="Suma: Vacío + Por Fecha + Abombamiento + Lechoso">
                  <Badge variant="quality" className="whitespace-nowrap">
                    Planta / Calidad
                  </Badge>
                </TooltipHint>
              </div>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-300 font-mono">
                {formatCOP(totals.qualityCOP)}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-500 dark:text-sky-300">
              <FlaskConical className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300 truncate">
              {formatNumber(totals.qualityUnits)} unds (Lechoso, Vacío, Fecha)
            </span>
            <span className="shrink-0 whitespace-nowrap font-semibold text-sky-600 dark:text-sky-300">
              {formatPercent(totals.pctQualShare, 1)} del total
            </span>
          </div>
        </BentoCard>

        <BentoCard
          interactive
          onClick={() => onSelectZone('PDV-SABANETA')}
          className="flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-neutral-600 dark:text-slate-300">
                Unidades & Auditoría Cuadre
              </span>
              <div className="mt-2.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white font-mono">
                {formatNumber(totals.totalUnits)}{' '}
                <span className="text-sm font-normal text-neutral-500 dark:text-slate-400">
                  unds
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-200/60 dark:border-white/10 pt-3 text-xs">
            <span className="text-neutral-600 dark:text-slate-300 truncate">
              {formatNumber(totals.lineItems)} registros procesados
            </span>
            {unconciledCount > 0 ? (
              <Badge variant="warning" dot className="shrink-0 whitespace-nowrap">
                {unconciledCount} por REVISAR
              </Badge>
            ) : (
              <Badge variant="success" dot className="shrink-0 whitespace-nowrap">
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
        <div className="border-b border-neutral-200/70 dark:border-white/10 bg-slate-950/50 p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <PackageCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                  Escalafón de Productos Devueltos por Calidad y Comercial ({escalafonOrder === 'ASC' ? 'De Menor a Mayor ↑' : 'De Mayor a Menor ↓'})
                </h2>
                <Badge variant="success" dot className="whitespace-nowrap">
                  Rango: {effectiveDateFrom} al {effectiveDateTo}
                </Badge>
              </div>
              <p className="text-xs text-neutral-600 dark:text-slate-300">
                Calidad (Lechosidad, Vacío) y Comercial (Próx. a Vencer, A Cobrar) para ajustar inventarios y planta.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-white/[0.06]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-white/15 bg-slate-900 p-1">
                  <button
                    type="button"
                    onClick={() => setEscalafonOrder('ASC')}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
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
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
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
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                        escalafonCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {onOpenExecutiveReport && (
                <button
                  type="button"
                  onClick={onOpenExecutiveReport}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Abrir Informe Detallado con Logo
                </button>
              )}
            </div>
          </div>

          {/* 3 Tarjetas de Resumen Rápido: Ranking Completo de Todas las Zonas por Ventas, Críticos Lechosidad/Vacío y Comercial */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/95 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 shrink-0" />
                  Ranking Ventas por Zona ({zoneSalesRanking.allZonesRanked.length} Zonas)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSalesRankingOrder((prev) =>
                      prev === 'DESC' ? 'ASC' : 'DESC'
                    )
                  }
                  className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-300 transition-colors shrink-0"
                  title="Cambiar orden de Mayor a Menor / Menor a Mayor"
                >
                  {salesRankingOrder === 'DESC' ? 'Mayor → Menor ↓' : 'Menor → Mayor ↑'}
                </button>
              </div>

              {/* Lista completa desplazable de TODAS las zonas con sus ventas y porcentaje de devolución */}
              <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 divide-y divide-white/[0.06]">
                {zoneSalesRanking.allZonesRanked.map((z, index) => {
                  const rankNum =
                    salesRankingOrder === 'DESC'
                      ? index + 1
                      : zoneSalesRanking.allZonesRanked.length - index;
                  const barPct = Math.max(
                    6,
                    Math.round((z.monthlySalesCOP / zoneSalesRanking.maxSales) * 100)
                  );
                  const isSelectedZone = dashZoneFilter === z.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() =>
                        setDashZoneFilter((prev) => (prev === z.id ? 'ALL' : z.id))
                      }
                      className={`w-full text-left pt-1.5 first:pt-0 rounded-lg px-1.5 py-1 transition-colors ${
                        isSelectedZone
                          ? 'bg-emerald-500/20 ring-1 ring-emerald-400'
                          : 'hover:bg-white/[0.05]'
                      }`}
                      title={`Clic para filtrar todo el dashboard por ${z.consolidatedName}`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-200 truncate font-medium">
                          <span className="font-mono text-[10px] font-bold text-emerald-400 mr-1.5">
                            #{rankNum}
                          </span>
                          {z.consolidatedName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="font-mono font-bold text-emerald-300">
                            {formatCompactCOP(z.monthlySalesCOP)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ({formatPercent(z.pctTotalOverSales)} dev)
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-500/30 bg-slate-900/95 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                <span className="flex items-center gap-1">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                  ¿Cuál Devuelven Más por Lechosidad y Vacío? ({productEscalafonData.qualityRankedList.length} Prod.)
                </span>
                <span className="text-[10px] text-sky-300 shrink-0">Planta</span>
              </div>

              {productEscalafonData.qualityRankedList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Sin productos de Calidad para el filtro actual
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 divide-y divide-white/[0.06]">
                  {productEscalafonData.qualityRankedList.map((prod, idx) => {
                    const maxQ =
                      productEscalafonData.qualityRankedList[0]?.qualityUnits || 1;
                    const lechPct = Math.round(
                      (prod.lechozoUnits / maxQ) * 100
                    );
                    const vacPct = Math.round(
                      ((prod.vacioUnits + prod.xFechaUnits + prod.abombaUnits) /
                        maxQ) *
                        100
                    );
                    const isSelectedProd = dashProductFilter === prod.productName;
                    return (
                      <button
                        key={`qual-rank-${prod.productName}`}
                        type="button"
                        onClick={() =>
                          setDashProductFilter((prev) =>
                            prev === prod.productName ? 'ALL' : prod.productName
                          )
                        }
                        className={`w-full text-left pt-1.5 first:pt-0 rounded-lg px-1.5 py-1 transition-colors ${
                          isSelectedProd
                            ? 'bg-sky-500/20 ring-1 ring-sky-400'
                            : 'hover:bg-white/[0.05]'
                        }`}
                        title={`Clic para filtrar todo el dashboard por ${prod.productName}`}
                      >
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="text-slate-200 truncate font-medium">
                            <span className="font-mono text-[10px] font-bold text-sky-400 mr-1.5">
                              #{idx + 1}
                            </span>
                            {prod.productName}
                          </span>
                          <span className="font-mono font-bold text-sky-300 shrink-0">
                            {formatNumber(prod.qualityUnits)} unds
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-300">
                          <div className="flex items-center gap-2">
                            {prod.lechozoUnits > 0 && (
                              <span className="text-violet-300">
                                🥛 Lech: <strong>{prod.lechozoUnits}</strong>
                              </span>
                            )}
                            {prod.vacioUnits > 0 && (
                              <span className="text-sky-300">
                                📦 Vacío: <strong>{prod.vacioUnits}</strong>
                              </span>
                            )}
                            {prod.xFechaUnits > 0 && (
                              <span className="text-cyan-300">
                                📅 Fecha: <strong>{prod.xFechaUnits}</strong>
                              </span>
                            )}
                            {prod.abombaUnits > 0 && (
                              <span className="text-fuchsia-300">
                                💥 Emb: <strong>{prod.abombaUnits}</strong>
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400">
                            {formatCOP(prod.qualityCOP)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                          {prod.lechozoUnits > 0 && (
                            <div
                              className="h-full bg-violet-500"
                              style={{ width: `${Math.max(4, lechPct)}%` }}
                            />
                          )}
                          {prod.vacioUnits + prod.xFechaUnits + prod.abombaUnits >
                            0 && (
                            <div
                              className="h-full bg-sky-400"
                              style={{ width: `${Math.max(4, vacPct)}%` }}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/95 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  Control de Inventarios Comercial ({productEscalafonData.commercialRankedList.length} Prod.)
                </span>
                <span className="text-[10px] text-amber-300 shrink-0">Rotación</span>
              </div>

              {productEscalafonData.commercialRankedList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Sin productos Comerciales para el filtro actual
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 divide-y divide-white/[0.06]">
                  {productEscalafonData.commercialRankedList.map((prod, idx) => {
                    const maxC =
                      productEscalafonData.commercialRankedList[0]
                        ?.commercialUnits || 1;
                    const barPct = Math.max(
                      6,
                      Math.round((prod.commercialUnits / maxC) * 100)
                    );
                    const isSelectedProd = dashProductFilter === prod.productName;
                    return (
                      <button
                        key={`comm-rank-${prod.productName}`}
                        type="button"
                        onClick={() =>
                          setDashProductFilter((prev) =>
                            prev === prod.productName ? 'ALL' : prod.productName
                          )
                        }
                        className={`w-full text-left pt-1.5 first:pt-0 rounded-lg px-1.5 py-1 transition-colors ${
                          isSelectedProd
                            ? 'bg-amber-500/20 ring-1 ring-amber-400'
                            : 'hover:bg-white/[0.05]'
                        }`}
                        title={`Clic para filtrar todo el dashboard por ${prod.productName}`}
                      >
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="text-slate-200 truncate font-medium">
                            <span className="font-mono text-[10px] font-bold text-amber-400 mr-1.5">
                              #{idx + 1}
                            </span>
                            {prod.productName}
                          </span>
                          <span className="font-mono font-bold text-amber-300 shrink-0">
                            {formatNumber(prod.commercialUnits)} unds
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-300">
                          <div className="flex items-center gap-2">
                            {prod.proxVencerOnlyUnits > 0 && (
                              <span className="text-amber-300">
                                ⚠️ Próx: <strong>{prod.proxVencerOnlyUnits}</strong>
                              </span>
                            )}
                            {prod.vencidoUnits > 0 && (
                              <span className="text-orange-300">
                                ⏰ Venc: <strong>{prod.vencidoUnits}</strong>
                              </span>
                            )}
                            {prod.aCobrarUnits > 0 && (
                              <span className="text-rose-300">
                                💲 Cobrar: <strong>{prod.aCobrarUnits}</strong>
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400">
                            {formatCOP(prod.commercialCOP)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla del Escalafón de Productos (De Menor a Mayor / Mayor a Menor) */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/70 dark:border-white/10 bg-neutral-100/70 dark:bg-slate-950/70 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-slate-300">
                <th className="py-2.5 pl-4 pr-2">#</th>
                <th className="px-2.5 py-2.5">Producto / Referencia</th>
                {(productEscalafonData.effectiveCategory === 'ALL' ||
                  productEscalafonData.effectiveCategory === 'COMERCIAL') && (
                  <>
                    <th className="px-2 py-2.5 text-center text-amber-300" title="Próximo a Vencer">Próx.</th>
                    <th className="px-2 py-2.5 text-center text-orange-300" title="Vencido">Venc.</th>
                    <th className="px-2 py-2.5 text-center text-rose-300" title="X Cobrar">Cobrar</th>
                    <th className="px-2.5 py-2.5 text-right text-amber-600 dark:text-amber-300 font-bold">
                      Total Comercial
                    </th>
                  </>
                )}
                {(productEscalafonData.effectiveCategory === 'ALL' ||
                  productEscalafonData.effectiveCategory === 'CALIDAD') && (
                  <>
                    <th className="px-2 py-2.5 text-center text-sky-300" title="Vacío">Vacío</th>
                    <th className="px-2 py-2.5 text-center text-violet-300" title="Lechosidad">Lechos.</th>
                    <th className="px-2 py-2.5 text-center text-cyan-300" title="X Fecha">X Fecha</th>
                    <th className="px-2 py-2.5 text-center text-fuchsia-300" title="Embombamiento">Embomb.</th>
                    <th className="px-2.5 py-2.5 text-right text-sky-600 dark:text-sky-300 font-bold">
                      Total Calidad
                    </th>
                  </>
                )}
                <th className="px-2.5 py-2.5 text-right font-extrabold">
                  Total Dev. {productEscalafonData.effectiveCategory !== 'ALL' ? `(${productEscalafonData.effectiveCategory})` : ''}
                </th>
                <th className="py-2.5 pl-2.5 pr-4">Acción Correctiva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-white/[0.07] text-xs">
              {productEscalafonData.sorted.map((prod, idx) => {
                const displayTotalUnits =
                  productEscalafonData.effectiveCategory === 'COMERCIAL'
                    ? prod.commercialUnits
                    : productEscalafonData.effectiveCategory === 'CALIDAD'
                    ? prod.qualityUnits
                    : prod.totalUnits;
                const displayTotalCOP =
                  productEscalafonData.effectiveCategory === 'COMERCIAL'
                    ? prod.commercialCOP
                    : productEscalafonData.effectiveCategory === 'CALIDAD'
                    ? prod.qualityCOP
                    : prod.totalCOP;

                const actionLabel =
                  productEscalafonData.effectiveCategory === 'COMERCIAL' ||
                  prod.commercialUnits > prod.qualityUnits
                    ? '📉 Bajar inventario en ruta'
                    : prod.lechozoUnits >= prod.vacioUnits && prod.lechozoUnits > 0
                    ? '🔬 Controlar Lechosidad'
                    : prod.vacioUnits > 0
                    ? '🛡️ Auditar Sellado Vacío'
                    : '✅ Rotación estable';

                return (
                  <tr
                    key={prod.productName}
                    className="hover:bg-indigo-500/10 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <td className="py-2 pl-4 pr-2 font-mono font-bold text-indigo-400">
                      #{idx + 1}
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {prod.productName}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 dark:text-slate-400">
                        {prod.zones.size} zona(s) · Lotes:{' '}
                        {Array.from(prod.lots).slice(0, 4).join(', ') || 'S/L'}
                      </div>
                    </td>
                    {(productEscalafonData.effectiveCategory === 'ALL' ||
                      productEscalafonData.effectiveCategory === 'COMERCIAL') && (
                      <>
                        <td className="px-2 py-2 text-center font-mono text-amber-300">
                          {prod.proxVencerOnlyUnits || '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-orange-300">
                          {prod.vencidoUnits || '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-rose-300">
                          {prod.aCobrarUnits || '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono bg-amber-950/15">
                          <span className="font-bold text-amber-600 dark:text-amber-300">
                            {formatNumber(prod.commercialUnits)} u
                          </span>
                          <div className="text-[10px] text-neutral-500 dark:text-slate-400">
                            {formatCOP(prod.commercialCOP)}
                          </div>
                        </td>
                      </>
                    )}
                    {(productEscalafonData.effectiveCategory === 'ALL' ||
                      productEscalafonData.effectiveCategory === 'CALIDAD') && (
                      <>
                        <td className="px-2 py-2 text-center font-mono text-sky-300">
                          {prod.vacioUnits || '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-violet-300">
                          {prod.lechozoUnits || '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-cyan-300">
                          {prod.xFechaUnits || '—'}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-fuchsia-300">
                          {prod.abombaUnits || '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono bg-sky-950/15">
                          <span className="font-bold text-sky-600 dark:text-sky-300">
                            {formatNumber(prod.qualityUnits)} u
                          </span>
                          <div className="text-[10px] text-neutral-500 dark:text-slate-400">
                            {formatCOP(prod.qualityCOP)}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-2.5 py-2 text-right font-mono">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {formatNumber(displayTotalUnits)} u
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        {formatCOP(displayTotalCOP)}
                      </div>
                    </td>
                    <td className="py-2 pl-2.5 pr-4 text-[11px] text-neutral-700 dark:text-slate-200">
                      {actionLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BentoCard>

      {/* Row 2: Matriz Consolidada Full Width (12 Cols) + 2-Col Diagnostic Grid Below */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Full 12 Cols: Matriz Consolidada % DE VENTAS */}
        <BentoCard noPadding className="lg:col-span-12 flex flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-neutral-200/70 dark:border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between bg-slate-950/35">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Matriz Consolidada por Zona Comercial (Z01–Z16, Z14 y Puntos de Venta)
                </h2>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-300 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Control por Zonas ({filteredZones.length})
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-600 dark:text-slate-300">
                Haz clic en cualquier fila para abrir las devoluciones de esa Zona o edita sus Ventas del Mes. Comercial + Calidad = Total Dev.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
              <div className="relative w-full sm:w-52">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por código de zona..."
                  className="w-full rounded-xl border border-neutral-300 dark:border-white/15 bg-white/80 dark:bg-slate-950/75 pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <select
                value={matrixSortBy}
                onChange={(e) =>
                  setMatrixSortBy(
                    e.target.value as
                      | 'CODE_ASC'
                      | 'SALES_DESC'
                      | 'SALES_ASC'
                      | 'TOTAL_DEV_DESC'
                      | 'PCT_DESC'
                      | 'COMM_DESC'
                      | 'QUAL_DESC'
                  )
                }
                className="rounded-xl border border-neutral-300 dark:border-white/15 bg-white/90 dark:bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-neutral-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="CODE_ASC">Orden: Por Código de Zona (Z01→Z16)</option>
                <option value="SALES_DESC">Orden: Zonas que MÁS Venden ↓</option>
                <option value="SALES_ASC">Orden: Zonas que MENOS Venden ↑</option>
                <option value="TOTAL_DEV_DESC">Orden: Mayor Total Devolución ($) ↓</option>
                <option value="PCT_DESC">Orden: Mayor % Incidencia sobre Ventas ↓</option>
                <option value="COMM_DESC">Orden: Mayor Devolución Comercial ↓</option>
                <option value="QUAL_DESC">Orden: Mayor Devolución Calidad ↓</option>
              </select>

              <div className="inline-flex rounded-xl border border-neutral-300 dark:border-white/15 bg-neutral-100/80 dark:bg-slate-950/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setMetricMode('COP')}
                  className={`flex-1 sm:flex-initial justify-center inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
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
                  className={`flex-1 sm:flex-initial justify-center inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
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
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-neutral-200/70 dark:border-white/15 bg-neutral-100/70 dark:bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-slate-300 whitespace-nowrap">
                      <th className="py-3.5 pl-6 pr-4">Zona Comercial</th>
                      <th className="px-4 py-3.5 text-right">Ventas Mes</th>
                      {showAdminComercialCols && (
                        <>
                          <th className="px-4 py-3.5 text-right text-amber-600 dark:text-amber-300 bg-amber-500/[0.04]">
                            Comercial ({metricMode === 'COP' ? '$' : 'Und'})
                          </th>
                          <th className="px-3 py-3.5 text-right text-amber-600 dark:text-amber-300 bg-amber-500/[0.04]">
                            % Come
                          </th>
                        </>
                      )}
                      {showAdminCalidadCols && (
                        <>
                          <th className="px-4 py-3.5 text-right text-sky-600 dark:text-sky-300 bg-sky-500/[0.04]">
                            Calidad ({metricMode === 'COP' ? '$' : 'Und'})
                          </th>
                          <th className="px-3 py-3.5 text-right text-sky-600 dark:text-sky-300 bg-sky-500/[0.04]">
                            % Calid
                          </th>
                        </>
                      )}
                      <th className="px-4 py-3.5 text-right text-emerald-600 dark:text-emerald-300 bg-emerald-500/[0.04]">
                        Total Dev ({metricMode === 'COP' ? '$' : 'Und'})
                      </th>
                      <th className="py-3.5 pl-3 pr-6 text-right bg-emerald-500/[0.04]">
                        % Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/50 dark:divide-white/[0.08] text-xs">
                    {filteredZones.map((z) => {
                      const hasSheetNameMismatch =
                        z.sheetName.trim().toLowerCase() !==
                        z.consolidatedName.trim().toLowerCase();

                      return (
                        <tr
                          key={z.id}
                          onClick={() => onSelectZone(z.id)}
                          className="group hover:bg-indigo-500/10 dark:hover:bg-white/[0.06] cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <td className="py-3.5 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-8 w-16 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 dark:bg-slate-950/80 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-300 group-hover:border-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                                {z.code}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white">
                                  <span>{z.consolidatedName}</span>
                                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity" />
                                </div>
                                <div className="text-[11px] text-neutral-500 dark:text-slate-400 flex items-center gap-1.5">
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

                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-neutral-700 dark:text-slate-200">
                            <button
                              type="button"
                              onClick={(e) => openEditSales(z, e)}
                              title="Editar Ventas Mes de esta zona"
                              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-neutral-200/70 dark:hover:bg-white/10 text-right transition-colors"
                            >
                              <span>{formatCompactCOP(z.monthlySalesCOP)}</span>
                              <Pencil className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                            </button>
                          </td>

                          {showAdminComercialCols && (
                            <>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-300 bg-amber-500/[0.02]">
                                {metricMode === 'COP'
                                  ? formatCOP(z.commercialCOP)
                                  : `${formatNumber(z.commercialUnits)} und`}
                              </td>

                              <td className="px-3 py-3.5 text-right font-mono text-xs font-medium text-amber-600/80 dark:text-amber-200/80 bg-amber-500/[0.02]">
                                {formatPercent(z.pctCommercialOverSales)}
                              </td>
                            </>
                          )}

                          {showAdminCalidadCols && (
                            <>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-sky-600 dark:text-sky-300 bg-sky-500/[0.02]">
                                {metricMode === 'COP'
                                  ? formatCOP(z.qualityCOP)
                                  : `${formatNumber(z.qualityUnits)} und`}
                              </td>

                              <td className="px-3 py-3.5 text-right font-mono text-xs font-medium text-sky-600/80 dark:text-sky-200/80 bg-sky-500/[0.02]">
                                {formatPercent(z.pctQualityOverSales)}
                              </td>
                            </>
                          )}

                          <td className="px-4 py-3.5 text-right font-mono font-extrabold text-neutral-900 dark:text-white bg-emerald-500/[0.02]">
                            {metricMode === 'COP'
                              ? formatCOP(z.totalCOP)
                              : `${formatNumber(z.totalUnits)} und`}
                          </td>

                          <td className="py-3.5 pl-3 pr-6 text-right bg-emerald-500/[0.02]">
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
                    <tr className="border-t-2 border-neutral-300 dark:border-white/20 bg-neutral-100/95 dark:bg-slate-950/90 font-mono text-xs font-extrabold text-neutral-900 dark:text-white whitespace-nowrap">
                      <td className="py-4 pl-6 pr-4 font-sans">
                        SUBTOTAL CONSOLIDADO ({filteredZones.length} Zonas)
                      </td>
                      <td className="px-4 py-4 text-right">
                        {formatCompactCOP(totals.salesCOP)}
                      </td>
                      {showAdminComercialCols && (
                        <>
                          <td className="px-4 py-4 text-right text-amber-600 dark:text-amber-300">
                            {metricMode === 'COP'
                              ? formatCOP(totals.commercialCOP)
                              : `${formatNumber(totals.commercialUnits)} und`}
                          </td>
                          <td className="px-3 py-4 text-right text-amber-600 dark:text-amber-300">
                            {formatPercent(
                              totals.salesCOP > 0
                                ? (totals.commercialCOP / totals.salesCOP) * 100
                                : 0
                            )}
                          </td>
                        </>
                      )}
                      {showAdminCalidadCols && (
                        <>
                          <td className="px-4 py-4 text-right text-sky-600 dark:text-sky-300">
                            {metricMode === 'COP'
                              ? formatCOP(totals.qualityCOP)
                              : `${formatNumber(totals.qualityUnits)} und`}
                          </td>
                          <td className="px-3 py-4 text-right text-sky-600 dark:text-sky-300">
                            {formatPercent(
                              totals.salesCOP > 0
                                ? (totals.qualityCOP / totals.salesCOP) * 100
                                : 0
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4 text-right text-emerald-400">
                        {metricMode === 'COP'
                          ? formatCOP(totals.totalCOP)
                          : `${formatNumber(totals.totalUnits)} und`}
                      </td>
                      <td className="py-4 pl-3 pr-6 text-right">
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

        {/* Bottom 12 Cols Grid: Interactive 7 Causes Diagnosis + Clickable Lot Radar with Photos */}
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
