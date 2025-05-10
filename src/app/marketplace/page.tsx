'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { withPaymentInterceptor } from 'x402-axios';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

// Matches the structure in api/marketplace/add/route.ts
interface ApiEntry {
  id: string;
  name: string;
  description: string;
  endpointUrl: string; // Original endpoint
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | string; // Updated in marketplaceStore.ts
  parametersSchema: any; // Parsed JSON schema, e.g., { query: { type: 'object' }, body: { type: 'object' } }
  pricePerCall: number;
  x402WrappedUrl: string; // Placeholder for the x402 enabled endpoint
  creatorWalletAddress?: string; // Address for the API creator to receive payments
  createdAt: string;
  // Fields for on-chain payment (to be added by next step)
  // paymentNetwork: string; 
  // paymentCurrencySymbol: string; 
}

interface ApiResponse {
  apis: ApiEntry[];
}

// For displaying API call results or errors
interface InteractionResult {
  data?: any;
  error?: string;
  status?: number;
  statusText?: string;
  isError?: boolean;
}

// ------------- TEMP DEMO KEY -------------
// In production fetch the pk from an env-var, a browser wallet, etc.
const pk = process.env.NEXT_PUBLIC_TEST_PRIVATE_KEY as `0x${string}`;

const account = privateKeyToAccount(pk);

// A Viem wallet-client is what x402 needs to sign the payment message
const walletClient = createWalletClient({
  account,
  transport: http(),
  chain: baseSepolia,
});

// Wrap any Axios instance; you can also pass { baseURL } like the docs
export const x402 = withPaymentInterceptor(axios.create(), walletClient);

export default function MarketplacePage() {
  const [apiList, setApiList] = useState<ApiEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for API Interaction Modal
  const [selectedApiForInteraction, setSelectedApiForInteraction] = useState<ApiEntry | null>(null);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [queryString, setQueryString] = useState('');
  const [requestBodyString, setRequestBodyString] = useState('{}');
  const [interactionResult, setInteractionResult] = useState<InteractionResult | null>(null);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  // const [transactionHash, setTransactionHash] = useState<string | null>(null); // Will be added next

  useEffect(() => {
    const fetchApis = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/marketplace/add'); // GET request by default
        if (!response.ok) {
          throw new Error(`Failed to fetch APIs: ${response.status} ${response.statusText}`);
        }
        const data: ApiResponse = await response.json();
        setApiList(data.apis || []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setApiList([]); // Clear list on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchApis();
  }, []);

  const openInteractionModal = (api: ApiEntry) => {
    setSelectedApiForInteraction(api);
    setQueryString(''); 
    if ((api.httpMethod === 'POST' || api.httpMethod === 'PUT' || api.httpMethod === 'PATCH') && api.parametersSchema?.body) {
        setRequestBodyString(JSON.stringify(api.parametersSchema.body, null, 2)); 
    } else {
        setRequestBodyString('{}');
    }
    setInteractionResult(null);
    setPaymentMessage(null);
    // setTransactionHash(null); // Will be added next
    setIsInteractionModalOpen(true);
  };

  const closeInteractionModal = () => {
    setIsInteractionModalOpen(false);
    setSelectedApiForInteraction(null); 
  };

  const handleApiCall = async () => {
    if (!selectedApiForInteraction) return;

    setInteractionLoading(true);
    setInteractionResult(null);
    setPaymentMessage(null);
    // setTransactionHash(null); // Will be added next

    let targetProxyUrl = selectedApiForInteraction.x402WrappedUrl;
    if (queryString) {
      // Ensure queryString starts with ? or &
      const separator = targetProxyUrl.includes('?') ? '&' : '?';
      targetProxyUrl += `${separator}${queryString.replace(/^[?&]/, '')}`;
    }

    const requestOptions: RequestInit = {
      method: selectedApiForInteraction.httpMethod,
      headers: {
        // Add other headers if needed, e.g., Authorization if you had user tokens
      },
    };

    if (selectedApiForInteraction.httpMethod === 'POST' || 
        selectedApiForInteraction.httpMethod === 'PUT' || 
        selectedApiForInteraction.httpMethod === 'PATCH') {
          
      try {
        // Validate if body is JSON, otherwise send as text? For now, assume JSON if body input is used.
        JSON.parse(requestBodyString); // Validate JSON
        (requestOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
        requestOptions.body = requestBodyString;
      } catch (e) {
        setInteractionResult({ error: 'Request body is not valid JSON.', isError: true, status: 400 });
        setInteractionLoading(false);
        return;
      }
    }

    try {
      const axiosResp = await x402.request({
        url   : targetProxyUrl,
        method: selectedApiForInteraction.httpMethod.toLowerCase(),
        data  : requestOptions.body,
        headers: requestOptions.headers as Record<string,string>,
      });

      const rawText  = JSON.stringify(axiosResp.data);
      const response = axiosResp;            // alias

      // Read body once, then attempt to parse as JSON
      let responseData: any = rawText;
      try {
        responseData = JSON.parse(rawText);
      } catch (_) {
        /* keep as plain text */
      }

      const success = response.status >= 200 && response.status < 300;

      if (!success) {
        // Specific handling for payment errors
        if (response.status === 401 || response.status === 402) {
            let paymentErrMessage = 'Payment is required.';
            if (typeof responseData === 'object' && responseData?.error) {
                paymentErrMessage = responseData.error;
            } else if (typeof responseData === 'string') {
                paymentErrMessage = responseData;
            }
            setPaymentMessage(`${paymentErrMessage} Please check your wallet balance and fund if necessary. Go to /wallet.`);
            setInteractionResult({ 
                error: paymentErrMessage, 
                data: responseData, 
                isError: true, 
                status: response.status, 
                statusText: response.statusText 
            });
        } else {
            // General HTTP error
            setInteractionResult({ 
                error: `API Error: ${response.statusText || 'Failed to fetch'}`, 
                data: responseData, 
                isError: true, 
                status: response.status, 
                statusText: response.statusText 
            });
        }
      } else {
        // Successful API call
        setInteractionResult({ 
            data: responseData, 
            isError: false, 
            status: response.status, 
            statusText: response.statusText 
        });
        if (selectedApiForInteraction.pricePerCall > 0) {
          // Ideally, re-fetch wallet status here to show updated balance.
          // For now, just a message.
          setPaymentMessage(`Successfully called API. Cost: ${selectedApiForInteraction.pricePerCall} ${selectedApiForInteraction.pricePerCall === 1 ? 'unit' : 'units'}. Your wallet balance has been updated.`);
          // if (responseData.transactionHash) { 
          //   setTransactionHash(responseData.transactionHash);
          // }
        }
      }
    } catch (err) {
      console.error('Failed to call API:', err);
      setInteractionResult({ 
        error: err instanceof Error ? err.message : 'An unknown network error occurred.', 
        isError: true 
      });
    } finally {
      setInteractionLoading(false);
    }
  };

  return  (
    <div className="container mx-auto p-4">
      {/* header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">API Marketplace</h1>
        <Link href="/add-api" legacyBehavior>
          <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Add New API
          </a>
        </Link>
      </div>

      {/* loading | error */}
      {isLoading && <p className="text-center text-gray-500">Loading APIs...</p>}
      {error && <p className="text-center text-red-500">Error loading APIs: {error}</p>}

      {/* empty-state */}
      {!isLoading && !error && apiList.length === 0 && (
        <p className="text-center text-gray-500">
          No APIs found in the marketplace yet.&nbsp;
          <Link href="/add-api" className="text-blue-500 hover:underline">
            Add one!
          </Link>
        </p>
      )}

      {/* api cards */}
      {!isLoading && !error && apiList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apiList.map(api => (
            <div
              key={api.id}
              className="bg-white shadow-lg rounded-lg p-6 border border-gray-200 flex flex-col"
            >
              <h2 className="text-xl font-semibold mb-2 text-indigo-600">{api.name}</h2>
              <p className="text-gray-700 mb-3 text-sm h-20 overflow-y-auto">{api.description}</p>

              <div className="space-y-1 text-xs text-gray-600 mb-3">
                <p>
                  <strong>Method:</strong>{' '}
                  <span className="font-mono bg-gray-100 px-1 rounded">{api.httpMethod}</span>
                </p>
                <p>
                  <strong>Original URL:</strong>{' '}
                  <span className="font-mono text-gray-500 break-all">{api.endpointUrl}</span>
                </p>
                <p>
                  <strong>X402 Proxy URL:</strong>{' '}
                  <span className="font-mono text-green-600 break-all">{api.x402WrappedUrl}</span>
                </p>
                <p>
                  <strong>Price:</strong> {api.pricePerCall} units/call
                </p>
                {api.creatorWalletAddress && (
                  <p>
                    <strong>Creator Wallet:</strong> <span className="font-mono text-xs text-blue-500 break-all">{api.creatorWalletAddress}</span>
                  </p>
                )}
                <p>
                  <strong>Parameters Schema:</strong>
                </p>
                <pre className="bg-gray-50 p-2 rounded text-xs max-h-24 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(api.parametersSchema, null, 2)}
                </pre>
              </div>

              <p className="text-xs text-gray-400 mb-4">
                Added: {new Date(api.createdAt).toLocaleDateString()}
              </p>

              <button
                className="mt-auto w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
                onClick={() => openInteractionModal(api)}
              >
                Use API
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────── Interaction Modal ─────────────────── */}
      {isInteractionModalOpen && selectedApiForInteraction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 text-center">
                Interact with: {selectedApiForInteraction.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1 mb-3 text-center">
                {selectedApiForInteraction.description}
              </p>
              <p className="text-xs text-gray-500 text-center mb-3">
                Method:{' '}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {selectedApiForInteraction.httpMethod}
                </span>{' '}
                | Price: {selectedApiForInteraction.pricePerCall} units/call
              </p>

              {/* form fields */}
              <div className="mt-4 space-y-3 text-left">
                {/* query string */}
                {(selectedApiForInteraction.httpMethod === 'GET' ||
                  selectedApiForInteraction.httpMethod === 'DELETE' ||
                  selectedApiForInteraction.parametersSchema?.query) && (
                  <div>
                    <label
                      htmlFor="queryString"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Query String (e.g., param1=value1&param2=value2)
                    </label>
                    <input
                      type="text"
                      id="queryString"
                      value={queryString}
                      onChange={e => setQueryString(e.target.value)}
                      placeholder="id=123&category=books"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
                    />
                  </div>
                )}

                {/* request body */}
                {(selectedApiForInteraction.httpMethod === 'POST' ||
                  selectedApiForInteraction.httpMethod === 'PUT' ||
                  selectedApiForInteraction.httpMethod === 'PATCH') && (
                  <div>
                    <label
                      htmlFor="requestBodyString"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Request Body (JSON)
                    </label>
                    <textarea
                      id="requestBodyString"
                      rows={5}
                      value={requestBodyString}
                      onChange={e => setRequestBodyString(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
                    />

                    {/*  ❗  moved <pre> out of <p> */}
                    <div className="text-xs text-gray-500 mt-1">
                      <p>Original schema might suggest:</p>
                      <pre className="bg-gray-50 p-1 rounded text-xs max-h-20 overflow-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(
                          selectedApiForInteraction.parametersSchema?.body || {},
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* results */}
                {interactionLoading && (
                  <p className="text-blue-500 text-center py-2">Calling API...</p>
                )}
                {paymentMessage && (
                  <p
                    className={`text-sm p-2 my-2 rounded ${
                      paymentMessage.toLowerCase().match(/error|failed|insufficient/)
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {paymentMessage}
                  </p>
                )}
                {interactionResult && (
                  <div className="mt-4 p-3 rounded-md border">
                    <h4
                      className={`font-semibold ${
                        interactionResult.isError ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      API Response&nbsp;(Status: {interactionResult.status || 'N/A'})
                    </h4>
                    <pre className="bg-gray-50 p-2 rounded text-xs max-h-48 overflow-auto whitespace-pre-wrap break-all">
                      {interactionResult.isError
                        ? interactionResult.error
                        : JSON.stringify(interactionResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* actions */}
              <div className="items-center px-4 py-3 mt-4 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleApiCall}
                  disabled={interactionLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-400"
                >
                  {interactionLoading ? 'Calling…' : 'Call API'}
                </button>
                <button
                  onClick={closeInteractionModal}
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}