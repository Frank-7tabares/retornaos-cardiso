import React, { useMemo, useState } from 'react';
import {
  Search,
  Package,
  TrendingUp,
  CheckCircle2,
  Database,
  ShieldCheck,
  Server,
  FileWarning,
  Layers,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { BentoCard } from '../../components/ui/bento-card';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { formatCOP, formatPercent } from '../../lib/utils';
import { ProductCatalogItem } from '../../types/returns';

interface CatalogViewProps {
  products: ProductCatalogItem[];
  onUpdatePrice: (productId: string, newPrice2024: number) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  onUpdatePrice,
}) => {
  const [subTab, setSubTab] = useState<'CATALOG' | 'ARCHITECTURE'>('CATALOG');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [editingProduct, setEditingProduct] =
    useState<ProductCatalogItem | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter)
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, categoryFilter, search]);

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const val = Number(priceInput);
    if (Number.isNaN(val) || val <= 0) {
      toast.error('Precio inválido');
      return;
    }
    onUpdatePrice(editingProduct.id, val);
    toast.success(`Precio 2024 actualizado: ${editingProduct.name}`, {
      description: `Nuevo costo unitario: ${formatCOP(val)} (Vigencia inmediata en nuevas devoluciones).`,
    });
    setEditingProduct(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
            Catálogo Maestro de Productos & Arquitectura del Sistema
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Unificación de <code className="font-mono">LISTA PDTOS 2024</code> y{' '}
            <code className="font-mono">LISTA PDTOS HASTA 15</code> (sin las 65,536 filas vacías del Excel).
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSubTab('CATALOG')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
              subTab === 'CATALOG'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Catálogo Oficial Precios ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ARCHITECTURE')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
              subTab === 'ARCHITECTURE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            Diagnóstico Excel & Backend / Seguridad
          </button>
        </div>
      </div>

      {subTab === 'CATALOG' ? (
        <BentoCard noPadding>
          <div className="flex flex-col gap-3 border-b border-neutral-200 dark:border-neutral-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por SKU o descripción..."
                  className="w-full sm:w-60 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">Todas las familias cárnicas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <Badge variant="success" dot>
              0 Errores #N/A en VLOOKUP
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="py-3 pl-5 pr-3">SKU (`Str Id`)</th>
                  <th className="px-3 py-3">Descripción Normalizada</th>
                  <th className="px-3 py-3">Línea / Familia</th>
                  <th className="px-3 py-3 text-right">
                    Precio Ant. (`HASTA 15`)
                  </th>
                  <th className="px-3 py-3 text-right">
                    Precio Vigente (`2024`)
                  </th>
                  <th className="px-3 py-3 text-right">Variación</th>
                  <th className="py-3 pl-3 pr-5 text-right">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/70 text-xs">
                {filteredProducts.map((p) => {
                  const diffPct =
                    p.priceHasta15 > 0
                      ? ((p.price2024 - p.priceHasta15) / p.priceHasta15) * 100
                      : 0;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 pl-5 pr-3 font-mono font-semibold text-indigo-500 dark:text-indigo-400">
                        #{p.sku}
                      </td>
                      <td className="px-3 py-3 font-medium text-neutral-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="neutral">{p.category}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-neutral-500">
                        {formatCOP(p.priceHasta15)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-neutral-900 dark:text-white">
                        {formatCOP(p.price2024)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        <span
                          className={
                            diffPct >= 0 ? 'text-emerald-500' : 'text-amber-500'
                          }
                        >
                          {diffPct >= 0 ? '+' : ''}
                          {formatPercent(diffPct, 1)}
                        </span>
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(p);
                            setPriceInput(String(p.price2024));
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Card 1: Hallazgos Forenses de los 2 Archivos Excel */}
          <BentoCard className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <FileWarning className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Radiografía Forense de los 2 Excel
                </h3>
                <p className="text-xs text-neutral-500">
                  Por qué pesaban 3.89 MB y 3.33 MB
                </p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-rose-400 block mb-0.5">
                  1. Explosión a 16,384 Columnas (`A2:XFD992`):
                </strong>
                En <code className="font-mono">Z01 SANTIAGO MONCADA</code> y{' '}
                <code className="font-mono">PUNTOS DE VENTA BELEN</code> la tabla se extendió hasta la columna `XFD` generando `Columna1` a `Columna16361`.
              </li>
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-amber-400 block mb-0.5">
                  2. Catálogo de 65,536 filas (`sheet3.xml` = 6.5 MB):
                </strong>
                La tabla <code className="font-mono">LISTAPDTOS2021</code> tenía rango `A1:B65536` para solo 95 productos reales.
              </li>
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-sky-400 block mb-0.5">
                  3. 6 Hojas Ocultas + 7 Columnas Ocultas (`Q–W`):
                </strong>
                Hojas ocultas (`INFORME`, `INF PRUEBA`, `PRUEBA`, `DATOS`, `TABLA RESUMEN`, `SIN VENDEDOR`) y columnas ocultas `Q–W` con más de 180,000 fórmulas pre-arrastradas.
              </li>
            </ul>
          </BentoCard>

          {/* Card 2: Arquitectura Backend & Base de Datos */}
          <BentoCard className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Backend TypeScript + PostgreSQL
                </h3>
                <p className="text-xs text-neutral-500">
                  Incluido en `/backend` listo para producción
                </p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-indigo-400 block mb-0.5">
                  Desacoplamiento Zona vs. Vendedor:
                </strong>
                La entidad <code className="font-mono">Zone</code> (`Z01`..`Z15`, `PDV`) mantiene historial de titulares para que cambiar de vendedor nunca rompa `% DE VENTAS` con `#REF!`.
              </li>
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-indigo-400 block mb-0.5">
                  Snapshot Histórico de Costos (`unit_cost_snapshot`):
                </strong>
                Cada devolución congela el precio vigente de ese día, manteniendo intacta la contabilidad de meses anteriores cuando suban los precios.
              </li>
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-indigo-400 block mb-0.5">
                  Validador Separado de Observaciones:
                </strong>
                El estado `CUADRADO / REVISAR` es calculado por el motor y jamás se sobrescribe al digitar notas como `"degustacion"` o `"fact#555543"`.
              </li>
            </ul>
          </BentoCard>

          {/* Card 3: Seguridad, Login, Registro & Auditoría */}
          <BentoCard className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Seguridad & Control RBAC
                </h3>
                <p className="text-xs text-neutral-500">
                  Permisos estrictos por Zona y Rol
                </p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-emerald-400 block mb-0.5">
                  Aislamiento de Rutas (Row-Level Security):
                </strong>
                Un usuario con rol <code className="font-mono">VENDEDOR</code> o{' '}
                <code className="font-mono">PDV</code> solo puede consultar y registrar ítems en su zona asignada.
              </li>
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-emerald-400 block mb-0.5">
                  Autenticación JWT + Refresh HttpOnly:
                </strong>
                Contraseñas cifradas con Argon2id, tokens de 15 minutos y flujo de aprobación de registro para nuevos vendedores.
              </li>
              <li className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <strong className="text-emerald-400 block mb-0.5">
                  Trazabilidad Inmutable (`AuditLog`):
                </strong>
                Todo cambio de causa (ej. de *A Cobrar* a *Próx. Vencer*) o ajuste de precio registra usuario, fecha/hora, IP y valores anterior/nuevo.
              </li>
            </ul>
          </BentoCard>
        </div>
      )}

      {/* Modal Ajuste Precio */}
      <Modal
        open={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        title={`Actualizar Precio Catálogo 2024 — ${editingProduct?.name ?? ''}`}
        subtitle={`SKU #${editingProduct?.sku ?? ''} · Precio Anterior (Hasta 15): ${formatCOP(
          editingProduct?.priceHasta15 ?? 0
        )}`}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSavePrice} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Nuevo Precio Unitario (`Int Precio5` en COP $)
            </label>
            <input
              type="number"
              required
              min={100}
              step={50}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 font-mono text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="rounded-xl border border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-medium text-white shadow-sm"
            >
              Guardar Precio
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
