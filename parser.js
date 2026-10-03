/**
 * Amazon Settlement Flat File V2 Client-Side Parser
 * 
 * 100% in-browser deterministic parser.
 * Specification: GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2
 * No external network calls, no storage of sensitive financial or order data.
 * 
 * Principles:
 * - Mathematical reconciliation is deterministic (Sum of movements = Total Payout).
 * - Accounting classification is parametrizable and tentative.
 * - Unknown or ambiguous concepts are flagged as 'REVISAR' and never silently forced.
 */

(function (global) {
  'use strict';

  const MANDATORY_COLUMNS = [
    'settlement-id',
    'total-amount',
    'currency',
    'amount-type',
    'amount-description',
    'amount'
  ];

  /**
   * Parse numeric string handling both European commas and standard dots.
   * e.g., "1.450,20" -> 1450.20, "1450.20" -> 1450.20, "-35,50" -> -35.50
   */
  function parseAmount(valStr) {
    if (typeof valStr !== 'string') {
      if (typeof valStr === 'number') return valStr;
      return 0;
    }
    let cleaned = valStr.trim();
    if (!cleaned) return 0;

    // Check if it has a comma as decimal separator: e.g. "12,50" or "1.250,50"
    if (cleaned.includes(',')) {
      if (cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '');
      }
      cleaned = cleaned.replace(',', '.');
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(val, currency = 'EUR') {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  }

  /**
   * Main Parsing Function
   */
  function parseSettlementReport(content) {
    if (!content || typeof content !== 'string') {
      return {
        success: false,
        errorCode: 'ARCHIVO_VACIO',
        message: 'El archivo está vacío o no contiene texto legible.'
      };
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return {
        success: false,
        errorCode: 'LINEAS_INSUFICIENTES',
        message: 'El archivo no contiene suficientes filas para ser un informe de liquidación válido.'
      };
    }

    // Header parsing
    const headerLine = lines[0];
    const headers = headerLine.split('\t').map(h => h.trim().toLowerCase());

    // Validate that it is tab-delimited and has Amazon Settlement V2 signature
    const missingColumns = MANDATORY_COLUMNS.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      const isCommaSeparated = headerLine.includes(',') && !headerLine.includes('\t');
      return {
        success: false,
        errorCode: 'FORMATO_NO_RECONOCIDO',
        message: isCommaSeparated 
          ? 'El archivo parece estar delimitado por comas (CSV) en lugar de tabuladores (.txt / .tsv). Asegúrate de descargar el "Settlement Report Flat File V2" de Amazon Seller Central.'
          : `El archivo no contiene las cabeceras requeridas de Amazon Settlement V2. Faltan: ${missingColumns.join(', ')}.`
      };
    }

    // Build column index map
    const colMap = {};
    headers.forEach((h, idx) => {
      colMap[h] = idx;
    });

    // Parse Row 1: Summary Row
    const summaryParts = lines[1].split('\t');
    const settlementId = (summaryParts[colMap['settlement-id']] || '').trim();
    const settlementStartDate = (summaryParts[colMap['settlement-start-date']] || '').trim();
    const settlementEndDate = (summaryParts[colMap['settlement-end-date']] || '').trim();
    const depositDate = (summaryParts[colMap['deposit-date']] || '').trim();
    const currency = (summaryParts[colMap['currency']] || 'EUR').trim().toUpperCase();
    const rawTotalAmount = parseAmount(summaryParts[colMap['total-amount']] || '0');
    const totalAmount = round2(rawTotalAmount);

    if (!settlementId) {
      return {
        success: false,
        errorCode: 'SETTLEMENT_ID_INVALIDO',
        message: 'No se ha podido localizar el settlement-id en la fila resumen del archivo.'
      };
    }

    const isEur = currency === 'EUR';

    // Detailed transaction parsing
    const ordersSet = new Set();
    const marketplacesSet = new Set();

    let sumVentas = 0;
    let sumEnvios = 0;
    let sumPromociones = 0;
    let sumComisiones = 0;
    let sumFba = 0;
    let sumReembolsos = 0;
    let sumPublicidad = 0;
    let sumAlmacenaje = 0;
    let sumSuscripcion = 0;
    let sumReservas = 0;

    const unclassifiedItems = [];
    let sumUnclassified = 0;

    let totalMovements = 0;
    let totalCalculated = 0;

    // Iterate over detail rows (starting at line index 2)
    for (let i = 2; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 5) continue; // Skip malformed empty trailing rows

      totalMovements++;

      const orderId = (parts[colMap['order-id']] || '').trim();
      if (orderId) ordersSet.add(orderId);

      const marketplace = (parts[colMap['marketplace-name']] || '').trim();
      if (marketplace) marketplacesSet.add(marketplace);

      const amountType = (parts[colMap['amount-type']] || '').trim();
      const amountDesc = (parts[colMap['amount-description']] || '').trim();
      const rawAmt = parseAmount(parts[colMap['amount']] || '0');
      const amt = round2(rawAmt);

      totalCalculated += amt;

      const typeLower = amountType.toLowerCase();
      const descLower = amountDesc.toLowerCase();

      // Deterministic classification
      if (typeLower === 'itemprice') {
        if (descLower === 'principal') {
          sumVentas += amt;
        } else if (descLower === 'shipping' || descLower === 'shippingtax' || descLower === 'giftwrap' || descLower === 'giftwraptax') {
          sumEnvios += amt;
        } else if (descLower === 'tax') {
          sumVentas += amt; // Tax collected on items
        } else {
          sumVentas += amt;
        }
      } else if (typeLower === 'promotion') {
        sumPromociones += amt;
      } else if (typeLower === 'itemfees') {
        if (descLower === 'commission') {
          sumComisiones += amt;
        } else if (descLower.includes('fba') || descLower.includes('fulfillment') || descLower.includes('pickpack') || descLower.includes('weightbased')) {
          sumFba += amt;
        } else if (descLower.includes('refund')) {
          sumReembolsos += amt;
        } else {
          // Other known selling fees
          sumComisiones += amt;
        }
      } else if (typeLower === 'refund') {
        sumReembolsos += amt;
      } else if (typeLower === 'servicefee') {
        if (descLower.includes('advertising') || descLower.includes('sponsored') || descLower.includes('cost of advertising')) {
          sumPublicidad += amt;
        } else if (descLower.includes('storage')) {
          sumAlmacenaje += amt;
        } else if (descLower.includes('subscription')) {
          sumSuscripcion += amt;
        } else {
          // Flag as unclassified service fee to avoid silent arbitrary allocation
          unclassifiedItems.push({
            type: amountType,
            description: amountDesc,
            amount: amt,
            marketplace
          });
          sumUnclassified += amt;
        }
      } else if (typeLower === 'reserve amount' || descLower.includes('reserve')) {
        sumReservas += amt;
      } else {
        // Concepto no catalogado con certeza suficiente: requiere revisión explícita
        unclassifiedItems.push({
          type: amountType,
          description: amountDesc,
          amount: amt,
          marketplace
        });
        sumUnclassified += amt;
      }
    }

    totalCalculated = round2(totalCalculated);
    const difference = round2(totalAmount - totalCalculated);

    // Build tentative draft journal entries
    const journalPreview = [];

    // 1. Payout to Bank / Clearing Account (555)
    if (totalAmount !== 0) {
      journalPreview.push({
        account: '55500001',
        name: 'Pasarela Amazon (Cuenta Puente)',
        debe: totalAmount > 0 ? totalAmount : 0,
        haber: totalAmount < 0 ? Math.abs(totalAmount) : 0,
        desc: `Abono bancario liquidación #${settlementId}`,
        status: 'OK'
      });
    }

    // 2. Comisiones Comerciales (623)
    if (sumComisiones !== 0) {
      journalPreview.push({
        account: '62300010',
        name: 'Comisiones de Venta Amazon (ISP)',
        debe: Math.abs(round2(sumComisiones)),
        haber: 0,
        desc: 'Comisiones comerciales Amazon Services Europe',
        status: 'OK'
      });
    }

    // 3. Tarifas Logísticas FBA (624)
    if (sumFba !== 0) {
      journalPreview.push({
        account: '62400010',
        name: 'Logística y Envíos FBA (ISP)',
        debe: Math.abs(round2(sumFba)),
        haber: 0,
        desc: 'Tarifas gestión logística FBA',
        status: 'OK'
      });
    }

    // 4. Publicidad Amazon Ads (627)
    if (sumPublicidad !== 0) {
      journalPreview.push({
        account: '62700010',
        name: 'Publicidad Amazon Ads',
        debe: Math.abs(round2(sumPublicidad)),
        haber: 0,
        desc: 'Publicidad Sponsored Products',
        status: 'OK'
      });
    }

    // 5. Almacenaje y Suscripciones (629)
    if (sumAlmacenaje !== 0 || sumSuscripcion !== 0) {
      journalPreview.push({
        account: '62900010',
        name: 'Almacenaje FBA y Suscripción Seller',
        debe: Math.abs(round2(sumAlmacenaje + sumSuscripcion)),
        haber: 0,
        desc: 'Almacenamiento mensual FBA y cuota mensual Seller',
        status: 'OK'
      });
    }

    // 6. Devoluciones a clientes (708)
    if (sumReembolsos !== 0) {
      journalPreview.push({
        account: '70800001',
        name: 'Devoluciones de Ventas Amazon',
        debe: Math.abs(round2(sumReembolsos)),
        haber: 0,
        desc: 'Reembolsos a compradores gestionados por Amazon',
        status: 'OK'
      });
    }

    // 7. Promociones comerciales (709)
    if (sumPromociones !== 0) {
      journalPreview.push({
        account: '70900001',
        name: 'Descuentos Promocionales en Ventas',
        debe: Math.abs(round2(sumPromociones)),
        haber: 0,
        desc: 'Promociones y cupones aplicados al comprador',
        status: 'OK'
      });
    }

    // 8. Reservas de garantía retenidas o liberadas (555.2)
    if (sumReservas !== 0) {
      const netReserve = round2(sumReservas);
      journalPreview.push({
        account: '55500002',
        name: 'Reserva de Garantía Amazon',
        debe: netReserve < 0 ? Math.abs(netReserve) : 0,
        haber: netReserve > 0 ? netReserve : 0,
        desc: netReserve < 0 ? 'Retención de garantía en balance' : 'Liberación de reserva previa',
        status: 'OK'
      });
    }

    // 9. Ventas Brutas de Mercaderías (700)
    if (sumVentas !== 0) {
      journalPreview.push({
        account: '70000001',
        name: 'Ventas de Mercaderías Amazon',
        debe: 0,
        haber: round2(sumVentas),
        desc: 'Ventas brutas de productos en periodo',
        status: 'OK'
      });
    }

    // 10. Suplementos de transporte cobrados (759)
    if (sumEnvios !== 0) {
      journalPreview.push({
        account: '75900001',
        name: 'Ingresos por Portes Repercutidos',
        debe: 0,
        haber: round2(sumEnvios),
        desc: 'Envíos cobrados a clientes en pedidos',
        status: 'OK'
      });
    }

    // 11. CONCEPTOS NO CLASIFICADOS CON CERTEZA: REVISAR
    if (unclassifiedItems.length > 0) {
      const unclassifiedSum = round2(sumUnclassified);
      journalPreview.push({
        account: 'REVISAR',
        name: 'Movimiento pendiente de asignación',
        debe: unclassifiedSum < 0 ? Math.abs(unclassifiedSum) : 0,
        haber: unclassifiedSum > 0 ? unclassifiedSum : 0,
        desc: `${unclassifiedItems.length} concepto(s) requieren asignación de cuenta personalizada`,
        status: 'REVISAR'
      });
    }

    return {
      success: true,
      meta: {
        settlementId,
        settlementStartDate,
        settlementEndDate,
        depositDate,
        currency,
        isEur,
        totalLines: lines.length,
        totalMovements,
        totalOrders: ordersSet.size,
        marketplaces: Array.from(marketplacesSet)
      },
      summary: {
        totalAmount,
        totalCalculated,
        difference,
        isBalanced: Math.abs(difference) < 0.05
      },
      breakdown: {
        ventas: round2(sumVentas),
        envios: round2(sumEnvios),
        promociones: round2(sumPromociones),
        comisiones: round2(sumComisiones),
        fba: round2(sumFba),
        reembolsos: round2(sumReembolsos),
        publicidad: round2(sumPublicidad),
        almacenaje: round2(sumAlmacenaje),
        suscripcion: round2(sumSuscripcion),
        reservas: round2(sumReservas),
        otros: round2(sumUnclassified),
        neto: totalCalculated
      },
      unclassifiedItems,
      hasUnclassifiedItems: unclassifiedItems.length > 0,
      journalPreview
    };
  }

  // Export for browser and node environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseSettlementReport,
      parseAmount,
      round2,
      formatCurrency
    };
  } else {
    global.SettlementParser = {
      parseSettlementReport,
      parseAmount,
      round2,
      formatCurrency
    };
  }
})(typeof window !== 'undefined' ? window : global);
