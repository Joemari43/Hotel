(function () {
  const DEFAULT_PRODUCTION_API_BASE = 'https://your-backend-url.example.com';

  function normalizeBase(base) {
    if (!base) {
      return '';
    }
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }

  function shouldUseProdBase() {
    return window.location.hostname.endsWith('github.io');
  }

  const explicitBase =
    (window.HARBORVIEW_CONFIG && window.HARBORVIEW_CONFIG.apiBaseUrl) ||
    window.HARBORVIEW_API_BASE_URL ||
    '';

  const chosenBase = explicitBase || (shouldUseProdBase() ? DEFAULT_PRODUCTION_API_BASE : '');
  const normalizedBase = normalizeBase(chosenBase);

  function resolveApiUrl(path) {
    if (!path || /^https?:\/\//i.test(path)) {
      return path;
    }
    if (!normalizedBase) {
      return path;
    }
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return `${normalizedBase}/${trimmed}`;
  }

  function apiFetch(path, options = {}) {
    const resolved = resolveApiUrl(path);
    return fetch(resolved, options);
  }

  window.HARBORVIEW_API = {
    baseUrl: normalizedBase,
    resolveUrl: resolveApiUrl,
    fetch: apiFetch,
  };
  window.harborviewResolveUrl = resolveApiUrl;
  window.harborviewFetch = apiFetch;
})();
