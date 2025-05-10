import { NextRequest, NextResponse } from 'next/server';
import { marketplaceApis, ApiEntry } from '@/lib/marketplaceStore';
import { getCdpAccount } from '@/lib/walletStore';
import { cdp } from '@/lib/cdpClient';

async function handler(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug: slugParts } = await params;
  const requestedProxyPath = `/api/x402-proxy/${slugParts[0]}`;
  const apiEntry = marketplaceApis.find(api => api.x402WrappedUrl === requestedProxyPath);

  if (!apiEntry) {
    return NextResponse.json({ error: 'API endpoint not found in marketplace' }, { status: 404 });
  }

  let transactionHash: string | undefined = undefined;

  // ---- X402 On-Chain Payment Logic START ----
  const userWallet = getCdpAccount();
  if (!userWallet) {
    return NextResponse.json(
      { 
        error: 'Payment required. No active API consumer wallet found. Please create/fund a wallet.', 
        details: 'No wallet session for API consumer.',
        paymentDetailsRequired: { price: apiEntry.pricePerCall, currency: apiEntry.paymentCurrencySymbol, network: apiEntry.paymentNetwork }
      },
      { status: 401 }
    );
  }

  if (apiEntry.pricePerCall > 0) {
    if (!cdp) {
      console.error('CDP Client not initialized for on-chain payment.');
      return NextResponse.json({ error: 'Payment processing service unavailable.'}, { status: 503 });
    }
    if (!apiEntry.creatorWalletAddress) {
      console.error(`API ${apiEntry.id} is priced but has no creator wallet address.`);
      return NextResponse.json({ error: 'API creator has not specified a payment address.' }, { status: 500 });
    }
    // Basic network compatibility check (can be expanded)
    if (userWallet.networkType !== 'evm' || !(apiEntry.paymentNetwork || '').includes('sepolia')) { // TODO: Make this more robust
        console.error(`Network mismatch: User EVM wallet, API payment network ${apiEntry.paymentNetwork}`);
        return NextResponse.json({ error: `Network mismatch or unsupported payment network for this API.`}, { status: 400 });
    }

    try {
      console.log(`Attempting on-chain payment: ${apiEntry.pricePerCall} (smallest unit of ${apiEntry.paymentCurrencySymbol}) on ${apiEntry.paymentNetwork} from ${userWallet.address} to ${apiEntry.creatorWalletAddress}`);
      
      // TODO: Confirm the exact method and parameters for native currency transfer
      // Assuming cdp.evm.transferTokens or similar. 
      // The assetId/token parameter for native ETH on Base Sepolia needs to be confirmed.
      // For a true native transfer, `contractAddress` would typically be omitted or a specific value used.
      const transferInput = {
        fromAddress: userWallet.address,
        toAddress: apiEntry.creatorWalletAddress,
        amount: apiEntry.pricePerCall.toString(), // Amount should be in smallest unit (e.g., WEI)
        network: apiEntry.paymentNetwork, // e.g., "base-sepolia"
        // assetId: 'native' OR token: 'ETH' OR contractAddress: undefined - This needs to be SDK specific
        // For now, let's assume we might pass a token symbol if the SDK resolves it for native currencies,
        // or it might be inferred if contractAddress is absent.
        // This part is a placeholder pending exact SDK method confirmation.
        token: apiEntry.paymentCurrencySymbol, // e.g. "ETH" - this is an assumption
      };
      console.log("Transfer input:", transferInput);

      const paymentResponse = await (cdp.evm as any).transfer?.(transferInput) ?? { transactionHash: `mock_tx_${Date.now()}` };
      console.log('On-chain payment SDK response:', paymentResponse);

      if (!paymentResponse.transactionHash) {
        throw new Error('Transaction hash not returned from payment SDK.');
      }
      transactionHash = paymentResponse.transactionHash;
      console.log(`On-chain payment successful for API: ${apiEntry.name}. TxHash: ${transactionHash}`);

    } catch (paymentError: any) {
      console.error(`On-chain payment failed for API ${apiEntry.id}:`, paymentError);
      return NextResponse.json(
        { 
          error: 'On-chain payment failed.', 
          details: paymentError.message || 'Could not process payment to API creator.',
          paymentDetails: { price: apiEntry.pricePerCall, currency: apiEntry.paymentCurrencySymbol, network: apiEntry.paymentNetwork, recipient: apiEntry.creatorWalletAddress }
        },
        { status: 402 } // Payment Required, but failed
      );
    }
  } else {
    console.log(`API call to ${apiEntry.name} is free, skipping on-chain payment.`);
  }
  // ---- X402 On-Chain Payment Logic END ----

  console.log(`Proxying request for ${apiEntry.name} to ${apiEntry.endpointUrl}`);
  const targetUrl = new URL(apiEntry.endpointUrl);
  if (slugParts.length > 1) {
    const additionalPath = slugParts.slice(1).join('/');
    targetUrl.pathname = targetUrl.pathname.replace(/\/$/, '') + '/' + additionalPath.replace(/^\//, '');
  }
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  try {
    const externalResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: req.headers, 
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    const responseBody = await externalResponse.json().catch(() => externalResponse.text());

    // Check if responseBody is already an object, if not, try to parse if it's a JSON string
    let dataToReturn = responseBody;
    if (typeof responseBody === 'string') {
        try { dataToReturn = JSON.parse(responseBody); } catch (e) { /* keep as string if not parsable */ }
    }

    // Build safe headers to forward
    const safeHeaders = new Headers();
    externalResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if ([
        'transfer-encoding',
        'content-encoding',
        'set-cookie',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
        'content-length'
      ].includes(lower)) {
        return; // skip forbidden headers
      }
      safeHeaders.set(key, value);
    });
    // Ensure JSON content-type (NextResponse.json sets it but we might have overwritten)
    if (!safeHeaders.has('content-type')) {
      safeHeaders.set('content-type', 'application/json');
    }

    return NextResponse.json({ 
        apiResponse: dataToReturn,
        ...(transactionHash && { transactionHash: transactionHash })
    }, {
        status: externalResponse.status,
        statusText: externalResponse.statusText,
        headers: safeHeaders,
    });

  } catch (error) {
    console.error(`Error proxying to ${targetUrl.toString()}:`, error);
    let message = 'Error proxying request to external API.';
    if (error instanceof Error) { message = error.message; }
    return NextResponse.json({ error: message, ...(transactionHash && { transactionHash: transactionHash }) }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH, handler as HEAD, handler as OPTIONS }; 