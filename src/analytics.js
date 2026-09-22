const MEASUREMENT_ID = "G-29DXR443PK";
const PRODUCTION_HOSTS = new Set([
  "word-in-one.com", "www.word-in-one.com",
  "wordle-in-one.com", "www.wordle-in-one.com"
]);
const EVENT_PARAMETERS = new Set([
  "game_mode", "level_name", "puzzle_number", "used_reveal",
  "rejection_reason", "failure_reason", "method", "content_type", "entry_point"
]);

function isProduction(window) {
  return window?.location.protocol === "https:" && PRODUCTION_HOSTS.has(window.location.hostname);
}

function analyticsUrl(href, keepAttribution = false) {
  const url = new URL(href);
  for (const name of [...url.searchParams.keys()]) {
    if (!keepAttribution || !["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_term", "utm_content"].includes(name)) {
      url.searchParams.delete(name);
    }
  }
  url.hash = "";
  return url.toString();
}

export function initializeAnalytics(window = globalThis.window) {
  try {
    if (!isProduction(window) || window.gtag) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, {
      page_location: analyticsUrl(window.location.href, true),
      page_referrer: window.document.referrer ? analyticsUrl(window.document.referrer) : "",
      // Challenge page titles contain the seed, which is not useful for reporting.
      page_title: "Word in One",
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    const script = window.document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    window.document.head.append(script);
  } catch {
    // Analytics must never prevent a game from loading.
  }
}

export function trackEvent(name, parameters = {}, window = globalThis.window) {
  try {
    if (!isProduction(window) || typeof window.gtag !== "function") return;
    window.gtag("event", name, {
      game_name: "word_in_one",
      ...Object.fromEntries(Object.entries(parameters).filter(([key]) => EVENT_PARAMETERS.has(key)))
    });
  } catch {
    // Blocked or unavailable analytics must never interrupt play.
  }
}
