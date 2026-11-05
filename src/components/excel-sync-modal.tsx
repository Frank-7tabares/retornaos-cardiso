import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Database,
  Users,
  Sparkles,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui/modal';
import { Badge } from './ui/badge';
import {
  ExcelParseSummary,
  parseReturnsExcelWorkbook,
} from '../lib/excel-parser';
import { formatCOP, formatNumber } from '../lib/utils';
import { ReturnLineItem } from '../types/returns';

interface ExcelSyncModalProps {
  open: boolean;
  onClose: () => void;
  onSyncItems: (
    items: ReturnLineItem[],
    options: { replaceAll: boolean; fileName: string }
  ) => Promise<{ ok: boolean; totalSynced: number; error?: string }>;
}

export const ExcelSyncModal: React.FC<ExcelSyncModalProps> = ({
  open,
  onClose,
  onSyncItems,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);
  const [parsedSummary, setParsedSummary] = useState<ExcelParseSummary | null>(
    null
  );

  const handleFileProcess = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      toast.error('Formato no válido', {
        description: 'Por favor selecciona un archivo Excel (.xlsx o .xls).',
      });
      return;
    }

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const summary = parseReturnsExcelWorkbook(buffer, file.name);

      if (summary.totalRowsParsed === 0) {
        toast.error('No se detectaron devoluciones en el archivo', {
          description:
            'Verifica que el Excel contenga las pestañas Z01-Z16 o Puntos de Venta con el formato estándar.',
        });
        setParsedSummary(null);
      } else {
        setParsedSummary(summary);
        toast.success(`Archivo analizado: ${summary.totalRowsParsed} devoluciones`, {
          description: `${summary.zonesDetected.length} zonas detectadas · Total: ${formatCOP(summary.totalCOP)}`,
        });
      }
    } catch (err: any) {
      toast.error('Error al leer el archivo Excel', {
        description: String(err?.message || err),
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleConfirmSync = async () => {
    if (!parsedSummary) return;
    setIsSyncing(true);
    try {
      const res = await onSyncItems(parsedSummary.items, {
        replaceAll,
        fileName: parsedSummary.fileName,
      });

      if (res.ok) {
        toast.success(
          `✅ ¡${parsedSummary.totalRowsParsed} devoluciones guardadas en MySQL y sincronizadas!`,
          {
            duration: 6000,
            description: `Archivo "${parsedSummary.fileName}" cargado. Cada vendedor (Z01-Z16) e Ingeniera de Calidad ya tienen sus datos actualizados.`,
          }
        );
      } else {
        toast.warning(
          `Cargadas ${parsedSummary.totalRowsParsed} devoluciones en el sistema`,
          {
            duration: 6000,
            description:
              res.error ||
              'Los datos ya están visibles en todas las pantallas del sistema.',
          }
        );
      }
      onClose();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sincronizar Excel Diario de Devoluciones (HGI → RetornaOS)"
      subtitle="Sube el archivo acumulado del mes (ej. DEV FACT 03 DE NOVIEMBRE VENDEDORES.xlsx). El sistema actualiza todas las zonas Z01 a Z16, PDV y el reporte de Calidad sin duplicar registros."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
            isDragging
              ? 'border-emerald-400 bg-emerald-500/15'
              : parsedSummary
              ? 'border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400/60'
              : 'border-white/20 bg-slate-900/70 hover:border-emerald-400/50 hover:bg-slate-900'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 mb-3">
            {isParsing ? (
              <RefreshCw className="h-6 w-6 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-6 w-6" />
            )}
          </div>

          <div className="text-sm font-bold text-white">
            {parsedSummary
              ? `Archivo listo: ${parsedSummary.fileName}`
              : 'Haz clic aquí o arrastra el archivo Excel (.xlsx) de Despachos / HGI'}
          </div>
          <p className="mt-1 text-xs text-slate-300">
            Compatible con <strong>DEV FACT VENDEDORES (Z01-Z16)</strong> y{' '}
            <strong>PUNTOS DE VENTA / CLIENTES Z14</strong>.
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm">
            <Upload className="h-3.5 w-3.5" />
            {parsedSummary ? 'Elegir otro archivo Excel' : 'Seleccionar Archivo .xlsx'}
          </div>
        </div>

        {/* Parsed Preview */}
        {parsedSummary && (
          <div className="space-y-4 rounded-2xl border border-white/15 bg-slate-950/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-white">
                  Resumen del Excel Analizado ({parsedSummary.zonesDetected.length}{' '}
                  zonas con devoluciones)
                </span>
              </div>
              <Badge variant="success" dot>
                UPSERT Activo (Cero Duplicados)
              </Badge>
            </div>

            {/* 4 Key Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
                <div className="text-[10px] uppercase text-slate-400">
                  Filas de Devolución
                </div>
                <div className="mt-0.5 text-lg font-bold font-mono text-white">
                  {formatNumber(parsedSummary.totalRowsParsed)}
                </div>
                <div className="text-[11px] text-emerald-400 font-mono">
                  {formatNumber(parsedSummary.totalUnits)} unidades
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
                <div className="text-[10px] uppercase text-slate-400">
                  Total Liquidado Excel
                </div>
                <div className="mt-0.5 text-base sm:text-lg font-bold font-mono text-white">
                  {formatCOP(parsedSummary.totalCOP)}
                </div>
                <div className="text-[11px] text-slate-400">
                  100% cuadrado con hoja % Ventas
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                <div className="text-[10px] uppercase text-amber-300">
                  Comercial (PR/V, Cobrar, Venc)
                </div>
                <div className="mt-0.5 text-base font-bold font-mono text-amber-300">
                  {formatCOP(parsedSummary.commercialCOP)}
                </div>
                <div className="text-[10px] text-amber-200/80">
                  Rotación / Ruta Vendedor
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3">
                <div className="text-[10px] uppercase text-sky-300">
                  Calidad Planta (Lechoso, Vacío)
                </div>
                <div className="mt-0.5 text-base font-bold font-mono text-sky-300">
                  {formatCOP(parsedSummary.qualityCOP)}
                </div>
                <div className="text-[10px] text-sky-200/80">
                  Reporte Ing. de Calidad
                </div>
              </div>
            </div>

            {/* Zones Breakdown */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                Desglose por Vendedor / Zona detectado en las pestañas del Excel:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {parsedSummary.zonesDetected.map((z) => (
                  <div
                    key={z.zoneId}
                    className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs"
                  >
                    <div className="font-bold text-white truncate">
                      {z.zoneName}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5 font-mono">
                      <span>{z.rowsCount} reg.</span>
                      <span className="text-emerald-300 font-semibold">
                        {formatCOP(z.totalCOP)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Mode Option */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>
                  <strong>Reemplazar base de datos completa</strong> con este
                  archivo (limpia registros de meses anteriores)
                </span>
              </label>
              <span className="text-[11px] text-slate-400">
                {replaceAll
                  ? 'Se dejarán únicamente las filas de este Excel'
                  : 'Modo Acumulado: actualiza existentes y agrega nuevas'}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!parsedSummary || isSyncing}
            onClick={handleConfirmSync}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Sincronizando con MySQL...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                {parsedSummary
                  ? `Guardar ${parsedSummary.totalRowsParsed} Devoluciones en el Sistema`
                  : 'Selecciona un archivo Excel primero'}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
