/**
 * Anonymous Event Logger for Smoke Test Intent Measurement
 * 
 * Strict Privacy Design:
 * - NO settlement-id
 * - NO order-id
 * - NO SKU
 * - NO customer names or emails
 * - NO individual amounts or revenue
 * - NO tax identifiers or fiscal data
 * - NO file content
 * 
 * Allowed events:
 * - landing_view
 * - file_selected
 * - valid_settlement_detected
 * - preview_generated
 * - pricing_view
 * - checkout_clicked
 * - checkout_started
 * - feedback_submitted
 * - qualified_lead
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'smoke_test_anonymous_metrics_v2';

  const VALID_EVENTS = [
    'landing_view',
    'file_selected',
    'valid_settlement_detected',
    'preview_generated',
    'pricing_view',
    'checkout_clicked',
    'checkout_started',
    'feedback_submitted',
    'qualified_lead'
  ];

  function getMetrics() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {
        counters: {},
        eventLog: []
      };
    } catch (e) {
      return { counters: {}, eventLog: [] };
    }
  }

  function saveMetrics(metrics) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
    } catch (e) {
      console.warn('No se pudo guardar la telemetría en localStorage', e);
    }
  }

  function logEvent(eventName, sanitizedMetadata = {}) {
    if (!VALID_EVENTS.includes(eventName)) {
      console.warn(`[Telemetry] Evento no permitido omitido: ${eventName}`);
      return;
    }

    // Filter out strictly any sensitive or forbidden keys
    const safeMeta = {};
    const forbiddenPatterns = [
      'settlement', 'order', 'sku', 'amount', 'name', 'email', 
      'cif', 'nif', 'vat', 'content', 'precio', 'ingreso', 'dinero'
    ];
    
    Object.keys(sanitizedMetadata).forEach(k => {
      const lower = k.toLowerCase();
      const isForbidden = forbiddenPatterns.some(pat => lower.includes(pat));
      if (!isForbidden) {
        safeMeta[k] = sanitizedMetadata[k];
      }
    });

    const metrics = getMetrics();
    metrics.counters[eventName] = (metrics.counters[eventName] || 0) + 1;
    metrics.eventLog.push({
      event: eventName,
      timestamp: new Date().toISOString(),
      meta: safeMeta
    });

    if (metrics.eventLog.length > 100) {
      metrics.eventLog = metrics.eventLog.slice(-100);
    }

    saveMetrics(metrics);
    console.log(`[Telemetry Anónima] ${eventName}`, safeMeta);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smoke_event_logged', {
        detail: { event: eventName, meta: safeMeta }
      }));
    }
  }

  function getSummary() {
    const metrics = getMetrics();
    return {
      counters: metrics.counters,
      totalEvents: metrics.eventLog.length
    };
  }

  function resetMetrics() {
    localStorage.removeItem(STORAGE_KEY);
  }

  global.SmokeAnalytics = {
    logEvent,
    getMetrics,
    getSummary,
    resetMetrics
  };

})(typeof window !== 'undefined' ? window : global);
