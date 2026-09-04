// Minimal API client with graceful fallback. Configure base URL via localStorage key "sft:api:base" or window.API_BASE
(function(global) {
  function getBase() {
    return global.API_BASE || localStorage.getItem('sft:api:base') || '';
  }

  async function apiFetch(path, options) {
    const base = getBase();
    if (!base) throw new Error('API base not configured');
    const url = base.replace(/\/$/, '') + path;
    const res = await fetch(url, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, options || {}));
    if (!res.ok) throw new Error('API error: ' + res.status);
    if (res.status === 204) return null;
    return await res.json();
  }

  async function upsertUserProfile(email, name) {
    try {
      return await apiFetch(`/users/${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: JSON.stringify({ email, name })
      });
    } catch (_) {
      return null;
    }
  }

  async function getUserProfile(email) {
    try {
      return await apiFetch(`/users/${encodeURIComponent(email)}`, { method: 'GET' });
    } catch (_) {
      return null;
    }
  }

  async function loadUserData(email) {
    try {
      return await apiFetch(`/data/${encodeURIComponent(email)}`, { method: 'GET' });
    } catch (_) {
      return null;
    }
  }

  async function saveUserData(email, data) {
    try {
      await apiFetch(`/data/${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  global.API = { upsertUserProfile, getUserProfile, loadUserData, saveUserData };
})(window);


