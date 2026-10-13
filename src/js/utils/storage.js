/**
 * Safe storage abstraction over localStorage with in-memory fallback
 */
const inMemoryStore = new Map();

function isLocalStorageAvailable() {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const canUseStorage = typeof window !== 'undefined' && 'localStorage' in window && isLocalStorageAvailable();

export const storage = {
  /**
   * Get an item from storage and parse JSON
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {*}
   */
  get(key, defaultValue = null) {
    try {
      if (canUseStorage) {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
      }
      if (inMemoryStore.has(key)) {
        return inMemoryStore.get(key);
      }
      return defaultValue;
    } catch (err) {
      console.warn(`Storage get error for key "${key}":`, err);
      return defaultValue;
    }
  },

  /**
   * Save an item to storage serialized as JSON
   * @param {string} key 
   * @param {*} value 
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      if (canUseStorage) {
        window.localStorage.setItem(key, serialized);
      }
      inMemoryStore.set(key, value);
      return true;
    } catch (err) {
      console.error(`Storage set error for key "${key}":`, err);
      inMemoryStore.set(key, value);
      return false;
    }
  },

  /**
   * Remove an item from storage
   * @param {string} key 
   */
  remove(key) {
    try {
      if (canUseStorage) {
        window.localStorage.removeItem(key);
      }
      inMemoryStore.delete(key);
    } catch (err) {
      console.warn(`Storage remove error for key "${key}":`, err);
    }
  },

  /**
   * Clear all storage items
   */
  clear() {
    try {
      if (canUseStorage) {
        window.localStorage.clear();
      }
      inMemoryStore.clear();
    } catch (err) {
      console.warn('Storage clear error:', err);
    }
  },
};
