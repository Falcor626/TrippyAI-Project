const normalizeBaseUrl = (value) => (value || '').replace(/\/+$/, '');

const rawTrippyApiUrl =
  process.env.REACT_APP_TRIPPY_API_URL ||
  process.env.REACT_APP_TRIPPI_API_URL ||
  'http://localhost:5000';

export const TRIPPY_API_BASE = normalizeBaseUrl(rawTrippyApiUrl).replace(/\/chat$/, '');
export const TRIPPY_CHAT_URL = `${TRIPPY_API_BASE}/chat`;
export const SERPAPI_PROXY_URL =
  process.env.REACT_APP_SERPAPI_PROXY_URL || 'http://localhost:5051/serpapi';
