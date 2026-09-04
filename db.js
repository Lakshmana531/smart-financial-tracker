// Lightweight client-side database using localStorage
// Provides per-user storage and simple user registry

(function(global) {
  const USERS_KEY = 'sft:users:index'; // array of emails
  const USER_KEY = (email) => `sft:user:${email}`; // user profile
  const DATA_KEY = (email) => `sft:data:${email}`; // app data

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureUserIndex() {
    const idx = readJSON(USERS_KEY, []);
    if (!Array.isArray(idx)) {
      writeJSON(USERS_KEY, []);
      return [];
    }
    return idx;
  }

  function addUserToIndex(email) {
    const idx = ensureUserIndex();
    if (!idx.includes(email)) {
      idx.push(email);
      writeJSON(USERS_KEY, idx);
    }
  }

  function upsertUserProfile(profile) {
    if (!profile || !profile.email) return false;
    const email = profile.email.toLowerCase();
    addUserToIndex(email);
    const prev = readJSON(USER_KEY(email), {});
    const next = { ...prev, ...profile, email };
    return writeJSON(USER_KEY(email), next);
  }

  function getUserProfile(email) {
    if (!email) return null;
    return readJSON(USER_KEY(email.toLowerCase()), null);
  }

  function saveUserData(email, data) {
    if (!email) return false;
    return writeJSON(DATA_KEY(email.toLowerCase()), data);
  }

  function loadUserData(email, fallback) {
    if (!email) return fallback;
    return readJSON(DATA_KEY(email.toLowerCase()), fallback);
  }

  function listUsers() {
    return ensureUserIndex();
  }

  global.DB = {
    upsertUserProfile,
    getUserProfile,
    saveUserData,
    loadUserData,
    listUsers
  };
})(window);


