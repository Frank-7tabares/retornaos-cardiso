export type UserRole = 'ADMIN' | 'CALIDAD' | 'RECEPCION' | 'VENDEDOR' | 'PDV';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  assignedZoneId?: string;
  avatarInitials: string;
  status: 'ACTIVO' | 'PENDIENTE_APROBACION';
  passwordHash?: string; // Para validación de contraseña en Login
}

export type ZoneType = 'RUTA_VENDEDOR' | 'CLIENTE_ESPECIAL_Z14' | 'PUNTO_DE_VENTA';

export type ReturnCauseKey =
  | 'aCobrar'      // G: A COBRAR (Comercial)
  | 'xFecha'       // H: X FECHA (Calidad)
  | 'vacio'        // I: VACIO (Calidad)
  | 'proxVencer'   // J: PR/V (Comercial)
  | 'vencido'      // K: VENCIDO (Comercial)
  | 'abomba'       // L: ABOMBA (Calidad)
  | 'lechozo';     // M: LECHOZO (Calidad)

export type MovementType =
  | 'AVERIA_DEVOLUCION'
  | 'DEGUSTACION'
  | 'REINGRESO_BUENO'
  | 'CAMBIO_FACTURA';

export interface ProductCatalogItem {
  id: string;
  sku: string;
  name: string;
  category: 'Chorizos' | 'Jamones y Mortadelas' | 'Salchichas y Salchichones' | 'Butifarras y Longanizas' | 'Especialidades Cárnicas';
  price2024: number;    // LISTA PDTOS 2024 (Int Precio5 actual)
  priceHasta15: number; // LISTA PDTOS HASTA 15 (Histórico)
  active: boolean;
}

export interface ZoneSummary {
  id: string;
  code: string;
  sheetName: string;          // Nombre pestaña actual en el Excel (ej. Z02 LUISA RESTREPO)
  consolidatedName: string;   // Nombre en % DE VENTAS (ej. Z02 OSCAR VILLADIEGO)
  currentSeller: string;
  type: ZoneType;
  monthlySalesCOP: number;    // Columna VENTAS MES en % DE VENTAS
  lineItemsCount: number;     // Filas reales registradas en la hoja
  unitsByCause: Record<ReturnCauseKey, number>;
  copByCause: Record<ReturnCauseKey, number>; // Columnas ocultas Q..W en el Excel
}

export interface ReturnLineItem {
  id: string;
  date: string;               // Col A: FECHA (YYYY-MM-DD)
  zoneId: string;
  zoneName: string;
  clientName: string;         // Col B: CLIENTE
  productId: string;
  productName: string;        // Col C: PRODUCTO
  qtyToReceive: number;       // Col D: CANTIDAD A RECIBIR
  lotNumber: string;          // Col E: LOTE
  productExpiryDate: string;  // Col F: FECHA PDTO
  causes: Record<ReturnCauseKey, number>; // Cols G..M
  unitCost: number;           // Col O: COSTO / PDTO (VLOOKUP a LISTA PDTOS 2024)
  movementType: MovementType;
  invoiceRef?: string;        // Ej: fact#555543
  observations: string;       // Col P: Nota limpia separada del validador
  createdBy: string;
  evidencePhotoUrl?: string;  // Foto de evidencia del producto/lote/empaque
  technicalDiagnosis?: string;// Diagnóstico detallado de la causa de devolución
  storageTempC?: number;      // Temperatura registrada al recibir (°C)
}

export interface ComputedReturnRow extends ReturnLineItem {
  totalClassifiedUnits: number;           // Col N: =SUM(A COBRAR : LECHOZO)
  reconciliationStatus: 'CUADRADO' | 'REVISAR' | 'JUSTIFICADO_NO_AVERIA'; // Col P fórmula =IF(D=N,"","REVISAR")
  discrepancyUnits: number;               // D - N
  copByCause: Record<ReturnCauseKey, number>; // Columnas ocultas Q..W: causa * unitCost
  totalValueCOP: number;                  // Suma Q..W
  commercialValueCOP: number;             // POR COBRAR + PROX/VENCER + VENCIDO
  qualityValueCOP: number;                // VACIO + X FECHA + ABOMBA + LECHOZO
  primaryCauseKey: ReturnCauseKey | null; // Causa predominante en la fila
}
