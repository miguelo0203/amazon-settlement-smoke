/**
 * Automated Verification Suite (Section 21 Requirements + Section 7 Audit)
 * Tests all 11 edge cases and validates parser determinism.
 */

const fs = require('fs');
const path = require('path');
const { parseSettlementReport } = require('../parser.js');

const fixturesDir = path.join(__dirname, 'fixtures');

// Generate Test 11 Fixture if it does not exist
const test11Path = path.join(fixturesDir, 'test11_unknown_concept.txt');
if (!fs.existsSync(test11Path)) {
  const headers = [
    'settlement-id', 'settlement-start-date', 'settlement-end-date', 'deposit-date',
    'total-amount', 'currency', 'transaction-type', 'order-id', 'merchant-order-id',
    'adjustment-id', 'shipment-id', 'marketplace-name', 'amount-type', 'amount-description',
    'amount', 'fulfillment-id', 'posted-date', 'posted-date-time', 'order-item-code',
    'merchant-order-item-id', 'merchant-adjustment-item-id', 'sku', 'quantity-purchased', 'promotion-id'
  ];
  const summaryRow = ['99112233', '2026-09-01', '2026-09-15', '2026-09-17', '180,00', 'EUR'].concat(new Array(18).fill(''));
  const normalRow = ['99112233', '', '', '', '', 'EUR', 'Order', '101', '', '', '', 'Amazon.es', 'ItemPrice', 'Principal', '200,00'].concat(new Array(9).fill(''));
  const unknownRow = ['99112233', '', '', '', '', 'EUR', 'ServiceFee', '', '', '', '', 'Amazon.es', 'CustomPlatformTariff', 'UnknownSpecialFee', '-20,00'].concat(new Array(9).fill(''));
  
  const content = headers.join('\t') + '\n' + summaryRow.join('\t') + '\n' + normalRow.join('\t') + '\n' + unknownRow.join('\t') + '\n';
  fs.writeFileSync(test11Path, content, 'utf-8');
}

const tests = [
  {
    id: 1,
    name: 'Test 1: Archivo válido Amazon V2 (con órdenes, FBA, comisiones, publicidad, reservas)',
    file: 'test1_valid_v2_comma.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: ${result.message}`;
      if (!result.summary.isBalanced) return `Fallo: Descuadre de ${result.summary.difference} EUR`;
      if (result.meta.totalOrders !== 30) return `Fallo: Se esperaban 30 pedidos, detectados ${result.meta.totalOrders}`;
      if (result.meta.currency !== 'EUR') return `Fallo: Moneda no es EUR`;
      return null;
    }
  },
  {
    id: 2,
    name: 'Test 2: Archivo vacío',
    file: 'test2_empty.txt',
    verify: (result) => {
      if (result.success) return 'Fallo: Debería haber fallado con archivo vacío';
      if (result.errorCode !== 'ARCHIVO_VACIO') return `Fallo: Código de error esperado ARCHIVO_VACIO, recibido ${result.errorCode}`;
      return null;
    }
  },
  {
    id: 3,
    name: 'Test 3: Archivo incorrecto / texto plano sin cabeceras',
    file: 'test3_malformed.txt',
    verify: (result) => {
      if (result.success) return 'Fallo: Debería haber fallado con archivo malformado';
      if (result.errorCode !== 'FORMATO_NO_RECONOCIDO') return `Fallo: Código de error esperado FORMATO_NO_RECONOCIDO, recibido ${result.errorCode}`;
      return null;
    }
  },
  {
    id: 4,
    name: 'Test 4: CSV que no sea Amazon (extracto bancario con comas)',
    file: 'test4_non_amazon_bank.csv',
    verify: (result) => {
      if (result.success) return 'Fallo: Debería haber detectado que es un CSV bancario no compatible';
      if (result.errorCode !== 'FORMATO_NO_RECONOCIDO') return `Fallo: Código de error esperado FORMATO_NO_RECONOCIDO, recibido ${result.errorCode}`;
      return null;
    }
  },
  {
    id: 5,
    name: 'Test 5: Detección de moneda no-EUR (USD)',
    file: 'test5_currency_usd.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (result.meta.currency !== 'USD') return `Fallo: Se esperaba divisa USD, detectada ${result.meta.currency}`;
      if (result.meta.isEur !== false) return `Fallo: isEur debería ser false`;
      return null;
    }
  },
  {
    id: 6,
    name: 'Test 6: Decimal con coma europea (e.g. 12,50 €)',
    file: 'test6_decimal_comma.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (!result.summary.isBalanced) return `Fallo: Descuadre con coma decimal (${result.summary.difference})`;
      return null;
    }
  },
  {
    id: 7,
    name: 'Test 7: Decimal con punto anglosajón (e.g. 12.50 €)',
    file: 'test7_decimal_dot.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (!result.summary.isBalanced) return `Fallo: Descuadre con punto decimal (${result.summary.difference})`;
      return null;
    }
  },
  {
    id: 8,
    name: 'Test 8: Caracteres especiales (ñ, acentos, símbolos en SKU y Marketplace)',
    file: 'test8_special_chars.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (!result.summary.isBalanced) return `Fallo: Descuadre con caracteres especiales`;
      if (!result.meta.marketplaces.some(m => m.includes('España'))) return `Fallo: Marketplace España no preservado`;
      return null;
    }
  },
  {
    id: 9,
    name: 'Test 9: Rendimiento en archivo masivo de 13.000+ líneas',
    file: 'test9_large_15k.txt',
    verify: (result, durationMs) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (!result.summary.isBalanced) return `Fallo: Descuadre en archivo grande (${result.summary.difference})`;
      if (durationMs > 1000) return `Fallo: Rendimiento lento (${durationMs} ms > 1000 ms)`;
      return null;
    }
  },
  {
    id: 10,
    name: 'Test 10: Archivo con columnas inesperadas / extras',
    file: 'test10_unexpected_cols.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (!result.summary.isBalanced) return `Fallo: Columnas extras rompieron el cálculo`;
      return null;
    }
  },
  {
    id: 11,
    name: 'Test 11: Concepto desconocido o no catalogado (debe marcarse como REVISAR y no forzar cuenta genérica)',
    file: 'test11_unknown_concept.txt',
    verify: (result) => {
      if (!result.success) return `Fallo: Error inesperado ${result.message}`;
      if (!result.hasUnclassifiedItems) return `Fallo: Debió detectar items sin clasificar`;
      const reviewRow = result.journalPreview.find(j => j.status === 'REVISAR');
      if (!reviewRow) return `Fallo: No se encontró la fila con status REVISAR en el borrador de diario`;
      if (reviewRow.account !== 'REVISAR') return `Fallo: La subcuenta debería ser 'REVISAR', recibido ${reviewRow.account}`;
      if (!result.summary.isBalanced) return `Fallo: El balance no cuadra (${result.summary.difference})`;
      return null;
    }
  }
];

console.log('====================================================');
console.log('EJECUCIÓN DE AUDITORÍA AUTOMÁTICA DE 11 PRUEBAS');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

tests.forEach((t) => {
  const filePath = path.join(fixturesDir, t.file);
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  const start = Date.now();
  const result = parseSettlementReport(content);
  const duration = Date.now() - start;

  const error = t.verify(result, duration);
  if (error) {
    console.error(`❌ [FALLO] ${t.name}: ${error} (${duration} ms)`);
    failed++;
  } else {
    console.log(`✅ [OK] ${t.name} (${duration} ms)`);
    passed++;
  }
});

console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passed} PASADOS / ${failed} FALLADOS`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
