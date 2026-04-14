/**
 * Crawlers.fr — Widget SDK v3.0
 * ==============================
 * Script universel à installer via GTM, WordPress ou injection directe.
 * - Charge dynamiquement le routeur correctif depuis serve-client-script.
 * - Traque automatiquement les paiements (Stripe, PayPal, WooCommerce, Shopify, formulaires).
 *
 * Prérequis : définir window.CRAWLERS_API_KEY avant le chargement du script.
 *
 * Exemple GTM (balise HTML personnalisée) :
 *   <script>window.CRAWLERS_API_KEY = "votre-clé-api-uuid";</script>
 *   <script src="https://crawlers.fr/widget.js" defer></script>
 *
 * @version 3.0.0
 */
;(function initCrawlersWidget() {
  'use strict';

  // ── 1. Ne pas exécuter sur les domaines de preview/dev/self ──────
  var host = window.location.hostname;
  if (host.indexOf('lovableproject.com') !== -1 || host.indexOf('lovable.app') !== -1 || host === 'localhost' || host === 'crawlers.fr' || host === 'www.crawlers.fr') {
    return;
  }

  // ── 2. Récupération de la clé API client ───────────────────
  var cleClient = window.CRAWLERS_API_KEY;

  if (!cleClient) {
    console.error('[Crawlers.fr] Clé API manquante (window.CRAWLERS_API_KEY). Le widget ne peut pas démarrer.');
    return;
  }

  var BASE_URL = (window.CRAWLERS_API_BASE || 'https://api.crawlers.fr/functions/v1');
  var SCRIPT_URL = BASE_URL + '/serve-client-script?key=' + encodeURIComponent(cleClient);
  var TRACK_URL = BASE_URL + '/track-payment';

  // ── 3. Charger le script dynamique depuis serve-client-script ──
  try {
    var script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-crawlers-sdk', 'v3');
    script.onerror = function() {
      console.warn('[Crawlers.fr] Impossible de charger le script correctif (fail-safe).');
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    console.error('[Crawlers.fr] Erreur d\'initialisation.', e);
  }

  // ── 4. Payment Tracking Module ─────────────────────────────
  var sentPayments = {};

  function sendPayment(orderId, amount, currency, source, meta) {
    if (!orderId || sentPayments[orderId]) return;
    sentPayments[orderId] = true;

    var payload = JSON.stringify({
      api_key: cleClient,
      order_id: orderId,
      amount: parseFloat(amount) || 0,
      currency: (currency || 'EUR').toUpperCase(),
      source: source || 'widget',
      page_url: window.location.href,
      metadata: meta || {}
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', TRACK_URL, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }
  }

  // Expose global API for custom integrations
  window.CrawlersTrackPayment = function(orderId, amount, currency, source, meta) {
    sendPayment(orderId, amount, currency, source || 'custom', meta);
  };

  // ── 4a. Stripe Checkout detection ──────────────────────────
  // Stripe redirects to ?payment_intent=... or ?checkout_session_id=...
  function checkStripeSuccess() {
    var params = new URLSearchParams(window.location.search);
    var pi = params.get('payment_intent') || params.get('checkout_session_id');
    if (pi && (window.location.pathname.indexOf('success') !== -1 ||
               window.location.pathname.indexOf('merci') !== -1 ||
               window.location.pathname.indexOf('thank') !== -1 ||
               params.get('redirect_status') === 'succeeded')) {
      sendPayment('stripe_' + pi, 0, 'EUR', 'stripe_checkout', {
        payment_intent: params.get('payment_intent'),
        session_id: params.get('checkout_session_id')
      });
    }
  }

  // ── 4b. PayPal detection ───────────────────────────────────
  function checkPayPalSuccess() {
    var params = new URLSearchParams(window.location.search);
    var paymentId = params.get('paymentId') || params.get('token');
    var payerId = params.get('PayerID');
    if (paymentId && payerId) {
      sendPayment('paypal_' + paymentId, 0, 'EUR', 'paypal', { payer_id: payerId });
    }
  }

  // ── 4c. WooCommerce order-received page ────────────────────
  function checkWooCommerce() {
    // WooCommerce: /checkout/order-received/123/?key=wc_order_xxx
    var match = window.location.pathname.match(/order-received\/(\d+)/);
    if (match) {
      var orderId = match[1];
      // Try to read total from the page
      var totalEl = document.querySelector('.woocommerce-order-overview__total .woocommerce-Price-amount bdi, .order-total .woocommerce-Price-amount');
      var amount = 0;
      var currency = 'EUR';
      if (totalEl) {
        var text = totalEl.textContent || '';
        amount = parseFloat(text.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        var currEl = totalEl.querySelector('.woocommerce-Price-currencySymbol');
        if (currEl) {
          var sym = currEl.textContent || '';
          if (sym === '$') currency = 'USD';
          else if (sym === '£') currency = 'GBP';
        }
      }
      sendPayment('woo_' + orderId, amount, currency, 'woocommerce', {
        wc_key: new URLSearchParams(window.location.search).get('key')
      });
    }
  }

  // ── 4d. Shopify thank-you page ─────────────────────────────
  function checkShopify() {
    // Shopify: /thank_you or /orders/xxx or checkout with Shopify.checkout
    if (window.Shopify && window.Shopify.checkout) {
      var co = window.Shopify.checkout;
      sendPayment('shopify_' + co.order_id, co.total_price || co.payment_due || 0,
        co.currency || 'EUR', 'shopify', { token: co.token });
    }
  }

  // ── 4e. Generic thank-you/success page detection ───────────
  function checkGenericSuccess() {
    var path = window.location.pathname.toLowerCase();
    var isSuccess = (path.indexOf('thank') !== -1 || path.indexOf('merci') !== -1 ||
                     path.indexOf('success') !== -1 || path.indexOf('confirmation') !== -1);
    if (!isSuccess) return;

    // Look for order/transaction IDs in URL params
    var params = new URLSearchParams(window.location.search);
    var orderId = params.get('order_id') || params.get('orderId') || params.get('transaction_id') || params.get('id');
    if (!orderId) return;

    var amount = parseFloat(params.get('amount') || params.get('total') || '0') || 0;
    sendPayment('generic_' + orderId, amount, params.get('currency') || 'EUR', 'generic_success');
  }

  // ── 4f. DataLayer (GTM) ecommerce event interception ───────
  function interceptDataLayer() {
    if (!window.dataLayer) return;

    var originalPush = window.dataLayer.push;
    window.dataLayer.push = function() {
      for (var i = 0; i < arguments.length; i++) {
        var entry = arguments[i];
        try {
          // GA4 purchase event
          if (entry && entry.event === 'purchase' && entry.ecommerce) {
            var ec = entry.ecommerce;
            var txId = ec.transaction_id || ('dl_' + Date.now());
            sendPayment(txId, ec.value || 0, ec.currency || 'EUR', 'datalayer_purchase', {
              items_count: (ec.items || []).length
            });
          }
        } catch (e) {}
      }
      return originalPush.apply(window.dataLayer, arguments);
    };
  }

  // ── 5. Run all detectors on page load ──────────────────────
  function runPaymentDetectors() {
    try { checkStripeSuccess(); } catch (e) {}
    try { checkPayPalSuccess(); } catch (e) {}
    try { checkWooCommerce(); } catch (e) {}
    try { checkShopify(); } catch (e) {}
    try { checkGenericSuccess(); } catch (e) {}
    try { interceptDataLayer(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runPaymentDetectors);
  } else {
    setTimeout(runPaymentDetectors, 500);
  }

})();
