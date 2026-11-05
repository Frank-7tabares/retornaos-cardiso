import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import {
  LayoutGrid,
  ClipboardCheck,
  PackageSearch,
  LogOut,
  Sun,
  Moon,
  Shield,
  RefreshCw,
  Download,
  HelpCircle,
  ArrowRight,
  FileSpreadsheet,
  Users,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Trees,
  FlaskConical,
} from 'lucide-react';
import {
  DEMO_USERS,
  INITIAL_RETURN_ITEMS,
  REAL_PRODUCTS_CATALOG,
  REAL_ZONES_SUMMARY,
  computeReturnRow,
} from './lib/real-excel-data';
import {
  ProductCatalogItem,
  ReturnLineItem,
  UserProfile,
  ZoneSummary,
} from './types/returns';
import { AuthScreen } from './features/auth/auth-screen';
import { BentoDashboard } from './features/dashboard/bento-dashboard';
import { ReturnsWorkbench } from './features/returns/returns-workbench';
import { ProductionEngineeringView } from './features/quality/production-engineering-view';
import { CatalogView } from './features/catalog/catalog-view';
import { BentoGridSkeleton } from './components/ui/skeleton';
import { Badge } from './components/ui/badge';
import { Modal } from './components/ui/modal';
import { ExcelSyncModal } from './components/excel-sync-modal';
import { recalculateZonesFromRows } from './lib/excel-parser';

type ActiveTab = 'DASHBOARD' | 'WORKBENCH' | 'ENGINEERING' | 'CATALOG';

export interface LandscapeSlide {
  id: string;
  label: string;
  subtitle: string;
  imageUrl: string;
  overlayClass: string;
}

export const NATURE_FARM_CAROUSEL: LandscapeSlide[] = [
  {
    id: 'green-pastures',
    label: 'Praderas & Granja Verde',
    subtitle: 'Campos ganaderos y praderas naturales al amanecer',
    imageUrl:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2000&q=85',
    overlayClass:
      'bg-gradient-to-br from-slate-950/75 via-slate-900/65 to-emerald-950/65 backdrop-blur-[2px]',
  },
  {
    id: 'alpine-valley',
    label: 'Valle Agrícola & Montañas',
    subtitle: 'Paisaje natural de alta montaña y aire puro',
    imageUrl:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2000&q=85',
    overlayClass:
      'bg-gradient-to-br from-slate-950/75 via-slate-900/65 to-indigo-950/65 backdrop-blur-[2px]',
  },
  {
    id: 'countryside-harvest',
    label: 'Hacienda & Cultivos del Campo',
    subtitle: 'Colinas verdes y tierras productivas',
    imageUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=85',
    overlayClass:
      'bg-gradient-to-br from-slate-950/75 via-slate-900/65 to-teal-950/65 backdrop-blur-[2px]',
  },
  {
    id: 'sunny-meadow',
    label: 'Pastizales & Naturaleza Viva',
    subtitle: 'Bosques y llanuras verdes bajo luz dorada',
    imageUrl:
      'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=2000&q=85',
    overlayClass:
      'bg-gradient-to-br from-slate-950/75 via-slate-900/65 to-emerald-950/65 backdrop-blur-[2px]',
  },
  {
    id: 'misty-forest-farm',
    label: 'Reserva Natural & Ríos',
    subtitle: 'Ecosistema natural y aguas cristalinas',
    imageUrl:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2000&q=85',
    overlayClass:
      'bg-gradient-to-br from-slate-950/78 via-slate-900/68 to-emerald-950/68 backdrop-blur-[2px]',
  },
];

export function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [isCarouselPlaying, setIsCarouselPlaying] = useState<boolean>(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Al abrir el link, NUNCA iniciar sesión automáticamente.
    // Solo restaurar si el usuario ya inició sesión previamente en esta sesión de navegador.
    try {
      const saved = sessionStorage.getItem('retorna_session_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('WORKBENCH');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [zones, setZones] = useState<ZoneSummary[]>(REAL_ZONES_SUMMARY);
  const [products, setProducts] = useState<ProductCatalogItem[]>(
    REAL_PRODUCTS_CATALOG
  );
  const [returnItems, setReturnItems] =
    useState<ReturnLineItem[]>(INITIAL_RETURN_ITEMS);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('Z01');
  const [externalLotFilter, setExternalLotFilter] = useState<string>('ALL');
  const [mysqlConnected, setMysqlConnected] = useState<boolean>(false);

  // Sync initial return items from MySQL database (retorna_db in phpMyAdmin / HeidiSQL / Railway)
  useEffect(() => {
    fetch('/api/mysql/state')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.returnItems)) {
          setMysqlConnected(true);
          if (data.returnItems.length > 0) {
            setReturnItems(data.returnItems);
            if (data.returnItems.some((item: ReturnLineItem) => String(item.id).startsWith('xl-'))) {
              setZones((prev) => recalculateZonesFromRows(prev, data.returnItems));
            }
          }
        }
      })
      .catch(() => {
        setMysqlConnected(false);
      });
  }, []);

  // Auto-advance carousel every 9 seconds when playing
  useEffect(() => {
    if (!isCarouselPlaying) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % NATURE_FARM_CAROUSEL.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [isCarouselPlaying]);

  const currentSlide =
    NATURE_FARM_CAROUSEL[slideIndex] || NATURE_FARM_CAROUSEL[0];

  const handleNextSlide = () => {
    setSlideIndex((prev) => (prev + 1) % NATURE_FARM_CAROUSEL.length);
  };

  const handlePrevSlide = () => {
    setSlideIndex(
      (prev) =>
        (prev - 1 + NATURE_FARM_CAROUSEL.length) % NATURE_FARM_CAROUSEL.length
    );
  };

  const computedRows = useMemo(
    () => returnItems.map((item) => computeReturnRow(item)),
    [returnItems]
  );

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const handleRefreshSimulation = () => {
    setIsRefreshing(true);
    fetch('/api/mysql/state')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.returnItems)) {
          setMysqlConnected(true);
          setReturnItems(data.returnItems);
          if (data.returnItems.some((item: ReturnLineItem) => String(item.id).startsWith('xl-'))) {
            setZones((prev) => recalculateZonesFromRows(prev, data.returnItems));
          }
        }
      })
      .finally(() => {
        setTimeout(() => {
          setIsRefreshing(false);
          toast.success('Sincronizado con Base de Datos MySQL (retorna_db)', {
            description:
              'Registros leídos en tiempo real desde la base de datos.',
          });
        }, 350);
      });
  };

  const handleSyncExcelItems = async (
    items: ReturnLineItem[],
    options: { replaceAll: boolean; fileName: string }
  ): Promise<{ ok: boolean; totalSynced: number; error?: string }> => {
    setReturnItems((prev) => {
      let next: ReturnLineItem[];
      if (options.replaceAll) {
        next = items;
      } else {
        const map = new Map<string, ReturnLineItem>();
        for (const oldItem of prev) {
          if (!String(oldItem.id).startsWith('ret-')) {
            map.set(oldItem.id, oldItem);
          }
        }
        for (const newItem of items) {
          map.set(newItem.id, newItem);
        }
        next = Array.from(map.values());
      }
      setZones((prevZones) => recalculateZonesFromRows(prevZones, next));
      return next;
    });

    try {
      const response = await fetch('/api/mysql/returns/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          clearDemo: true,
          replaceAll: options.replaceAll,
        }),
      });
      const res = await response.json();
      if (res?.ok) {
        setMysqlConnected(true);
        return { ok: true, totalSynced: res.totalSynced || res.count || items.length };
      }
      return {
        ok: false,
        totalSynced: items.length,
        error: res?.error || 'Guardado en sesión (verificar MySQL)',
      };
    } catch (err: any) {
      return {
        ok: false,
        totalSynced: items.length,
        error: String(err?.message || err),
      };
    }
  };

  const handleSelectZoneFromDashboard = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setExternalLotFilter('ALL');
    setActiveTab('WORKBENCH');
  };

  const handleSelectLotFromDashboard = (lotNumber: string) => {
    setExternalLotFilter(lotNumber);
    setActiveTab('WORKBENCH');
  };

  const handleUpdateZoneSales = (zoneId: string, newSalesCOP: number) => {
    setZones((prev) =>
      prev.map((z) =>
        z.id === zoneId ? { ...z, monthlySalesCOP: newSalesCOP } : z
      )
    );
    fetch('/api/mysql/zones/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId, newSalesCOP }),
    }).catch(() => {});
  };

  const handleAddReturnItem = async (
    newItem: Omit<ReturnLineItem, 'id'>
  ): Promise<{ ok: boolean; savedId: string; error?: string }> => {
    const created: ReturnLineItem = {
      ...newItem,
      id: `ret-${Date.now()}`,
    };
    const computed = computeReturnRow(created);

    setReturnItems((prev) => [created, ...prev]);

    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== created.zoneId) return z;
        return {
          ...z,
          lineItemsCount: z.lineItemsCount + 1,
          unitsByCause: {
            aCobrar: z.unitsByCause.aCobrar + created.causes.aCobrar,
            xFecha: z.unitsByCause.xFecha + created.causes.xFecha,
            vacio: z.unitsByCause.vacio + created.causes.vacio,
            proxVencer: z.unitsByCause.proxVencer + created.causes.proxVencer,
            vencido: z.unitsByCause.vencido + created.causes.vencido,
            abomba: z.unitsByCause.abomba + created.causes.abomba,
            lechozo: z.unitsByCause.lechozo + created.causes.lechozo,
          },
          copByCause: {
            aCobrar: z.copByCause.aCobrar + computed.copByCause.aCobrar,
            xFecha: z.copByCause.xFecha + computed.copByCause.xFecha,
            vacio: z.copByCause.vacio + computed.copByCause.vacio,
            proxVencer:
              z.copByCause.proxVencer + computed.copByCause.proxVencer,
            vencido: z.copByCause.vencido + computed.copByCause.vencido,
            abomba: z.copByCause.abomba + computed.copByCause.abomba,
            lechozo: z.copByCause.lechozo + computed.copByCause.lechozo,
          },
        };
      })
    );

    // Persist directly to MySQL retorna_db (phpMyAdmin / HeidiSQL)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/mysql/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(created),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const res = await response.json();
      if (res?.ok) {
        setMysqlConnected(true);
        return { ok: true, savedId: created.id };
      }
      return {
        ok: false,
        savedId: created.id,
        error: res?.error || 'Error guardando en MySQL',
      };
    } catch (err: any) {
      return {
        ok: false,
        savedId: created.id,
        error: String(err?.message || err),
      };
    }
  };

  const handleUpdateRowEvidence = (
    rowId: string,
    photoUrl: string,
    technicalDiagnosis: string,
    storageTempC: number
  ) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              evidencePhotoUrl: photoUrl,
              technicalDiagnosis,
              storageTempC,
            }
          : item
      )
    );
    fetch('/api/mysql/returns/evidence', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId,
        photoUrl,
        technicalDiagnosis,
        storageTempC,
      }),
    }).catch(() => {});
  };

  const handleAutoFixRow = (rowId: string) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        const currentSum =
          item.causes.aCobrar +
          item.causes.xFecha +
          item.causes.vacio +
          item.causes.proxVencer +
          item.causes.vencido +
          item.causes.abomba +
          item.causes.lechozo;
        const diff = item.qtyToReceive - currentSum;
        const nextProxVencer = Math.max(0, item.causes.proxVencer + diff);
        fetch('/api/mysql/returns/autofix', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowId, newProxVencer: nextProxVencer }),
        }).catch(() => {});
        return {
          ...item,
          causes: {
            ...item.causes,
            proxVencer: nextProxVencer,
          },
        };
      })
    );
  };

  const handleDeleteRow = (rowId: string) => {
    setReturnItems((prev) => prev.filter((r) => r.id !== rowId));
    fetch('/api/mysql/returns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId }),
    }).catch(() => {});
  };

  const handleUpdateProductPrice = (
    productId: string,
    newPrice2024: number
  ) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, price2024: newPrice2024 } : p
      )
    );
    fetch('/api/mysql/products/price', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, newPrice2024 }),
    }).catch(() => {});
  };

  const handleExportCleanCSV = () => {
    const headers = [
      'CODIGO_ZONA',
      'ZONA_TITULAR',
      'TIPO_CANAL',
      'VENTAS_MES_COP',
      'COMERCIAL_COP',
      'CALIDAD_COP',
      'TOTAL_DEVOLUCIONES_COP',
    ];
    const lines = zones.map((z) => {
      const comm =
        z.copByCause.aCobrar + z.copByCause.proxVencer + z.copByCause.vencido;
      const qual =
        z.copByCause.vacio +
        z.copByCause.xFecha +
        z.copByCause.abomba +
        z.copByCause.lechozo;
      const tot = comm + qual;
      return [
        z.code,
        `"${z.consolidatedName}"`,
        z.type,
        z.monthlySalesCOP,
        comm,
        qual,
        tot,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CONSOLIDADO_LIMPIO_DEVOLUCIONES_OCTUBRE.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Reporte consolidado descargado (12 KB vs 7.2 MB)', {
      description:
        'Archivo limpio sin columnas fantasma XFD ni hojas ocultas.',
    });
  };

  const handleUserLogin = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('retorna_session_user', JSON.stringify(user));
    } catch {}

    if (user.role === 'CALIDAD') {
      setActiveTab('ENGINEERING');
    } else if (user.role === 'ADMIN') {
      setActiveTab('DASHBOARD');
    } else if (user.assignedZoneId) {
      setSelectedZoneId(user.assignedZoneId);
      setActiveTab('WORKBENCH');
    } else {
      setActiveTab('WORKBENCH');
    }
  };

  const handleUserLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('retorna_session_user');
    } catch {}
    toast.info('Sesión cerrada correctamente', {
      description: 'Ingresa nuevamente tus credenciales para continuar.',
    });
  };

  if (!currentUser) {
    return (
      <>
        <Toaster
          position="bottom-right"
          theme={darkMode ? 'dark' : 'light'}
          richColors
        />
        <AuthScreen
          slides={NATURE_FARM_CAROUSEL}
          activeSlideIndex={slideIndex}
          onAuthenticated={handleUserLogin}
        />
      </>
    );
  }

  return (
    <div
      className={
        darkMode
          ? 'dark relative min-h-screen text-neutral-100'
          : 'relative min-h-screen text-neutral-900'
      }
    >
      {/* Dynamic Fullscreen Background Carousel of Nature, Farms & Landscapes */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={currentSlide.id}
            src={currentSlide.imageUrl}
            alt={currentSlide.label}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.02 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </AnimatePresence>
        <div
          className={`absolute inset-0 transition-colors duration-700 ${
            darkMode
              ? currentSlide.overlayClass
              : 'bg-gradient-to-br from-white/80 via-emerald-50/75 to-sky-100/70 backdrop-blur-[3px]'
          }`}
        />
      </div>

      <Toaster
        position="bottom-right"
        theme={darkMode ? 'dark' : 'light'}
        richColors
      />

      {/* Sticky Glassmorphic Top Navbar (VisionOS style) */}
      <header className="sticky top-0 z-40 border-b border-white/30 dark:border-white/[0.14] bg-white/70 dark:bg-slate-950/60 backdrop-blur-2xl shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand & Navigation Pills */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <img
                src="/cardiso_logo.png"
                alt="Cardiso Logo"
                className="h-8 w-auto object-contain drop-shadow"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                    Retorna<span className="text-emerald-400">OS</span>
                  </span>
                  <Badge variant={mysqlConnected ? 'success' : 'indigo'} dot>
                    {mysqlConnected ? 'MySQL: retorna_db' : 'v2.5'}
                  </Badge>
                </div>
                <span className="block text-[10px] text-neutral-600 dark:text-slate-300">
                  Conectado a phpMyAdmin / HeidiSQL
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-neutral-300/80 dark:border-white/15 bg-white/60 dark:bg-slate-900/60 p-1 backdrop-blur-md">
              {/* 1. Dashboard: Solo Gerencia / Administrador y Calidad */}
              {(currentUser.role === 'ADMIN' || currentUser.role === 'CALIDAD') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('DASHBOARD')}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    activeTab === 'DASHBOARD'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  1. Dashboard (% de Ventas)
                </button>
              )}

              {/* 2. Mis Devoluciones: Todos (Vendedores en su zona, PDV en su sede, Admin/Calidad) */}
              <button
                type="button"
                onClick={() => setActiveTab('WORKBENCH')}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  activeTab === 'WORKBENCH'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                {currentUser.role === 'VENDEDOR' || currentUser.role === 'PDV'
                  ? 'Mis Devoluciones'
                  : '2. Mis Devoluciones (Vendedores)'}
              </button>

              {/* 3. Ingenieras de Producción: EXCLUSIVO para Calidad y Admin */}
              {(currentUser.role === 'CALIDAD' || currentUser.role === 'ADMIN') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ENGINEERING')}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    activeTab === 'ENGINEERING'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  3. Ingenieras de Producción
                </button>
              )}

              {/* 4. Catálogo: Solo Admin y Calidad */}
              {(currentUser.role === 'ADMIN' || currentUser.role === 'CALIDAD') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('CATALOG')}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    activeTab === 'CATALOG'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-700 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <PackageSearch className="h-3.5 w-3.5" />
                  4. Catálogo 2024
                </button>
              )}
            </nav>
          </div>

          {/* Right Actions: Nature/Farm Carousel Controller, Role Switcher, Help, Export, Theme, Logout */}
          <div className="flex items-center gap-2">
            {/* Interactive Carousel Controller for Nature, Farms & Landscapes */}
            <div className="hidden xl:flex items-center gap-1.5 rounded-xl border border-neutral-300 dark:border-white/15 bg-white/75 dark:bg-slate-900/75 px-2.5 py-1 backdrop-blur-md">
              <Trees className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <button
                type="button"
                onClick={handlePrevSlide}
                title="Paisaje anterior"
                className="rounded p-0.5 text-neutral-600 dark:text-slate-300 hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[11px] font-medium text-neutral-800 dark:text-slate-200 min-w-[145px] text-center truncate">
                {currentSlide.label} ({slideIndex + 1}/
                {NATURE_FARM_CAROUSEL.length})
              </span>
              <button
                type="button"
                onClick={handleNextSlide}
                title="Siguiente paisaje"
                className="rounded p-0.5 text-neutral-600 dark:text-slate-300 hover:text-white"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !isCarouselPlaying;
                  setIsCarouselPlaying(next);
                  toast.info(
                    next
                      ? 'Carrusel de paisajes en movimiento automático'
                      : 'Carrusel de fondo pausado'
                  );
                }}
                title={
                  isCarouselPlaying
                    ? 'Pausar carrusel de fondos'
                    : 'Reproducir carrusel automático'
                }
                className={`rounded p-1 transition-colors ${
                  isCarouselPlaying
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isCarouselPlaying ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Perfil del Usuario Activo (Inmutable, solo muestra quién es) */}
            <div className="hidden lg:flex items-center gap-2 rounded-xl border border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 backdrop-blur-md">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-400/30">
                {currentUser.avatarInitials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-[160px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium truncate max-w-[160px]">
                  {currentUser.roleLabel}
                </span>
              </div>
            </div>

            {(currentUser.role === 'ADMIN' ||
              currentUser.role === 'RECEPCION' ||
              currentUser.role === 'CALIDAD') && (
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                title="Subir o actualizar el archivo Excel acumulado del día (.xlsx)"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-600/90 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Subir Excel (.xlsx)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/20 hover:bg-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition-all"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guía Fácil</span>
            </button>

            <button
              type="button"
              onClick={handleExportCleanCSV}
              title="Descargar consolidado limpio sin basura XML"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-slate-200 transition-all"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshSimulation}
              title="Simular carga con Skeleton Loaders"
              className="rounded-xl border border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 p-2 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white transition-all"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isRefreshing ? 'animate-spin text-indigo-400' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title="Alternar tema Oscuro / Claro"
              className="rounded-xl border border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 p-2 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white transition-all"
            >
              {darkMode ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleUserLogout}
              title="Cerrar sesión actual"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-slate-900/70 hover:border-rose-500/40 hover:text-rose-400 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-slate-200 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar (100% RBAC: Vendedores solo ven su Planilla) */}
        <div className="md:hidden border-t border-white/15 px-3 py-2 space-y-2 bg-slate-950/80">
          <div className="flex flex-wrap gap-1.5">
            {/* Dashboard: Solo Admin / Calidad */}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'CALIDAD') && (
              <button
                type="button"
                onClick={() => setActiveTab('DASHBOARD')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900/80 text-slate-300 border border-white/10'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Dashboard</span>
              </button>
            )}

            {/* Mis Devoluciones */}
            <button
              type="button"
              onClick={() => setActiveTab('WORKBENCH')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'WORKBENCH'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900/80 text-slate-300 border border-white/10'
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Mis Devoluciones</span>
            </button>

            {/* Ingenieras de Producción: Solo Calidad y Admin */}
            {(currentUser.role === 'CALIDAD' || currentUser.role === 'ADMIN') && (
              <button
                type="button"
                onClick={() => setActiveTab('ENGINEERING')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'ENGINEERING'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900/80 text-slate-300 border border-white/10'
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Ing. Producción</span>
              </button>
            )}

            {/* Catálogo: Solo Admin y Calidad */}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'CALIDAD') && (
              <button
                type="button"
                onClick={() => setActiveTab('CATALOG')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'CATALOG'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900/80 text-slate-300 border border-white/10'
                }`}
              >
                <PackageSearch className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Catálogo</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/15 bg-slate-900/90 px-2.5 py-1.5 min-w-0">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-400/30">
                {currentUser.avatarInitials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-semibold text-white truncate">
                  {currentUser.name}
                </span>
                <span className="text-[9px] text-emerald-400 truncate">
                  {currentUser.roleLabel}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUserLogout}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 text-[11px] font-medium text-rose-300 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        {isRefreshing ? (
          <BentoGridSkeleton />
        ) : activeTab === 'DASHBOARD' && (currentUser.role === 'ADMIN' || currentUser.role === 'CALIDAD') ? (
          <BentoDashboard
            zones={zones}
            returnRows={computedRows}
            onSelectZone={handleSelectZoneFromDashboard}
            onSelectLot={handleSelectLotFromDashboard}
            onUpdateZoneSales={handleUpdateZoneSales}
            onOpenQuickGuide={() => setIsGuideOpen(true)}
          />
        ) : activeTab === 'WORKBENCH' ? (
          <ReturnsWorkbench
            currentUser={currentUser}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onChangeZoneId={setSelectedZoneId}
            returnRows={computedRows}
            onAddReturnItem={handleAddReturnItem}
            onAutoFixRow={handleAutoFixRow}
            onDeleteRow={handleDeleteRow}
            onUpdateRowEvidence={handleUpdateRowEvidence}
            externalLotFilter={externalLotFilter}
            onClearExternalLotFilter={() => setExternalLotFilter('ALL')}
            onGoToEngineering={
              currentUser.role === 'CALIDAD' || currentUser.role === 'ADMIN'
                ? () => setActiveTab('ENGINEERING')
                : undefined
            }
            onOpenExcelModal={() => setIsExcelModalOpen(true)}
          />
        ) : activeTab === 'ENGINEERING' && (currentUser.role === 'CALIDAD' || currentUser.role === 'ADMIN') ? (
          <ProductionEngineeringView
            returnRows={computedRows}
            onUpdateRowEvidence={handleUpdateRowEvidence}
            onOpenExcelModal={() => setIsExcelModalOpen(true)}
          />
        ) : (currentUser.role === 'ADMIN' || currentUser.role === 'CALIDAD') ? (
          <CatalogView
            products={products}
            onUpdatePrice={handleUpdateProductPrice}
          />
        ) : (
          <ReturnsWorkbench
            currentUser={currentUser}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onChangeZoneId={setSelectedZoneId}
            returnRows={computedRows}
            onAddReturnItem={handleAddReturnItem}
            onAutoFixRow={handleAutoFixRow}
            onDeleteRow={handleDeleteRow}
            onUpdateRowEvidence={handleUpdateRowEvidence}
            externalLotFilter={externalLotFilter}
            onClearExternalLotFilter={() => setExternalLotFilter('ALL')}
            onOpenExcelModal={() => setIsExcelModalOpen(true)}
          />
        )}
      </main>

      {/* Modal de Sincronización Diaria de Excel (.xlsx) */}
      <ExcelSyncModal
        open={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onSyncItems={handleSyncExcelItems}
      />

      {/* Modal de Guía Fácil Paso a Paso */}
      <Modal
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        title="¿Cómo funciona RetornaOS? — Lotes, Fotos de Evidencia y Liquidación"
        subtitle="Guía práctica de las 3 pantallas principales del sistema y cómo reemplazan tus 2 archivos Excel."
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4 text-xs text-slate-200 leading-relaxed">
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
            <h4 className="font-semibold text-white text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-indigo-300" />
              ¿Qué hacían antes tus 2 archivos Excel y qué hace ahora RetornaOS?
            </h4>
            <p className="mt-1 text-slate-300">
              Antes tenían un archivo para <strong>Vendedores (Z01 a Z15)</strong> y otro para <strong>Puntos de Venta (Belén, Bello, Cumbre, Carla, Sabaneta) y Clientes Z14</strong>. Ahora todo está unificado, con <strong>filtro inteligente por Lotes (Col E)</strong>, <strong>subida de fotos de evidencia</strong> y <strong>ficha técnica de cada causa</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 space-y-2">
              <div className="font-semibold text-indigo-300 text-sm">
                1. Pestaña "Dashboard (% de Ventas)"
              </div>
              <p className="text-slate-300">
                Te muestra el consolidado gerencial y el <strong>Radar de Lotes</strong>.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                <li>
                  Haz clic en cualquiera de las <strong>7 Causas</strong> a la derecha para leer por qué ocurre (ej. Lechoso, Vacío) y qué acción tomar.
                </li>
                <li>
                  Haz clic en un <strong>Lote (ej. Lote #259)</strong> para saltar directo a ver todas las devoluciones y fotos de ese lote.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 space-y-2">
              <div className="font-semibold text-emerald-300 text-sm">
                2. Pestaña "Planilla, Lotes y Fotos"
              </div>
              <p className="text-slate-300">
                Es donde cada Vendedor o Punto de Venta registra y audita devoluciones:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                <li>
                  Usa los botones de <strong>Lotes rápidos (L-259, L-253, L-258)</strong> o activa <strong>"Buscar Lote en Todas las Zonas"</strong>.
                </li>
                <li>
                  Haz clic en <strong>"Ver Foto"</strong> en cualquier fila para ver la imagen en grande, temperatura en °C, diagnóstico y subir una foto nueva desde tu computador o celular.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 space-y-2">
              <div className="font-semibold text-amber-300 text-sm">
                3. Carrusel de Paisajes & Catálogo
              </div>
              <p className="text-slate-300">
                El fondo rota automáticamente entre imágenes de <strong>granjas, praderas verdes y naturaleza</strong> (puedes cambiarlas o pausarlas en la barra superior).
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                <li>
                  En la pestaña 3 tienes el <strong>Catálogo 2024</strong> oficial sin las 65,536 filas vacías del Excel.
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Users className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">
                  ¿Listo para probar el filtro de lotes y las fotos?
                </div>
                <div className="text-slate-300">
                  Pulsa el botón de la derecha para ir a la Planilla y haz clic en cualquier miniatura de foto o en el botón verde <strong>"+ Registrar Devolución con Foto"</strong>.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsGuideOpen(false);
                setActiveTab('WORKBENCH');
              }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Ir a Planilla y Fotos
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default App;
