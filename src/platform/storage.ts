import type { KeyValueStorage } from '../save/slots';

/** localStorage adapter. Never throws: private mode or a full quota just loses that write. */
export const webStorage: KeyValueStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota or privacy mode: autosave tries again in 10 s.
    }
  },
};
