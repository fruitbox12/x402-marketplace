import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

// Matches the structure in api/marketplace/add/route.ts and marketplace/page.tsx
export interface ApiEntry {
  id: string;
  name: string;
  description: string;
  endpointUrl: string; // Original endpoint
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | string; // Allow specific methods or any string
  parametersSchema: any; // Parsed JSON schema
  pricePerCall: number;
  // NEW: monetisation fields used by the x402 proxy
  creatorWalletAddress?: string;
  paymentNetwork?: string; // e.g. "base-sepolia"
  paymentCurrencySymbol?: string; // e.g. "ETH"
  x402WrappedUrl: string; // The path for the proxy (e.g., /api/x402-proxy/api-name-slug)
  createdAt: string;
}

// This is a simplified in-memory store.
// In a real application, you'd use a database for persistence.
export const marketplaceApis: ApiEntry[] = [];

// ────────────────────────────────────────────────────────────
// Simple JSON-file persistence (dev-only)
// Data lives at <projectRoot>/data/marketplaceApis.json
// ────────────────────────────────────────────────────────────
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'marketplaceApis.json');

// Load existing data (sync to run during module init)
(() => {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      marketplaceApis.push(...list);
    }
  } catch (err) {
    // File may not exist on first run – ignore.
  }
})();

async function persist() {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    await fsPromises.writeFile(DATA_FILE, JSON.stringify(marketplaceApis, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to persist marketplace APIs:', err);
  }
}

export const addApiToStore = (api: ApiEntry) => {
  marketplaceApis.push(api);
  // Fire and forget persistence
  persist();
};

// Optional: Functions to interact with the store if needed, e.g.,
// export const findApiBySlug = (slug: string) => marketplaceApis.find(api => api.x402WrappedUrl.endsWith(slug));
// For now, direct access and manipulation from the API routes is fine for simplicity. 