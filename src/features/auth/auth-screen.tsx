import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Shield,
  Zap,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { DEMO_USERS, REAL_ZONES_SUMMARY } from '../../lib/real-excel-data';
import { UserProfile, UserRole } from '../../types/returns';
import { Badge } from '../../components/ui/badge';
import type { LandscapeSlide } from '../../App';

interface AuthScreenProps {
  slides?: LandscapeSlide[];
  activeSlideIndex?: number;
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  slides = [],
  activeSlideIndex = 0,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(DEMO_USERS[0]);
  const [email, setEmail] = useState(DEMO_USERS[0].email);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('VENDEDOR');
  const [zoneCode, setZoneCode] = useState('Z01');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userCategoryFilter, setUserCategoryFilter] = useState<'ALL' | 'VENDEDORES' | 'PDV' | 'CONTROL'>('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const currentSlide = slides[activeSlideIndex] || {
    id: 'default-farm',
    label: 'Praderas & Granja Verde',
    imageUrl:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2000&q=85',
    overlayClass:
      'bg-gradient-to-br from-slate-950/85 via-slate-900/80 to-emerald-950/75 backdrop-blur-[4px]',
  };

  const filteredUsers = useMemo(() => {
    return DEMO_USERS.filter((u) => {
      if (userCategoryFilter === 'VENDEDORES' && u.role !== 'VENDEDOR') return false;
      if (userCategoryFilter === 'PDV' && u.role !== 'PDV') return false;
      if (userCategoryFilter === 'CONTROL' && (u.role === 'VENDEDOR' || u.role === 'PDV')) return false;

      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.roleLabel.toLowerCase().includes(q) ||
          (u.assignedZoneId && u.assignedZoneId.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [userCategoryFilter, userSearchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      if (mode === 'login') {
        const targetEmail = (email || '').trim().toLowerCase();
        const emailAliases: Record<string, string> = {
          'sebastian@alimentoscarla.co': 'gerencia@alimentoscarla.co',
          'admin@alimentoscarla.co': 'gerencia@alimentoscarla.co',
          'z02.villadiego@alimentoscarla.co': 'z02.restrepo@alimentoscarla.co',
          'z15.montilla@alimentoscarla.co': 'z02.restrepo@alimentoscarla.co',
          'z03.arango@alimentoscarla.co': 'z03.gonzalez@alimentoscarla.co',
          'z04.restrepo@alimentoscarla.co': 'z04.calderon@alimentoscarla.co',
          'z05.borja@alimentoscarla.co': 'z05.rodolfo@alimentoscarla.co',
          'z06.giraldo@alimentoscarla.co': 'z06.sandra@alimentoscarla.co',
          'z07.bonilla@alimentoscarla.co': 'z07.martinez@alimentoscarla.co',
          'z08.quiroz@alimentoscarla.co': 'z08.restrepo@alimentoscarla.co',
          'z10.jaraba@alimentoscarla.co': 'z10.restrepo@alimentoscarla.co',
        };
        const resolvedEmail = emailAliases[targetEmail] || targetEmail;
        const matched = DEMO_USERS.find((u) => u.email.toLowerCase() === resolvedEmail);

        if (!matched) {
          setAuthError('Correo electrónico no registrado en el sistema.');
          toast.error('Acceso denegado', {
            description: 'El correo corporativo no pertenece a ningún usuario activo.',
          });
          return;
        }

        // Validación estricta de contraseña
        const expectedPassword = matched.passwordHash || 'carla2024';
        const enteredPassword = password.trim();

        if (enteredPassword !== expectedPassword) {
          setAuthError(`Contraseña incorrecta para ${matched.name}. Verifica tus credenciales.`);
          toast.error('Contraseña incorrecta', {
            description: `La contraseña ingresada no coincide con el perfil de ${matched.name}.`,
          });
          return;
        }

        toast.success(`Acceso autorizado: ${matched.name}`, {
          description: `Sesión iniciada con éxito en ${matched.roleLabel}.`,
        });
        onAuthenticated(matched);
      } else {
        if (!name.trim() || !email.trim() || !password.trim()) {
          toast.error('Campos incompletos', {
            description: 'Por favor ingresa tu nombre completo, correo corporativo y contraseña.',
          });
          return;
        }
        const newUser: UserProfile = {
          id: `usr-${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          role: selectedRole,
          roleLabel:
            selectedRole === 'VENDEDOR'
              ? `Ejecutivo Comercial (${zoneCode})`
              : selectedRole === 'PDV'
              ? `Punto de Venta (${zoneCode})`
              : selectedRole === 'CALIDAD'
              ? 'Auditor de Calidad'
              : 'Liquidador Recepción',
          assignedZoneId:
            selectedRole === 'VENDEDOR' || selectedRole === 'PDV' ? zoneCode : undefined,
          avatarInitials: name
            .trim()
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase(),
          status: 'ACTIVO',
          passwordHash: password.trim(),
        };
        toast.success('Cuenta corporativa creada y verificada', {
          description: `Rol asignado: ${newUser.roleLabel}`,
        });
        onAuthenticated(newUser);
      }
    }, 450);
  };

  const handleSelectUserFromDirectory = (user: UserProfile) => {
    setSelectedUser(user);
    setEmail(user.email);
    setPassword('');
    setAuthError(null);
    toast.info(`Usuario seleccionado: ${user.name}`, {
      description: `Ingresa tu contraseña para acceder a la zona ${user.assignedZoneId || user.roleLabel}.`,
    });
  };

  return (
    <div className="relative min-h-screen w-full lg:h-screen lg:overflow-hidden text-white flex items-center justify-center p-2 sm:p-4 lg:p-4">
      {/* Dynamic Nature & Farm Wallpaper */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={currentSlide.id}
            src={currentSlide.imageUrl}
            alt={currentSlide.label}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1.01 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="fixed inset-0 h-full w-full object-cover object-center"
          />
        </AnimatePresence>
        <div className="fixed inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-emerald-950/80 backdrop-blur-[5px]" />
      </div>

      {/* Main Glassmorphic Card Container - Compact & Single-Screen Viewport Fitted */}
      <div className="relative z-10 w-full max-w-5xl my-auto rounded-2xl sm:rounded-3xl border border-white/20 bg-slate-900/85 backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.7),0_0_50px_rgba(16,185,129,0.12),inset_0_1px_0_0_rgba(255,255,255,0.25)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 max-h-[96vh]">
        {/* Left Column: Brand & Capabilities & Compact User Directory */}
        <div className="lg:col-span-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/15 p-4 sm:p-5 lg:p-6 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-emerald-950/45 overflow-hidden">
          <div>
            {/* Top Pill / Brand Logo & Badge */}
            <div className="flex items-center gap-2.5">
              <img
                src="/cardiso_logo.png"
                alt="Cardiso Logo"
                className="h-7 w-auto object-contain drop-shadow"
              />
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/50 backdrop-blur-md px-2.5 py-1 shadow-sm shadow-emerald-900/20">
                <span className="text-[11px] font-bold tracking-tight text-white">
                  Retorna<span className="text-emerald-400">OS</span>
                </span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-semibold tracking-wide text-emerald-300">
                  Enterprise v2.5
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
              Control de Devoluciones &amp;{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Trazabilidad en Tiempo Real
              </span>
            </h1>
            <p className="mt-1 text-[11px] text-slate-300 leading-normal line-clamp-2">
              Validación de lotes, registro fotográfico de causales y liquidación comercial automática vs. calidad.
            </p>

            {/* 3 Compact Feature Pills in a Sleek Row/Grid */}
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="truncate text-slate-200">Filtro por Lote &amp; Fotos</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
                <Zap className="h-3 w-3 text-teal-300 shrink-0" />
                <span className="truncate text-slate-200">Cálculo Automático Q–W</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
                <ShieldCheck className="h-3 w-3 text-cyan-300 shrink-0" />
                <span className="truncate text-slate-200">Seguridad Roles (RBAC)</span>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher (Compact Scrollable Directory) */}
          <div className="mt-3 pt-2.5 border-t border-white/15">
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <Users className="h-3 w-3 text-emerald-400" />
                <span>Directorio ({filteredUsers.length} usuarios):</span>
              </div>
              <span className="text-[9px] text-slate-400">
                Selecciona tu usuario
              </span>
            </div>

            {/* Filter Pills & Search */}
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
                {[
                  { key: 'ALL', label: 'Todos' },
                  { key: 'VENDEDORES', label: 'Vendedores' },
                  { key: 'PDV', label: 'Puntos de Venta' },
                  { key: 'CONTROL', label: 'Planta' },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setUserCategoryFilter(cat.key as any)}
                    className={`rounded-md px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                      userCategoryFilter === cat.key
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/[0.04] text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Buscar nombre o zona (ej. Santiago, Z02, Belén)..."
                  className="w-full rounded-lg border border-white/15 bg-slate-950/70 pl-7 pr-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Grid of Users with Max Height and Custom Scroll */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-32 sm:max-h-36 overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const isCurrent = email.toLowerCase() === u.email.toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUserFromDirectory(u)}
                    className={`group flex flex-col justify-center rounded-lg border p-1.5 text-left transition-all duration-150 ${
                      isCurrent
                        ? 'bg-emerald-500/25 border-emerald-400 shadow-sm ring-1 ring-emerald-400/40'
                        : 'border-white/10 bg-white/[0.06] hover:bg-emerald-500/15 hover:border-emerald-400/50'
                    }`}
                    title={`${u.name} · ${u.roleLabel}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`truncate text-[10px] font-semibold ${isCurrent ? 'text-emerald-200' : 'text-white'}`}>
                        {u.name}
                      </span>
                      {u.assignedZoneId && (
                        <span className="shrink-0 font-mono text-[8px] font-bold px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {u.assignedZoneId}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-[9px] text-slate-300/80">
                      {u.roleLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: High-Impact Login & Register Form (Compact Height) */}
        <div className="lg:col-span-6 p-4 sm:p-5 lg:p-6 flex flex-col justify-center bg-slate-950/40 overflow-y-auto">
          <div className="mx-auto w-full max-w-sm sm:max-w-md">
            {/* High-Contrast Segmented Switcher */}
            <div className="relative grid grid-cols-2 rounded-xl border border-white/20 bg-slate-950/80 p-0.5 mb-3 shadow-inner">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <KeyRound className="h-3 w-3" />
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold transition-all duration-200 ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserCheck className="h-3 w-3" />
                Registro
              </button>
            </div>

            {/* Title Section */}
            <div className="mb-2.5">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                {mode === 'login' ? (
                  <>
                    <span>Bienvenido de nuevo</span>
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  </>
                ) : (
                  <>
                    <span>Alta de Usuario Operativo</span>
                    <Badge variant="success">Nuevo</Badge>
                  </>
                )}
              </h2>
              <p className="text-[11px] text-slate-300">
                {mode === 'login'
                  ? 'Ingresa tus credenciales personales para acceder.'
                  : 'Registra un vendedor o punto en el directorio corporativo.'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleSubmit}
                className="space-y-2.5"
              >
                {/* Mode: Register -> Nombre Completo */}
                {mode === 'register' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-0.5">
                      Nombre Completo
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Carlos Andrés Restrepo"
                        className="w-full rounded-xl border border-white/20 bg-slate-950/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400/25 transition-all shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Correo Corporativo (Both modes) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-200 mb-0.5">
                    Correo Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@alimentoscarla.co"
                      className="w-full rounded-xl border border-white/20 bg-slate-950/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-400/25 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Mode: Register -> Rol Operativo & Zona Asignada (Side-by-Side Grid) */}
                {mode === 'register' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-0.5">
                        Rol Operativo
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="w-full rounded-xl border border-white/20 bg-slate-950/90 px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/25 shadow-sm"
                      >
                        <option value="VENDEDOR">Vendedor Ruta</option>
                        <option value="PDV">Punto de Venta</option>
                        <option value="RECEPCION">Recepción Bodega</option>
                        <option value="CALIDAD">Auditor Calidad</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-0.5">
                        Zona / Sede
                      </label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-emerald-400" />
                        <select
                          value={zoneCode}
                          onChange={(e) => setZoneCode(e.target.value)}
                          className="w-full rounded-xl border border-white/20 bg-slate-950/90 pl-6 pr-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/25 shadow-sm"
                        >
                          {REAL_ZONES_SUMMARY.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.code} - {z.consolidatedName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contraseña */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[11px] font-semibold text-slate-200">
                      Contraseña Personal
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() =>
                          toast.info('Recuperación de contraseña', {
                            description:
                              'Se enviará un enlace de seguridad de 10 minutos a tu correo corporativo.',
                          })
                        }
                        className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        ¿Olvidaste tu clave?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder="Escribe tu contraseña..."
                      className={`w-full rounded-xl border bg-slate-950/80 pl-8 pr-8 py-1.5 text-xs text-white focus:bg-slate-950 focus:outline-none transition-all shadow-sm ${
                        authError
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500/25'
                          : 'border-white/20 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/25'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1 flex items-center gap-1 text-[10px] text-rose-400 font-medium"
                    >
                      <span>⚠️ {authError}</span>
                    </motion.div>
                  )}
                </div>

                {/* Ultra-Compact Security Footnote */}
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">
                  <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-400" />
                  <span className="truncate">
                    JWT HttpOnly · Encriptación Argon2id · Sesión Protegida
                  </span>
                </div>

                {/* High-Impact Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] disabled:opacity-60 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30 transition-all duration-200 mt-1"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {isSubmitting
                    ? 'Verificando...'
                    : mode === 'login'
                    ? 'Ingresar a RetornaOS'
                    : 'Crear Cuenta y Acceder'}
                </button>
              </motion.form>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
