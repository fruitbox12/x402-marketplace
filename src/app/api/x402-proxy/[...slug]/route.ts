import { NextRequest, NextResponse } from 'next/server';
import { marketplaceApis, ApiEntry } from '@/lib/marketplaceStore';
import { getCdpAccount, updateMockBalance } from '@/lib/walletStore'; // Updated import

async function handler(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const slugParts = params.slug;
  // Reconstruct the path that was matched, e.g., /api/x402-proxy/my-api-name
  // The actual slug matched by [...slug] will be like ['my-api-name'] or ['my-api-name', 'sub-path']
  // For now, we assume the x402WrappedUrl is just /api/x402-proxy/[api-slug-from-name]
  // and doesn't contain further sub-paths that are part of the proxy lookup itself.
  const requestedProxyPath = `/api/x402-proxy/${slugParts[0]}`;

  const apiEntry = marketplaceApis.find(api => api.x402WrappedUrl === requestedProxyPath);

  if (!apiEntry) {
    return NextResponse.json({ error: 'API endpoint not found in marketplace' }, { status: 404 });
  }

  // ---- X402 Mock Payment Logic START ----
  const userWallet = getCdpAccount(); // Use getCdpAccount
  if (!userWallet) {
    return NextResponse.json(
      { 
        error: 'Payment required. No active wallet found. Please create and fund a wallet.', 
        details: 'No wallet session.',
        paymentDetailsRequired: {
          price: apiEntry.pricePerCall,
          // In a real x402, you'd provide instructions here (e.g., L402 token)
        }
      },
      { status: 401 } // 401 Unauthorized as no identity/wallet, or 402 if preferred for payment context
    );
  }

  // mockBalance and currency should be defined if userWallet exists due to setCdpAccount initialization
  const currentMockBalance = userWallet.mockBalance ?? 0;
  const currentCurrency = userWallet.currency ?? 'N/A';

  // This check now correctly handles pricePerCall == 0 (currentMockBalance < 0)
  if (currentMockBalance < apiEntry.pricePerCall) { 
    return NextResponse.json(
      { 
        error: 'Payment required. Insufficient funds in wallet.', 
        details: `Current balance: ${currentMockBalance} ${currentCurrency}. Required: ${apiEntry.pricePerCall} ${currentCurrency}`,
        paymentDetailsRequired: {
          price: apiEntry.pricePerCall,
          currency: currentCurrency,
          // Again, real x402 details here
        }
      },
      { status: 402 } // 402 Payment Required
    );
  }

  // Deduct the balance. If pricePerCall is 0, this deducts 0.
  const updatedWallet = updateMockBalance(apiEntry.pricePerCall * -1); // Use updateMockBalance
  if (!updatedWallet) {
    // This should ideally not happen if previous checks were correct
    console.error('Failed to update wallet balance during transaction for API:', apiEntry.id);
    return NextResponse.json({ error: 'Wallet balance update failed during transaction.' }, { status: 500 });
  }
  // Log regardless of price, shows 0 cost for free APIs
  console.log(`Payment processing for API: ${apiEntry.name}. Cost: ${apiEntry.pricePerCall}. New balance: ${updatedWallet.mockBalance ?? 0}`); 
  // ---- X402 Mock Payment Logic END ----

  console.log(`Proxying request for ${apiEntry.name} to ${apiEntry.endpointUrl} (Price: ${apiEntry.pricePerCall})`);

  const targetUrl = new URL(apiEntry.endpointUrl);

  // Append any additional path segments from the slug to the target URL
  // e.g. if request was /api/x402-proxy/my-api/users/123 and slugParts = ['my-api', 'users', '123']
  // and apiEntry.endpointUrl is https://external.api/base
  // then target should be https://external.api/base/users/123
  if (slugParts.length > 1) {
    const additionalPath = slugParts.slice(1).join('/');
    targetUrl.pathname = targetUrl.pathname.replace(/\/$/, '') + '/' + additionalPath.replace(/^\//, '');
  }
  
  // Append query parameters from the original request to the target URL
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  try {
    const externalResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: req.headers, // Pass through original headers
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      // IMPORTANT: If the target API uses redirects, Next.js fetch cache can be an issue.
      // cache: 'no-store', // Consider this if you face issues with cached responses from target
      // redirect: 'manual', // If you need to handle redirects explicitly, not just follow
    });

    // Create a new response to stream the body back
    const responseHeaders = new Headers(externalResponse.headers);
    // Ensure CORS headers are set if needed, though this proxy might handle that if the origin is same
    // responseHeaders.set('Access-Control-Allow-Origin', '*'); 

    return new NextResponse(externalResponse.body, {
      status: externalResponse.status,
      statusText: externalResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`Error proxying to ${targetUrl.toString()}:`, error);
    let message = 'Error proxying request to external API.';
    if (error instanceof Error) {
        message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 502 }); // Bad Gateway
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH, handler as HEAD, handler as OPTIONS }; 