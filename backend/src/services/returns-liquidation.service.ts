/**
 * Servicio Backend de Liquidación de Devoluciones (Reemplazo de fórmulas ocultas Q..W y % DE VENTAS)
 */

export interface ReturnCausesInput {
  aCobrar: number;
  xFecha: number;
  vacio: number;
  proxVencer: number;
  vencido: number;
  abomba: number;
  lechozo: number;
}

export interface LiquidatedReturnResult {
  totalClassifiedUnits: number;
  reconciliationStatus: 'CUADRADO' | 'REVISAR' | 'JUSTIFICADO_NO_AVERIA';
  discrepancyUnits: number;
  hiddenColumnsCOP: {
    porCobrar: number;     // Col Q
    porFecha: number;      // Col R
    porVacio: number;      // Col S
    porProxVencer: number; // Col T
    porVencido: number;    // Col U
    porAbom: number;       // Col V
    porLechozo: number;    // Col W
  };
  commercialCOP: number;   // POR COBRAR + PROX / VENCER + VENCIDO
  qualityCOP: number;      // VACIO + FECHA + ABOMBAMIENTO + LECHOZO
  totalCOP: number;
}

export function liquidateReturnLine(params: {
  qtyToReceive: number;
  unitCostCOP: number;
  causes: ReturnCausesInput;
  movementType: 'AVERIA_DEVOLUCION' | 'CAMBIO_FACTURA' | 'DEGUSTACION' | 'REINGRESO_BUENO';
}): LiquidatedReturnResult {
  const { qtyToReceive, unitCostCOP, causes, movementType } = params;

  const totalClassifiedUnits =
    causes.aCobrar +
    causes.xFecha +
    causes.vacio +
    causes.proxVencer +
    causes.vencido +
    causes.abomba +
    causes.lechozo;

  const hiddenColumnsCOP = {
    porCobrar: causes.aCobrar * unitCostCOP,
    porFecha: causes.xFecha * unitCostCOP,
    porVacio: causes.vacio * unitCostCOP,
    porProxVencer: causes.proxVencer * unitCostCOP,
    porVencido: causes.vencido * unitCostCOP,
    porAbom: causes.abomba * unitCostCOP,
    porLechozo: causes.lechozo * unitCostCOP,
  };

  const commercialCOP =
    hiddenColumnsCOP.porCobrar +
    hiddenColumnsCOP.porProxVencer +
    hiddenColumnsCOP.porVencido;

  const qualityCOP =
    hiddenColumnsCOP.porVacio +
    hiddenColumnsCOP.porFecha +
    hiddenColumnsCOP.porAbom +
    hiddenColumnsCOP.porLechozo;

  const totalCOP = commercialCOP + qualityCOP;

  let reconciliationStatus: LiquidatedReturnResult['reconciliationStatus'] =
    'CUADRADO';

  if (qtyToReceive !== totalClassifiedUnits) {
    if (
      totalClassifiedUnits === 0 &&
      (movementType === 'DEGUSTACION' || movementType === 'REINGRESO_BUENO')
    ) {
      reconciliationStatus = 'JUSTIFICADO_NO_AVERIA';
    } else {
      reconciliationStatus = 'REVISAR';
    }
  }

  return {
    totalClassifiedUnits,
    reconciliationStatus,
    discrepancyUnits: qtyToReceive - totalClassifiedUnits,
    hiddenColumnsCOP,
    commercialCOP,
    qualityCOP,
    totalCOP,
  };
}
