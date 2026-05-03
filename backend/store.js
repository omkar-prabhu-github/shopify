import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, '../.token-store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch {}
  return new Map();
}

function saveStore(map) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(map)), 'utf8');
  } catch (e) {
    console.error('Failed to persist token store:', e.message);
  }
}

function makePersistentMap(initial) {
  const map = initial;
  return {
    get: (k) => map.get(k),
    set: (k, v) => { map.set(k, v); saveStore(map); return map; },
    has: (k) => map.has(k),
    delete: (k) => { const r = map.delete(k); saveStore(map); return r; },
  };
}

export const tokenStore = makePersistentMap(loadStore());

// shop -> { policy: string, generatedAt: number }
export const policyStore = new Map();
