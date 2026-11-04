/**
 * Middleware de Seguridad Empresarial (JWT + RBAC + Row-Level Zone Isolation)
 * Garantiza que cada Vendedor (Z01..Z15) o Punto de Venta solo opere sobre su ruta asignada.
 */

export type Role = 'ADMIN' | 'CALIDAD' | 'RECEPCION' | 'VENDEDOR' | 'PDV';

export interface AuthenticatedContext {
  userId: string;
  email: string;
  role: Role;
  assignedZoneId?: string;
  ipAddress: string;
}

/**
 * Verifica si un usuario tiene permiso de lectura/escritura sobre una Zona o Punto de Venta
 */
export function assertZoneAccess(
  ctx: AuthenticatedContext,
  targetZoneId: string,
  operation: 'READ' | 'WRITE' | 'EDIT_SALES'
): void {
  if (operation === 'EDIT_SALES' && ctx.role !== 'ADMIN') {
    throw new Error(
      'FORBIDDEN: Solo el rol ADMIN / Gerencia puede modificar el presupuesto VENTAS MES.'
    );
  }

  if (ctx.role === 'ADMIN' || ctx.role === 'CALIDAD' || ctx.role === 'RECEPCION') {
    return;
  }

  if (
    (ctx.role === 'VENDEDOR' || ctx.role === 'PDV') &&
    ctx.assignedZoneId !== targetZoneId
  ) {
    throw new Error(
      `FORBIDDEN_ZONE_ACCESS: El usuario con rol ${ctx.role} solo tiene acceso a su zona asignada (${ctx.assignedZoneId}).`
    );
  }
}
