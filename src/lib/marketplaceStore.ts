// Matches the structure in api/marketplace/add/route.ts and marketplace/page.tsx
export interface ApiEntry {
  id: string;
  name: string;
  description: string;
  endpointUrl: string; // Original endpoint
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | string; // Allow specific methods or any string
  parametersSchema: any; // Parsed JSON schema
  pricePerCall: number;
  x402WrappedUrl: string; // The path for the proxy (e.g., /api/x402-proxy/api-name-slug)
  createdAt: string;
}

// This is a simplified in-memory store.
// In a real application, you'd use a database for persistence.
export const marketplaceApis: ApiEntry[] = [];

// Optional: Functions to interact with the store if needed, e.g.,
// export const addApiToStore = (api: ApiEntry) => marketplaceApis.push(api);
// export const findApiBySlug = (slug: string) => marketplaceApis.find(api => api.x402WrappedUrl.endsWith(slug));
// For now, direct access and manipulation from the API routes is fine for simplicity. 