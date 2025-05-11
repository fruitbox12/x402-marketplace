import { NextResponse } from 'next/server';
// Import from the shared store
import { marketplaceApis, ApiEntry, addApiToStore } from '@/lib/marketplaceStore';

// This is a simplified in-memory store for now.
// In a real application, you'd use a database.
// We'll define the structure of an API entry later when we build the marketplace view.
// const marketplaceApis: any[] = []; // Remove this line

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      endpointUrl,
      httpMethod,
      parametersSchema,
      pricePerCall,
      creatorWalletAddress,
      authType,
      apiKeyName,
      apiKeySecret,
      paymentNetwork,
      paymentCurrencySymbol
    } = body;

    // Basic validation (can be expanded)
    if (!name || !endpointUrl || !httpMethod || pricePerCall === undefined || pricePerCall < 0) {
      return NextResponse.json({ error: 'Missing required fields or invalid price.' }, { status: 400 });
    }

    // If the API is paid, require a wallet address for the creator
    if (pricePerCall > 0 && (!creatorWalletAddress || creatorWalletAddress.trim() === '')) {
      return NextResponse.json({ error: 'creatorWalletAddress is required for paid APIs.' }, { status: 400 });
    }

    // Upstream auth validation
    const finalAuthType = authType || 'NONE';
    if (finalAuthType !== 'NONE') {
      if (!apiKeyName || !apiKeySecret) {
        return NextResponse.json({ error: 'apiKeyName and apiKeySecret are required when authType is not NONE.' }, { status: 400 });
      }
    }

    let parsedParametersSchema = {};
    try {
      if (parametersSchema && parametersSchema.trim() !== '') {
        parsedParametersSchema = JSON.parse(parametersSchema);
      }
    } catch (e) {
      return NextResponse.json({ error: 'Invalid parametersSchema JSON format.' }, { status: 400 });
    }

    const newApiEntry: ApiEntry = {
      id: `api_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // Simple unique ID
      name,
      description,
      endpointUrl,
      httpMethod,
      parametersSchema: parsedParametersSchema,
      pricePerCall,
      creatorWalletAddress: creatorWalletAddress || '',
      authType: finalAuthType,
      apiKeyName: finalAuthType === 'NONE' ? undefined : apiKeyName,
      apiKeySecret: finalAuthType === 'NONE' ? undefined : apiKeySecret,
      paymentNetwork: paymentNetwork || 'base-sepolia',
      paymentCurrencySymbol: paymentCurrencySymbol || 'ETH',
      // x402wrappedUrl will be generated later when an x402 wrapper is set up for this
      // For now, it's the same as endpointUrl or a placeholder
      // Make sure this matches the expected format for the proxy
      x402WrappedUrl: `/api/x402-proxy/${name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      createdAt: new Date().toISOString(),
    };

    addApiToStore(newApiEntry);
    console.log('New API Entry Added:', newApiEntry);
    console.log('Current Marketplace APIs:', marketplaceApis);

    // We will need a way to persist `marketplaceApis` if not using a database.
    // For now, it's in-memory and will reset on server restart.

    const { apiKeySecret: _, ...redactedEntry } = newApiEntry;
    return NextResponse.json({ message: 'API added to marketplace successfully', apiId: newApiEntry.id, entry: redactedEntry });
  } catch (error) {
    console.error('Error adding API to marketplace:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// We might also want a GET endpoint to list APIs in the marketplace later.
export async function GET() {
  const redacted = marketplaceApis.map(({ apiKeySecret: _, ...rest }) => rest);
  return NextResponse.json({ apis: redacted });
} 