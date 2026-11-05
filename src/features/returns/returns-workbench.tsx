import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Eye,
  EyeOff,
  PackageX,
  Receipt,
  Trash2,
  Wrench,
  Camera,
  Thermometer,
  Stethoscope,
  Upload,
  Globe,
  Sparkles,
  Tag,
  X,
  CheckCircle2,
  Database,
  ArrowRight,
  Table2,
  LayoutList,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { BentoCard } from '../../components/ui/bento-card';
import { Badge } from '../../components/ui/badge';
import { TableSkeletonLoader } from '../../components/ui/skeleton';
import { EmptyState } from '../../components/ui/empty-state';
import { Modal, TooltipHint } from '../../components/ui/modal';
import {
  CAUSE_METADATA,
  REAL_PRODUCTS_CATALOG,
} from '../../lib/real-excel-data';
import { formatCOP, formatNumber } from '../../lib/utils';
import {
  ComputedReturnRow,
  MovementType,
  ReturnCauseKey,
  ReturnLineItem,
  UserProfile,
  ZoneSummary,
} from '../../types/returns';

interface ReturnsWorkbenchProps {
  currentUser: UserProfile;
  zones: ZoneSummary[];
  selectedZoneId: string;
  onChangeZoneId: (zoneId: string) => void;
  returnRows: ComputedReturnRow[];
  onAddReturnItem: (
    newItem: Omit<ReturnLineItem, 'id'>
  ) => Promise<{ ok: boolean; savedId: string; error?: string }>;
  onAutoFixRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onUpdateRowEvidence: (
    rowId: string,
    photoUrl: string,
    technicalDiagnosis: string,
    storageTempC: number
  ) => void;
  externalLotFilter?: string;
  onClearExternalLotFilter?: () => void;
  onGoToEngineering?: () => void;
  onOpenExcelModal?: () => void;
}

const SAMPLE_EVIDENCE_PHOTOS = [
  {
    label: 'Empaque al vacío con exudado lechoso',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Pérdida de sello al vacío (micro-poro)',
    url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Producto próximo a vencer en góndola',
    url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Inspección de etiqueta y lote en cava',
    url: 'https://images.unsplash.com/photo-1551028150-64b9f398f678?auto=format&fit=crop&w=900&q=80',
  },
];

// Compress uploaded image on client canvas so Base64 is fast (~45 KB) and never exceeds MySQL packet size
function compressImageFile(file: File, maxWidth = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Formato de imagen inválido'));
      };
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const ReturnsWorkbench: React.FC<ReturnsWorkbenchProps> = ({
  currentUser,
  zones,
  selectedZoneId,
  onChangeZoneId,
  returnRows,
  onAddReturnItem,
  onAutoFixRow,
  onDeleteRow,
  onUpdateRowEvidence,
  externalLotFilter,
  onClearExternalLotFilter,
  onGoToEngineering,
  onOpenExcelModal,
}) => {
  const [isLoadingZone, setIsLoadingZone] = useState(false);
  const [showHiddenMoneyCols, setShowHiddenMoneyCols] = useState(false);
  const [forceTableOnMobile, setForceTableOnMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lotFilter, setLotFilter] = useState<string>('ALL');
  const [causeFilter, setCauseFilter] = useState<'ALL' | ReturnCauseKey>('ALL');
  const [searchAllZonesForLot, setSearchAllZonesForLot] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'CUADRADO' | 'REVISAR' | 'JUSTIFICADO_NO_AVERIA'
  >('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingMySQL, setIsSavingMySQL] = useState(false);

  // Last saved confirmation banner state
  const [lastSavedBanner, setLastSavedBanner] = useState<{
    id: string;
    productName: string;
    clientName: string;
    lotNumber: string;
    totalCOP: number;
    savedToMySQL: boolean;
  } | null>(null);

  // Selected row for Photo & Technical Cause Inspection Modal
  const [inspectedRowId, setInspectedRowId] = useState<string | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editTempC, setEditTempC] = useState<number>(4.0);
  const inspectFileInputRef = useRef<HTMLInputElement | null>(null);

  // New Return Form State
  const [date, setDate] = useState('2026-10-16');
  const [clientName, setClientName] = useState('');
  const [productId, setProductId] = useState(REAL_PRODUCTS_CATALOG[0].id);
  const [qtyToReceive, setQtyToReceive] = useState(2);
  const [lotNumber, setLotNumber] = useState('258');
  const [productExpiryDate, setProductExpiryDate] = useState('2026-10-24');
  const [movementType, setMovementType] =
    useState<MovementType>('AVERIA_DEVOLUCION');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [observations, setObservations] = useState('');
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState(
    SAMPLE_EVIDENCE_PHOTOS[0].url
  );
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState('');
  const [storageTempC, setStorageTempC] = useState<number>(4.2);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);

  const [causes, setCauses] = useState<Record<ReturnCauseKey, number>>({
    aCobrar: 0,
    xFecha: 0,
    vacio: 0,
    proxVencer: 2,
    vencido: 0,
    abomba: 0,
    lechozo: 0,
  });

  // Sync external lot filter when user clicks a lot on the Dashboard
  useEffect(() => {
    if (externalLotFilter && externalLotFilter !== 'ALL') {
      setLotFilter(externalLotFilter);
      setSearchAllZonesForLot(true);
    }
  }, [externalLotFilter]);

  // RBAC: Si el usuario es VENDEDOR o PDV, solo ve su zona asignada
  const accessibleZones = useMemo(() => {
    if (
      (currentUser.role === 'VENDEDOR' || currentUser.role === 'PDV') &&
      currentUser.assignedZoneId
    ) {
      return zones.filter((z) => z.id === currentUser.assignedZoneId);
    }
    return zones;
  }, [zones, currentUser]);

  const activeZone = useMemo(
    () =>
      accessibleZones.find((z) => z.id === selectedZoneId) ||
      accessibleZones[0],
    [accessibleZones, selectedZoneId]
  );

  // Extract all unique Lots available across rows
  const availableLots = useMemo(() => {
    const map = new Map<string, { lot: string; count: number; units: number }>();
    const sourceRows = searchAllZonesForLot
      ? returnRows
      : returnRows.filter((r) => !activeZone || r.zoneId === activeZone.id);

    for (const r of sourceRows) {
      if (!r.lotNumber) continue;
      const prev = map.get(r.lotNumber) || {
        lot: r.lotNumber,
        count: 0,
        units: 0,
      };
      prev.count += 1;
      prev.units += r.qtyToReceive;
      map.set(r.lotNumber, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.units - a.units);
  }, [returnRows, activeZone, searchAllZonesForLot]);

  const handleSelectZone = (newZoneId: string) => {
    if (newZoneId === selectedZoneId) return;
    setIsLoadingZone(true);
    onChangeZoneId(newZoneId);
    setTimeout(() => {
      setIsLoadingZone(false);
    }, 280);
  };

  useEffect(() => {
    if (
      activeZone &&
      activeZone.id !== selectedZoneId &&
      accessibleZones.length > 0
    ) {
      onChangeZoneId(activeZone.id);
    }
  }, [activeZone, selectedZoneId, accessibleZones, onChangeZoneId]);

  const zoneRows = useMemo(() => {
    if (!activeZone) return [];
    return returnRows.filter((r) => {
      if (!searchAllZonesForLot && r.zoneId !== activeZone.id) return false;
      if (lotFilter !== 'ALL' && r.lotNumber !== lotFilter) return false;
      if (causeFilter !== 'ALL' && r.causes[causeFilter] <= 0) return false;
      if (statusFilter !== 'ALL' && r.reconciliationStatus !== statusFilter)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.clientName.toLowerCase().includes(q) ||
          r.productName.toLowerCase().includes(q) ||
          r.lotNumber.toLowerCase().includes(q) ||
          r.observations.toLowerCase().includes(q) ||
          r.zoneName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    returnRows,
    activeZone,
    searchAllZonesForLot,
    lotFilter,
    causeFilter,
    statusFilter,
    searchQuery,
  ]);

  const inspectedRow = useMemo(
    () => returnRows.find((r) => r.id === inspectedRowId) || null,
    [returnRows, inspectedRowId]
  );

  const sameLotHistory = useMemo(() => {
    if (!inspectedRow) return [];
    return returnRows.filter(
      (r) => r.lotNumber === inspectedRow.lotNumber && r.id !== inspectedRow.id
    );
  }, [returnRows, inspectedRow]);

  const openInspectModal = (row: ComputedReturnRow) => {
    setInspectedRowId(row.id);
    setEditPhotoUrl(row.evidencePhotoUrl || SAMPLE_EVIDENCE_PHOTOS[0].url);
    setEditDiagnosis(
      row.technicalDiagnosis ||
        'Inspección física realizada en recepción de devoluciones.'
    );
    setEditTempC(row.storageTempC ?? 4.0);
  };

  const handleSaveInspectionEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedRow) return;
    onUpdateRowEvidence(
      inspectedRow.id,
      editPhotoUrl,
      editDiagnosis,
      editTempC
    );
    toast.success('✅ Evidencia y diagnóstico guardados en MySQL (retorna_db)', {
      description: `Lote L-${inspectedRow.lotNumber} · ${inspectedRow.productName}`,
    });
    setInspectedRowId(null);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'CREATE' | 'INSPECT'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, 900, 0.78);
      if (target === 'CREATE') {
        setEvidencePhotoUrl(compressedDataUrl);
      } else {
        setEditPhotoUrl(compressedDataUrl);
      }
      toast.success(`Foto optimizada y adjuntada: ${file.name}`, {
        description: 'Lista para guardarse en la base de datos MySQL retorna_db.',
      });
    } catch {
      toast.error('No se pudo procesar la foto seleccionada.');
    }
  };

  const selectedProduct = useMemo(
    () =>
      REAL_PRODUCTS_CATALOG.find((p) => p.id === productId) ||
      REAL_PRODUCTS_CATALOG[0],
    [productId]
  );

  const formClassifiedSum =
    causes.aCobrar +
    causes.xFecha +
    causes.vacio +
    causes.proxVencer +
    causes.vencido +
    causes.abomba +
    causes.lechozo;

  const isFormBalanced =
    qtyToReceive === formClassifiedSum ||
    (formClassifiedSum === 0 &&
      (movementType === 'DEGUSTACION' || movementType === 'REINGRESO_BUENO'));

  const dominantFormCauseMeta = useMemo(() => {
    let bestKey: ReturnCauseKey = 'proxVencer';
    let maxVal = -1;
    (Object.keys(causes) as ReturnCauseKey[]).forEach((k) => {
      if (causes[k] > maxVal) {
        maxVal = causes[k];
        bestKey = k;
      }
    });
    return (
      CAUSE_METADATA.find((c) => c.key === bestKey) || CAUSE_METADATA[3]
    );
  }, [causes]);

  const handleCauseChange = (key: ReturnCauseKey, val: number) => {
    setCauses((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone) return;
    if (!clientName.trim()) {
      toast.error('Cliente / Sede requerido', {
        description: 'Ingresa el nombre del cliente o punto de venta.',
      });
      return;
    }

    setIsSavingMySQL(true);
    try {
      const totalCOP = qtyToReceive * selectedProduct.price2024;
      const cleanClient = clientName.trim().toUpperCase();
      const cleanLot = lotNumber.trim() || 'S/L';

      const saveResult = await onAddReturnItem({
        date,
        zoneId: activeZone.id,
        zoneName: activeZone.consolidatedName,
        clientName: cleanClient,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        qtyToReceive,
        lotNumber: cleanLot,
        productExpiryDate,
        causes:
          movementType === 'DEGUSTACION' || movementType === 'REINGRESO_BUENO'
            ? {
                aCobrar: 0,
                xFecha: 0,
                vacio: 0,
                proxVencer: 0,
                vencido: 0,
                abomba: 0,
                lechozo: 0,
              }
            : causes,
        unitCost: selectedProduct.price2024,
        movementType,
        invoiceRef: invoiceRef.trim() || undefined,
        observations: observations.trim(),
        createdBy: currentUser.name,
        evidencePhotoUrl: evidencePhotoUrl.trim() || SAMPLE_EVIDENCE_PHOTOS[0].url,
        technicalDiagnosis:
          technicalDiagnosis.trim() ||
          dominantFormCauseMeta.technicalExplanation,
        storageTempC,
      });

      // Show unmistakable confirmation banner on the page
      setLastSavedBanner({
        id: saveResult.savedId,
        productName: selectedProduct.name,
        clientName: cleanClient,
        lotNumber: cleanLot,
        totalCOP,
        savedToMySQL: saveResult.ok,
      });

      if (saveResult.ok) {
        toast.success(
          `✅ GUARDADO EN MYSQL (retorna_db → devoluciones_detalle)`,
          {
            duration: 6000,
            description: `ID: ${saveResult.savedId} · ${qtyToReceive}x ${selectedProduct.name} (Lote L-${cleanLot}) · Ya disponible en phpMyAdmin, HeidiSQL e Ingenieras de Producción.`,
          }
        );
      } else {
        toast.error('Aviso de guardado en MySQL retorna_db', {
          duration: 6000,
          description:
            saveResult.error ||
            'La devolución se registró en la sesión. Revisa la conexión con MySQL.',
        });
      }

      setIsModalOpen(false);
      setClientName('');
      setObservations('');
      setInvoiceRef('');
      setTechnicalDiagnosis('');
    } catch (err: any) {
      toast.error('Error al procesar la devolución', {
        description: String(err?.message || err),
      });
    } finally {
      setIsSavingMySQL(false);
    }
  };

  const tableTotals = useMemo(() => {
    return zoneRows.reduce(
      (acc, r) => {
        acc.qtyToReceive += r.qtyToReceive;
        acc.totalClassified += r.totalClassifiedUnits;
        acc.totalCOP += r.totalValueCOP;
        acc.commCOP += r.commercialValueCOP;
        acc.qualCOP += r.qualityValueCOP;
        (Object.keys(acc.causes) as ReturnCauseKey[]).forEach((k) => {
          acc.causes[k] += r.causes[k];
          acc.causesCOP[k] += r.copByCause[k];
        });
        return acc;
      },
      {
        qtyToReceive: 0,
        totalClassified: 0,
        totalCOP: 0,
        commCOP: 0,
        qualCOP: 0,
        causes: {
          aCobrar: 0,
          xFecha: 0,
          vacio: 0,
          proxVencer: 0,
          vencido: 0,
          abomba: 0,
          lechozo: 0,
        } as Record<ReturnCauseKey, number>,
        causesCOP: {
          aCobrar: 0,
          xFecha: 0,
          vacio: 0,
          proxVencer: 0,
          vencido: 0,
          abomba: 0,
          lechozo: 0,
        } as Record<ReturnCauseKey, number>,
      }
    );
  }, [zoneRows]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Unmistakable Confirmation Banner when a Return is Saved to MySQL retorna_db */}
      {lastSavedBanner && (
        <div
          className={`rounded-2xl border p-4 shadow-xl backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            lastSavedBanner.savedToMySQL
              ? 'border-emerald-400/50 bg-emerald-950/85 text-emerald-100'
              : 'border-amber-400/50 bg-amber-950/85 text-amber-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  {lastSavedBanner.savedToMySQL
                    ? '¡Registro guardado exitosamente en la Base de Datos MySQL (retorna_db)!'
                    : 'Registro guardado en sesión local (revisa conexión MySQL)'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-emerald-200/90 leading-relaxed">
                Tabla: <code className="font-mono font-semibold">devoluciones_detalle</code> · ID:{' '}
                <code className="font-mono">{lastSavedBanner.id}</code> · Producto:{' '}
                <strong>{lastSavedBanner.productName}</strong> · Cliente:{' '}
                <strong>{lastSavedBanner.clientName}</strong> · Lote:{' '}
                <strong>L-{lastSavedBanner.lotNumber}</strong> ({formatCOP(lastSavedBanner.totalCOP)}).
                Ya puedes refrescar <strong>phpMyAdmin / HeidiSQL</strong> para verlo en la tabla.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onGoToEngineering && (
              <button
                type="button"
                onClick={onGoToEngineering}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-sm transition-all"
              >
                Ver en Ing. de Producción
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setLastSavedBanner(null)}
              className="rounded-xl border border-white/20 p-2 text-white/80 hover:bg-white/10"
              title="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header & Zone Selector (100% Mobile Responsive) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {currentUser.role === 'VENDEDOR' || currentUser.role === 'PDV'
                ? `Mis Devoluciones — ${activeZone?.consolidatedName || currentUser.name}`
                : `Devoluciones por Vendedor — ${activeZone?.consolidatedName || 'Todas las Zonas'}`}
            </h1>
            {activeZone && !searchAllZonesForLot && (
              <Badge variant="indigo">{activeZone.code}</Badge>
            )}
            {searchAllZonesForLot && (
              <Badge variant="success" dot>
                Todas las Zonas
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-600 dark:text-slate-300">
            {currentUser.role === 'VENDEDOR' || currentUser.role === 'PDV' ? (
              <>
                Aquí puedes consultar todas las devoluciones de tu zona sincronizadas desde el archivo oficial de <strong>Despachos / HGI</strong>.
              </>
            ) : (
              <>
                Consulta de devoluciones sincronizadas desde el Excel diario en <strong>MySQL (retorna_db)</strong> por cada zona y vendedor.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          {/* Selector de Zona / Punto de Venta */}
          <select
            value={activeZone?.id || ''}
            disabled={searchAllZonesForLot}
            onChange={(e) => handleSelectZone(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-white/40 dark:border-white/15 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl px-3.5 py-2.5 text-xs font-medium text-neutral-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          >
            {accessibleZones.map((z) => (
              <option key={z.id} value={z.id} className="bg-slate-900 text-white">
                {z.code} — {z.consolidatedName} ({z.lineItemsCount} ítems)
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {/* Upload / Sync Daily Excel (.xlsx) CTA: Solo Admin, Recepción o Calidad */}
            {onOpenExcelModal &&
              (currentUser.role === 'ADMIN' ||
                currentUser.role === 'RECEPCION' ||
                currentUser.role === 'CALIDAD') && (
                <button
                  type="button"
                  onClick={onOpenExcelModal}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-400/50 bg-indigo-600/90 hover:bg-indigo-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  <span className="truncate">Subir / Actualizar Excel (.xlsx)</span>
                </button>
              )}

            {/* Toggle Hidden Columns Q..W */}
            <button
              type="button"
              onClick={() => {
                const next = !showHiddenMoneyCols;
                setShowHiddenMoneyCols(next);
                toast.info(
                  next
                    ? 'Valores en pesos ($ COP) visibles por causa'
                    : 'Vista compacta en Unidades'
                );
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium backdrop-blur-xl transition-all duration-200 ${
                showHiddenMoneyCols
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-700 dark:text-indigo-200'
                  : 'border-white/40 dark:border-white/15 bg-white/80 dark:bg-slate-900/75 text-neutral-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              {showHiddenMoneyCols ? (
                <EyeOff className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">
                {showHiddenMoneyCols ? 'Ocultar Valores ($)' : 'Ver Valores ($)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Resumen Ejecutivo de Mis Devoluciones (4 Tarjetas Rápidas para el Vendedor) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BentoCard className="p-3.5 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400">
            Total Mis Devoluciones
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white">
              {formatCOP(tableTotals.totalCOP)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-400 font-medium">
            {formatNumber(tableTotals.qtyToReceive)} unds en {zoneRows.length} registros
          </p>
        </BentoCard>

        <BentoCard className="p-3.5 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
            A Cobrar (Factura / Cruce)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-rose-400">
              {formatCOP(tableTotals.causesCOP.aCobrar)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-300">
            {formatNumber(tableTotals.causes.aCobrar)} unidades a cobrar
          </p>
        </BentoCard>

        <BentoCard className="p-3.5 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Próx. a Vencer / Vencido
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-amber-400">
              {formatCOP(
                tableTotals.causesCOP.proxVencer + tableTotals.causesCOP.vencido
              )}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-300">
            {formatNumber(
              tableTotals.causes.proxVencer + tableTotals.causes.vencido
            )}{' '}
            unds rotación comercial
          </p>
        </BentoCard>

        <BentoCard className="p-3.5 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            Calidad Planta (Vacío / Lechoso)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl sm:text-2xl font-extrabold text-sky-400">
              {formatCOP(tableTotals.qualCOP)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-300">
            {formatNumber(
              tableTotals.causes.vacio +
                tableTotals.causes.lechozo +
                tableTotals.causes.xFecha +
                tableTotals.causes.abomba
            )}{' '}
            unds calidad planta
          </p>
        </BentoCard>
      </div>

      {/* Interactive Lot & Cause Explorer Bar (Mobile Responsive) */}
      <div className="rounded-2xl border border-white/60 dark:border-white/[0.14] bg-white/80 dark:bg-slate-900/65 backdrop-blur-2xl p-3.5 sm:p-4 shadow-xl space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-900 dark:text-white flex flex-wrap items-center gap-1.5">
                <span>Filtro por Lote (Col E) y Causa</span>
                {lotFilter !== 'ALL' && (
                  <Badge variant="indigo" dot>
                    Lote L-{lotFilter}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-slate-300">
                Filtra tus devoluciones por número de lote o por motivo de devolución.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex flex-wrap items-center gap-2">
            {/* Toggle Global Lot Search across all zones (Solo Admin, Calidad, Recepción) */}
            {currentUser.role !== 'VENDEDOR' && currentUser.role !== 'PDV' && (
              <button
                type="button"
                onClick={() => setSearchAllZonesForLot((prev) => !prev)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  searchAllZonesForLot
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                    : 'border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-slate-950/60 text-neutral-700 dark:text-slate-300'
                }`}
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {searchAllZonesForLot
                    ? 'Global: Todas las Zonas'
                    : 'Buscar en Todas las Zonas'}
                </span>
              </button>
            )}

            {/* Dropdown Filter by Cause */}
            <select
              value={causeFilter}
              onChange={(e) =>
                setCauseFilter(e.target.value as 'ALL' | ReturnCauseKey)
              }
              className="w-full sm:w-auto rounded-xl border border-neutral-300 dark:border-white/15 bg-white/90 dark:bg-slate-950/80 px-3 py-2 text-xs font-medium text-neutral-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todas las 7 Causas (Cols G–M)</option>
              {CAUSE_METADATA.map((c) => (
                <option key={c.key} value={c.key}>
                  Causa: {c.fullLabel} ({c.responsibility})
                </option>
              ))}
            </select>

            {/* Dropdown Filter by Lot */}
            <select
              value={lotFilter}
              onChange={(e) => {
                setLotFilter(e.target.value);
                if (e.target.value === 'ALL' && onClearExternalLotFilter) {
                  onClearExternalLotFilter();
                }
              }}
              className="w-full sm:w-auto rounded-xl border border-neutral-300 dark:border-white/15 bg-white/90 dark:bg-slate-950/80 px-3 py-2 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todos los Lotes ({availableLots.length})</option>
              {availableLots.map((item) => (
                <option key={item.lot} value={item.lot}>
                  Lote #{item.lot} ({item.units} unds · {item.count} reg.)
                </option>
              ))}
            </select>

            {(lotFilter !== 'ALL' ||
              causeFilter !== 'ALL' ||
              searchAllZonesForLot) && (
              <button
                type="button"
                onClick={() => {
                  setLotFilter('ALL');
                  setCauseFilter('ALL');
                  setSearchAllZonesForLot(false);
                  if (onClearExternalLotFilter) onClearExternalLotFilter();
                }}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/25"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Interactive Lot Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-slate-400 shrink-0 mr-1">
            Lotes:
          </span>
          <button
            type="button"
            onClick={() => {
              setLotFilter('ALL');
              if (onClearExternalLotFilter) onClearExternalLotFilter();
            }}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              lotFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-200/70 dark:bg-white/10 text-neutral-700 dark:text-slate-300 hover:bg-neutral-300 dark:hover:bg-white/20'
            }`}
          >
            Todos
          </button>
          {availableLots.map((item) => (
            <button
              key={item.lot}
              type="button"
              onClick={() =>
                setLotFilter((prev) => (prev === item.lot ? 'ALL' : item.lot))
              }
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-medium transition-all ${
                lotFilter === item.lot
                  ? 'border-indigo-400 bg-indigo-600 text-white shadow-sm'
                  : 'border-neutral-300/80 dark:border-white/10 bg-white/60 dark:bg-slate-950/60 text-neutral-800 dark:text-slate-200 hover:border-indigo-400/50'
              }`}
            >
              <span>L-{item.lot}</span>
              <span className="rounded bg-black/20 px-1 text-[10px] opacity-80">
                {item.units}u
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Data Card (Mobile Cards + Desktop Table) */}
      <BentoCard noPadding>
        {/* Filter Bar inside Card */}
        <div className="flex flex-col gap-3 border-b border-neutral-200 dark:border-white/10 p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, producto, lote o nota..."
                className="w-full rounded-xl border border-neutral-200 dark:border-white/15 bg-neutral-50 dark:bg-slate-950/80 pl-8 pr-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 dark:border-white/15 bg-neutral-100 dark:bg-slate-950/80 p-1">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'CUADRADO', label: 'Cuadrados' },
                { id: 'REVISAR', label: 'REVISAR' },
                { id: 'JUSTIFICADO_NO_AVERIA', label: 'Degustación' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id as typeof statusFilter)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                    statusFilter === st.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-neutral-600 dark:text-slate-300">
            <span>
              Mostrando <strong>{zoneRows.length}</strong> registros
            </span>
            {/* Mobile toggle between Cards and full Table */}
            <button
              type="button"
              onClick={() => setForceTableOnMobile((prev) => !prev)}
              className="md:hidden inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-indigo-300"
            >
              {forceTableOnMobile ? (
                <>
                  <LayoutList className="h-3.5 w-3.5" />
                  Vista Celular (Tarjetas)
                </>
              ) : (
                <>
                  <Table2 className="h-3.5 w-3.5" />
                  Ver Tabla Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Skeleton Loader State vs Empty State vs Data */}
        {isLoadingZone ? (
          <TableSkeletonLoader rows={6} />
        ) : zoneRows.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              icon={PackageX}
              title={`Sin registros para el filtro actual en ${activeZone?.consolidatedName}`}
              description={
                lotFilter !== 'ALL'
                  ? `No se encontraron devoluciones del Lote L-${lotFilter} en esta zona. Activa "Buscar en Todas las Zonas" arriba para rastrearlo en toda la empresa.`
                  : activeZone?.lineItemsCount === 0
                  ? 'En el archivo Excel original esta hoja se encuentra en 0 devoluciones para el corte de octubre.'
                  : 'No hay registros que coincidan con el filtro seleccionado.'
              }
              actionLabel={
                lotFilter !== 'ALL' && !searchAllZonesForLot
                  ? `Buscar Lote L-${lotFilter} en Todas las Zonas`
                  : 'Registrar Devolución con Foto'
              }
              onAction={() => {
                if (lotFilter !== 'ALL' && !searchAllZonesForLot) {
                  setSearchAllZonesForLot(true);
                } else {
                  setIsModalOpen(true);
                }
              }}
              secondaryActionLabel="Limpiar todos los filtros"
              onSecondaryAction={() => {
                setStatusFilter('ALL');
                setLotFilter('ALL');
                setCauseFilter('ALL');
                setSearchQuery('');
                if (onClearExternalLotFilter) onClearExternalLotFilter();
              }}
            />
          </div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* VISTA CELULAR (TARJETAS RESPONSIVAS TÁCTILES PARA MÓVILES)     */}
            {/* ============================================================== */}
            <div
              className={`${
                forceTableOnMobile ? 'hidden' : 'block md:hidden'
              } divide-y divide-neutral-200/60 dark:divide-white/10`}
            >
              {zoneRows.map((row) => {
                const primaryMeta = CAUSE_METADATA.find(
                  (m) => m.key === row.primaryCauseKey
                );

                return (
                  <div
                    key={row.id}
                    className={`p-3.5 space-y-2.5 ${
                      row.reconciliationStatus === 'REVISAR'
                        ? 'bg-amber-500/[0.08]'
                        : ''
                    }`}
                  >
                    {/* Top row: Date + Product + Lot */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-indigo-400">
                            {row.date} · {row.zoneId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setLotFilter((prev) =>
                                prev === row.lotNumber ? 'ALL' : row.lotNumber
                              )
                            }
                            className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-300"
                          >
                            Lote #{row.lotNumber}
                          </button>
                        </div>

                        <div className="mt-1 text-sm font-bold text-neutral-900 dark:text-white leading-snug">
                          {row.productName}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-slate-300 truncate">
                          Cliente: {row.clientName}
                        </div>
                      </div>
                    </div>

                    {/* Middle row: Quantities, Active Causes & Total COP */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-100/60 dark:bg-slate-950/60 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          Cant: {row.qtyToReceive}u
                        </span>
                        <span>·</span>
                        {CAUSE_METADATA.map((c) => {
                          const u = row.causes[c.key];
                          if (u <= 0) return null;
                          return (
                            <span
                              key={c.key}
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${c.badgeClass}`}
                            >
                              {c.shortLabel}: {u}
                            </span>
                          );
                        })}
                      </div>
                      <div className="font-mono text-sm font-bold text-emerald-500 dark:text-emerald-400">
                        {formatCOP(row.totalValueCOP)}
                      </div>
                    </div>

                    {/* Observations & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.reconciliationStatus === 'CUADRADO' ? (
                          <Badge variant="success" dot>
                            CUADRADO
                          </Badge>
                        ) : (
                          <Badge variant="warning" dot>
                            REVISAR (Dif: {row.discrepancyUnits}u)
                          </Badge>
                        )}
                        {primaryMeta && (
                          <span className="text-[11px] text-neutral-500 dark:text-slate-300">
                            {primaryMeta.fullLabel}
                          </span>
                        )}
                        {row.observations && (
                          <span className="text-[11px] text-amber-300/90 font-medium">
                            · {row.observations}
                          </span>
                        )}
                      </div>

                      {currentUser.role !== 'VENDEDOR' &&
                        currentUser.role !== 'PDV' && (
                          <div className="flex items-center gap-1.5">
                            {row.reconciliationStatus === 'REVISAR' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAutoFixRow(row.id);
                                  toast.success(
                                    'Registro cuadrado automáticamente'
                                  );
                                }}
                                className="rounded-xl bg-amber-500/20 p-1.5 text-amber-300"
                                title="Cuadrar fila"
                              >
                                <Wrench className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                onDeleteRow(row.id);
                                toast.info(
                                  'Registro eliminado de MySQL retorna_db'
                                );
                              }}
                              className="rounded-xl bg-rose-500/15 p-1.5 text-rose-400"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}

              {/* Mobile Totals Footer */}
              <div className="p-4 bg-neutral-100/90 dark:bg-slate-950/90 flex items-center justify-between text-xs font-bold">
                <span>
                  TOTAL ({zoneRows.length} reg · {tableTotals.qtyToReceive} unds)
                </span>
                <span className="font-mono text-sm text-indigo-400">
                  {formatCOP(tableTotals.totalCOP)}
                </span>
              </div>
            </div>

            {/* ============================================================== */}
            {/* VISTA ESCRITORIO / TABLA EXCEL COMPLETA                        */}
            {/* ============================================================== */}
            <div
              className={`${
                forceTableOnMobile ? 'block' : 'hidden md:block'
              } overflow-x-auto`}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-slate-950/60 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-slate-300">
                    <th className="py-3 pl-4 pr-2">Fecha / Ruta</th>
                    <th className="px-2 py-3">Cliente / Sede (B)</th>
                    <th className="px-2 py-3">Producto (C)</th>
                    <th className="px-2 py-3 text-center">Cant. (D)</th>
                    <th className="px-2 py-3 text-center">Lote (E) / Venc (F)</th>
                    {CAUSE_METADATA.map((c) => (
                      <th
                        key={c.key}
                        className="px-1.5 py-3 text-center"
                        title={`${c.fullLabel} (${c.excelCol})`}
                      >
                        <span
                          className={
                            c.responsibility === 'COMERCIAL'
                              ? 'text-amber-500 dark:text-amber-300'
                              : 'text-sky-500 dark:text-sky-300'
                          }
                        >
                          {c.shortLabel.split(' ')[0]}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-3 text-right">Total $ (Q–W)</th>
                    <th className="py-3 pl-2 pr-4">Observaciones / Factura (Col P)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-white/[0.08] text-xs">
                  {zoneRows.map((row) => {
                    const primaryMeta = CAUSE_METADATA.find(
                      (m) => m.key === row.primaryCauseKey
                    );

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          row.reconciliationStatus === 'REVISAR'
                            ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]'
                            : 'hover:bg-indigo-500/[0.06] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <td className="py-3 pl-4 pr-2 font-mono text-[11px] text-neutral-600 dark:text-slate-300 whitespace-nowrap">
                          <div>{row.date}</div>
                          <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-300">
                            {row.zoneId}
                          </span>
                        </td>

                        <td className="px-2 py-3 font-medium text-neutral-900 dark:text-slate-100 max-w-[180px] truncate">
                          {row.clientName}
                        </td>

                        <td className="px-2 py-3">
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {row.productName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-neutral-500 dark:text-slate-400">
                              Unit: {formatCOP(row.unitCost)}
                            </span>
                            {row.invoiceRef && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400">
                                <Receipt className="h-2.5 w-2.5" />
                                {row.invoiceRef}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-2 py-3 text-center font-mono font-bold text-neutral-900 dark:text-white">
                          {row.qtyToReceive}
                        </td>

                        <td className="px-2 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setLotFilter((prev) =>
                                prev === row.lotNumber ? 'ALL' : row.lotNumber
                              )
                            }
                            title="Filtrar todas las devoluciones de este mismo Lote"
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold transition-all ${
                              lotFilter === row.lotNumber
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/30'
                            }`}
                          >
                            L-{row.lotNumber}
                          </button>
                          <div className="text-[10px] font-mono text-neutral-500 dark:text-slate-400 mt-0.5">
                            Venc: {row.productExpiryDate}
                          </div>
                        </td>

                        {/* 7 Causes Columns */}
                        {CAUSE_METADATA.map((c) => {
                          const unitVal = row.causes[c.key];
                          const moneyVal = row.copByCause[c.key];
                          return (
                            <td
                              key={c.key}
                              className="px-1.5 py-3 text-center font-mono"
                            >
                              {unitVal > 0 ? (
                                <div>
                                  <span
                                    className={`inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${c.badgeClass}`}
                                  >
                                    {unitVal}
                                  </span>
                                  {showHiddenMoneyCols && (
                                    <div className="mt-0.5 text-[10px] text-neutral-500 dark:text-slate-300">
                                      {formatCOP(moneyVal)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-300 dark:text-slate-700">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}

                        <td className="px-2 py-3 text-right font-mono font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                          {formatCOP(row.totalValueCOP)}
                        </td>

                        <td className="py-3 pl-2 pr-4 max-w-[260px]">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {row.reconciliationStatus === 'CUADRADO' && (
                                <Badge variant="success" dot>
                                  CUADRADO
                                </Badge>
                              )}
                              {row.reconciliationStatus === 'REVISAR' && (
                                <Badge variant="warning" dot>
                                  REVISAR (Dif: {row.discrepancyUnits}u)
                                </Badge>
                              )}
                              {row.reconciliationStatus ===
                                'JUSTIFICADO_NO_AVERIA' && (
                                <Badge variant="indigo">
                                  {row.movementType === 'DEGUSTACION'
                                    ? 'DEGUSTACIÓN'
                                    : 'REGRESA BUENA'}
                                </Badge>
                              )}
                              {primaryMeta && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${primaryMeta.badgeClass}`}
                                >
                                  {primaryMeta.shortLabel}
                                </span>
                              )}
                            </div>

                            {row.observations ? (
                              <p className="text-[11px] font-medium text-amber-300/95 leading-snug">
                                {row.observations}
                              </p>
                            ) : (
                              <p className="text-[11px] text-neutral-500 dark:text-slate-400 leading-snug">
                                {primaryMeta?.fullLabel || 'Devolución registrada'}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-300 dark:border-white/20 bg-neutral-100/90 dark:bg-slate-950/90 font-mono text-xs font-bold text-neutral-900 dark:text-white">
                    <td colSpan={3} className="py-3 pl-4 pr-2 font-sans">
                      TOTAL FILTRADO ({zoneRows.length} registros)
                    </td>
                    <td className="px-2 py-3 text-center">
                      {tableTotals.qtyToReceive}
                    </td>
                    <td className="px-2 py-3 text-center text-neutral-400">
                      —
                    </td>
                    {CAUSE_METADATA.map((c) => (
                      <td key={c.key} className="px-1.5 py-3 text-center">
                        <div>{tableTotals.causes[c.key]}</div>
                        {showHiddenMoneyCols && (
                          <div className="text-[10px] font-normal text-neutral-400">
                            {formatCOP(tableTotals.causesCOP[c.key])}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-3 text-right text-indigo-400">
                      {formatCOP(tableTotals.totalCOP)}
                    </td>
                    <td className="py-3 pl-2 pr-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </BentoCard>

      {/* Modal 1: Ficha Visual de Devolución para Ingenieras de Producción */}
      <Modal
        open={Boolean(inspectedRow)}
        onClose={() => setInspectedRowId(null)}
        title={
          inspectedRow
            ? `Ficha de Devolución con Foto — ${inspectedRow.productName} (Día: ${inspectedRow.date})`
            : 'Ficha de Devolución'
        }
        subtitle={
          inspectedRow
            ? `Lote #${inspectedRow.lotNumber} · Vence: ${inspectedRow.productExpiryDate} · Zona: ${inspectedRow.zoneName} · Cliente: ${inspectedRow.clientName}`
            : ''
        }
        maxWidthClass="max-w-3xl"
      >
        {inspectedRow && (
          <form onSubmit={handleSaveInspectionEvidence} className="space-y-4">
            {(() => {
              const primaryMeta =
                CAUSE_METADATA.find(
                  (m) => m.key === inspectedRow.primaryCauseKey
                ) || CAUSE_METADATA[3];

              return (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-200">
                      Clasificación por Causa de Devolución (Cols G a M)
                    </span>
                    <Badge
                      variant={
                        inspectedRow.reconciliationStatus === 'REVISAR'
                          ? 'warning'
                          : 'success'
                      }
                      dot
                    >
                      {inspectedRow.reconciliationStatus === 'REVISAR'
                        ? `REVISAR (${inspectedRow.totalClassifiedUnits} de ${inspectedRow.qtyToReceive} und)`
                        : `CUADRADO (${inspectedRow.totalClassifiedUnits} = ${inspectedRow.qtyToReceive} und)`}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CAUSE_METADATA.map((c) => {
                      const unitVal = inspectedRow.causes[c.key];
                      const copVal = inspectedRow.copByCause[c.key];
                      const isActive = unitVal > 0;

                      return (
                        <div
                          key={c.key}
                          className={`rounded-xl border p-2.5 ${
                            isActive
                              ? 'border-indigo-500/60 bg-indigo-950/35'
                              : 'border-neutral-800/90 bg-neutral-900/70'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-300 mb-1">
                            <span className="truncate">{c.shortLabel}</span>
                            <span
                              className={`text-[10px] ${
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
                          <div className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-xs font-bold text-white">
                            {unitVal}
                          </div>
                          <div className="mt-1 text-right font-mono text-[10px] text-neutral-400">
                            {formatCOP(copVal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3 text-xs text-indigo-100">
                    <div className="font-semibold text-indigo-300">
                      Ficha Técnica de la Causa ({primaryMeta.fullLabel}):
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-300">
                      {primaryMeta.technicalExplanation}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-300">
                      <strong>Protocolo Ingeniería de Producción:</strong>{' '}
                      {primaryMeta.recommendedAction}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative h-36 sm:h-28 w-full sm:w-36 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900">
                  <img
                    src={editPhotoUrl || SAMPLE_EVIDENCE_PHOTOS[0].url}
                    alt={inspectedRow.productName}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                    {editTempC}°C
                  </div>
                </div>

                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Evidencia Fotográfica del Producto Devuelto
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Reportado el <strong>{inspectedRow.date}</strong> · Lote{' '}
                        <strong>L-{inspectedRow.lotNumber}</strong> · Por{' '}
                        {inspectedRow.createdBy}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => inspectFileInputRef.current?.click()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Subir / Cambiar Foto
                    </button>
                    <input
                      ref={inspectFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'INSPECT')}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={editDiagnosis}
                        onChange={(e) => setEditDiagnosis(e.target.value)}
                        placeholder="Diagnóstico de Ingeniería / Recepción..."
                        className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.1"
                        value={editTempC}
                        onChange={(e) => setEditTempC(Number(e.target.value))}
                        placeholder="Temp °C"
                        className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {sameLotHistory.length > 0 && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3.5">
                <div className="text-xs font-semibold text-indigo-300 mb-2">
                  Otros reportes de este mismo Lote L-{inspectedRow.lotNumber}:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sameLotHistory.map((other) => (
                    <div
                      key={other.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs"
                    >
                      <span className="text-slate-200 truncate">
                        {other.zoneId} · {other.clientName} ({other.qtyToReceive}u)
                      </span>
                      <span className="font-mono font-semibold text-amber-300 shrink-0 ml-2">
                        {formatCOP(other.totalValueCOP)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-neutral-800 pt-4">
              <div className="text-xs text-neutral-400">
                Impacto Monetario Total:{' '}
                <strong className="font-mono text-sm text-white">
                  {formatCOP(inspectedRow.totalValueCOP)}
                </strong>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInspectedRowId(null)}
                  className="flex-1 sm:flex-initial rounded-xl border border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                >
                  Guardar en MySQL
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 2: Registrar Nueva Devolución con Subida de Foto y Guardado Directo en MySQL */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Registrar Devolución con Foto — ${activeZone?.consolidatedName ?? ''}`}
        subtitle="Se guarda directamente en la tabla devoluciones_detalle de MySQL (retorna_db) y en Ingenieras de Producción."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Fecha Recepción (Col A)
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Cliente o Punto de Venta (Col B)
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. DISTRIBUIDORA ADF / SEDE BELÉN"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Producto Catálogo 2024 (Col C)
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {REAL_PRODUCTS_CATALOG.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} — {formatCOP(p.price2024)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Costo Unitario (Col O)
              </label>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs font-semibold text-indigo-400">
                {formatCOP(selectedProduct.price2024)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Cant. Recibir (Col D)
              </label>
              <input
                type="number"
                min={1}
                required
                value={qtyToReceive}
                onChange={(e) =>
                  setQtyToReceive(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                N° Lote (Col E)
              </label>
              <input
                type="text"
                required
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Ej. 258"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Fecha Venc. (Col F)
              </label>
              <input
                type="date"
                required
                value={productExpiryDate}
                onChange={(e) => setProductExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Temp. °C
              </label>
              <input
                type="number"
                step="0.1"
                value={storageTempC}
                onChange={(e) => setStorageTempC(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Movimiento
              </label>
              <select
                value={movementType}
                onChange={(e) =>
                  setMovementType(e.target.value as MovementType)
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="AVERIA_DEVOLUCION">Devolución / Avería</option>
                <option value="CAMBIO_FACTURA">Cobro Factura</option>
                <option value="DEGUSTACION">Degustación</option>
                <option value="REINGRESO_BUENO">Regresa Buena</option>
              </select>
            </div>
          </div>

          {movementType !== 'DEGUSTACION' &&
            movementType !== 'REINGRESO_BUENO' && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-200">
                    Clasificación por Causa de Devolución (Cols G a M)
                  </span>
                  <Badge variant={isFormBalanced ? 'success' : 'warning'} dot>
                    {isFormBalanced
                      ? `CUADRADO (${formClassifiedSum} = ${qtyToReceive} und)`
                      : `REVISAR: Clasificadas ${formClassifiedSum} de ${qtyToReceive} und`}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CAUSE_METADATA.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-xl border border-neutral-800/90 bg-neutral-900/70 p-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-300 mb-1">
                        <span className="truncate">{c.shortLabel}</span>
                        <span
                          className={`text-[10px] ${
                            c.responsibility === 'COMERCIAL'
                              ? 'text-amber-400'
                              : 'text-sky-400'
                          }`}
                        >
                          {c.responsibility === 'COMERCIAL' ? 'Com.' : 'Cal.'}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={causes[c.key]}
                        onChange={(e) =>
                          handleCauseChange(c.key, Number(e.target.value) || 0)
                        }
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                      <div className="mt-1 text-right font-mono text-[10px] text-neutral-500">
                        {formatCOP(causes[c.key] * selectedProduct.price2024)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3 text-xs text-indigo-100">
                  <div className="font-semibold text-indigo-300">
                    Ficha Técnica de la Causa ({dominantFormCauseMeta.fullLabel}):
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-300">
                    {dominantFormCauseMeta.technicalExplanation}
                  </p>
                </div>
              </div>
            )}

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative h-32 sm:h-24 w-full sm:w-32 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900">
                <img
                  src={evidencePhotoUrl}
                  alt="Vista previa evidencia"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Evidencia Fotográfica del Producto Devuelto
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Sube una foto desde el celular o computador para respaldar la avería.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => createFileInputRef.current?.click()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Subir Foto desde Equipo / Cámara
                  </button>
                  <input
                    ref={createFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'CREATE')}
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={technicalDiagnosis}
                    onChange={(e) => setTechnicalDiagnosis(e.target.value)}
                    placeholder="Diagnóstico (ej. Empaque con pérdida de vacío)"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Observación / Factura (Col P)"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-neutral-800 pt-4">
            <div className="text-xs text-neutral-400">
              Impacto Monetario Total:{' '}
              <strong className="font-mono text-sm text-white">
                {formatCOP(formClassifiedSum * selectedProduct.price2024)}
              </strong>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 sm:flex-initial rounded-xl border border-neutral-800 px-4 py-2.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingMySQL}
                className="flex-1 sm:flex-initial rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
              >
                {isSavingMySQL
                  ? 'Guardando en MySQL...'
                  : 'Guardar Devolución con Foto'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
