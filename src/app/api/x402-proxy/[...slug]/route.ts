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
      
      // Retrieve the signer account object managed by CDP
      const senderAccount = await cdp.evm.getAccount({ address: userWallet.address as any });

      // Fetch current balances for logging / sanity-check
      let ethBalanceDec: string | undefined;
      try {
        const balResp = await (senderAccount as any).listTokenBalances({ network: apiEntry.paymentNetwork as any });
        const ethEntry = balResp?.balances?.find((b: any) => {
          const sym = b.token?.symbol?.toLowerCase();
          const addr = (b.token?.contractAddress || '').toLowerCase();
          return sym === 'eth' || addr === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        });
        if (ethEntry) {
          const raw = BigInt(ethEntry.amount.amount); // wei
          const decimals = Number(ethEntry.amount.decimals);
          ethBalanceDec = (Number(raw) / 10 ** decimals).toString();
        }
        console.log(`User wallet balance on ${apiEntry.paymentNetwork}:`, ethBalanceDec);
      } catch (balErr) {
        console.warn('Could not fetch wallet balance:', balErr);
      }

      console.log("pricePerCall", apiEntry.pricePerCall)

      const amountEth = (apiEntry.paymentCurrencySymbol?.toUpperCase() === 'ETH')
        ? (Number(apiEntry.pricePerCall)).toString()
        : apiEntry.pricePerCall.toString();

      if (ethBalanceDec && Number(ethBalanceDec) < Number(amountEth)) {
        return NextResponse.json({ error: 'Insufficient balance for payment', required: amountEth, balance: ethBalanceDec }, { status: 402 });
      }

      // @ts-ignore – types for transfer expect stricter literal types; casting for runtime call
      const paymentResponse = await (senderAccount as any).transfer({
        to: apiEntry.creatorWalletAddress as any,
        amount: amountEth,
        token: (apiEntry.paymentCurrencySymbol || 'ETH').toLowerCase() as any,
        network: apiEntry.paymentNetwork as any,
      });

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

  // Copy any query params from incoming request
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  // ───── Inject upstream API-key if required ─────
  const outgoingHeaders = new Headers(req.headers);

  if (apiEntry.authType === 'HEADER' && apiEntry.apiKeyName && apiEntry.apiKeySecret) {
    outgoingHeaders.set(apiEntry.apiKeyName, apiEntry.apiKeySecret);
  }

  if (apiEntry.authType === 'QUERY' && apiEntry.apiKeyName && apiEntry.apiKeySecret) {
    targetUrl.searchParams.set(apiEntry.apiKeyName, apiEntry.apiKeySecret);
  }

  try {
    // ---- DEBUG LOGS ----
    console.log('[X402 Proxy] Forwarding to:', targetUrl.toString());
    console.log('[X402 Proxy] Method:', req.method);
    console.log('[X402 Proxy] Outgoing headers:', Object.fromEntries(outgoingHeaders.entries()));

    let outboundBody: any = undefined;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // To avoid the "duplex option is required" error, we read the incoming
      // request body as text (assumes JSON for our use-case) and forward it
      // as a string. This is safe for JSON APIs and sidesteps the stream issue.
      try {
        outboundBody = await req.text();
        console.log('[X402 Proxy] Body length (bytes):', outboundBody?.length || 0);
      } catch (readErr) {
        console.warn('[X402 Proxy] Could not read request body:', readErr);
      }
    }

    const externalResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: outgoingHeaders,
      ...(outboundBody !== undefined && { body: outboundBody, duplex: 'half' as const }),
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