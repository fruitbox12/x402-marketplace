'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CdpAccount } from '@/lib/walletStore'; // Updated import

export default function WalletPage() {
  const [account, setAccount] = useState<CdpAccount | null>(null); // Renamed state variable
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [faucetTxHash, setFaucetTxHash] = useState<string | null>(null);
  const [balanceWei, setBalanceWei] = useState<string | null>(null);

  const fetchAccountStatus = async () => { // Renamed function
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/wallet/status');
      const data = await response.json();
      if (response.ok) {
        setAccount(data.account); // Use setAccount
        if (!data.account) {
          setMessage('No active CDP account. Create one below.');
        } else {
          setFaucetTxHash(null);
          setBalanceWei(data.balanceWei || null);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch account status');
      }
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'An unknown error occurred fetching status.');
      setAccount(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountStatus(); // Call renamed function
  }, []);

  const handleCreateAccount = async () => { // Renamed function
    setIsLoading(true);
    setMessage(null);
    try {
      // This endpoint now specifically creates an EVM account by default
      const response = await fetch('/api/wallet/create', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setAccount(data.account);
        setMessage(data.message || 'Account action successful.');
      } else {
        throw new Error(data.error || 'Failed to create account');
      }
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'An unknown error occurred creating account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaucetFund = async () => {
    if (!account) {
      setMessage('Please create or load an account first.');
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/wallet/faucet', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setAccount(data.account);
        setFaucetTxHash(data.txHash || data.faucetTransactionHash || null);
        setBalanceWei(data.balanceWei || null);
        setMessage(data.message || 'Faucet funding successful.');
      } else {
        throw new Error(data.error || 'Failed to fund from faucet');
      }
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'An unknown error occurred during faucet funding.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">CDP Wallet Management</h1>
        <Link href="/marketplace" legacyBehavior>
          <a className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
            Back to Marketplace
          </a>
        </Link>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md ${message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200 mb-6">
        <h2 className="text-xl font-semibold mb-3 text-indigo-600">Account Status</h2>
        {isLoading && <p>Loading account details...</p>}
        {!isLoading && account && (
          <div className="space-y-2">
            <p><strong>Address:</strong> <span className="font-mono text-sm text-gray-700 break-all">{account.address}</span></p>
            <p><strong>Network Type:</strong> <span className="font-semibold">{account.networkType.toUpperCase()}</span></p>
            <p><strong>Created:</strong> <span className="text-xs text-gray-500">{new Date(account.createdAt).toLocaleString()}</span></p>
            {faucetTxHash && (
              <p><strong>Last Faucet Tx:</strong> <a href={`https://sepolia.basescan.org/tx/${faucetTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{faucetTxHash}</a></p>
            )}
            {balanceWei && (
              <p><strong>On-chain Balance:</strong> <span className="font-semibold">{(Number(balanceWei)/1e18).toFixed(4)} ETH</span></p>
            )}
          </div>
        )}
        {!isLoading && !account && (
          <p>No CDP account information available for this session. Try creating one.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleCreateAccount}
          disabled={isLoading || !!account} 
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {account ? 'EVM Account Exists' : 'Create EVM Account (CDP)'}
        </button>
        <button
          onClick={fetchAccountStatus} 
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
        >
          Refresh Account Status
        </button>
        <button
          onClick={handleFaucetFund}
          disabled={isLoading || !account || account.networkType !== 'evm'}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Fund EVM Account (Base Sepolia ETH Faucet)
        </button>
      </div>
    </div>
  );
} 