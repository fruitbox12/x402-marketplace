import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

// Represents an account created via CDP SDK
export interface CdpAccount {
  address: string;
  networkType: 'evm' | 'solana'; // To specify the type of account
  createdAt: string;
  // For our mock payment proxy, we'll add a simulated balance.
  // In a real scenario, balance would be checked on-chain.
  mockBalance?: number;
  currency?: string; // e.g., "ETH", "SOL", "MockCoin" for the mock balance
}

let currentCdpAccount: CdpAccount | null = null;

// ────────────── Persistence ──────────────
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'wallet.json');

(() => {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      currentCdpAccount = parsed;
    }
  } catch (_) {
    /* file does not exist yet */
  }
})();

async function persist() {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    await fsPromises.writeFile(DATA_FILE, JSON.stringify(currentCdpAccount, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to persist wallet store:', err);
  }
}

export const getCdpAccount = (): CdpAccount | null => {
  return currentCdpAccount;
};

// Stores the account details after creation via CDP SDK
export const setCdpAccount = (account: Omit<CdpAccount, 'createdAt' | 'mockBalance' | 'currency'> ): CdpAccount => {
  currentCdpAccount = {
    ...account,
    createdAt: new Date().toISOString(),
    mockBalance: 0, // Initialize mock balance
    currency: account.networkType === 'evm' ? 'ETH_TEST' : 'SOL_TEST', // Example currency based on network
  };
  console.log('CDP Account set in store:', currentCdpAccount);
  persist();
  return currentCdpAccount;
};

// Clears the stored CDP account
export const clearCdpAccount = () => {
  currentCdpAccount = null;
  console.log('Stored CDP Account cleared.');
  persist();
};

// Updates the mock balance for the proxy simulation
export const updateMockBalance = (amount: number): CdpAccount | null => {
  if (currentCdpAccount) {
    if (currentCdpAccount.mockBalance === undefined) currentCdpAccount.mockBalance = 0;
    currentCdpAccount.mockBalance += amount;
    console.log('CDP Account mock balance updated:', currentCdpAccount);
    persist();
    return currentCdpAccount;
  }
  return null;
};

// Old Wallet interface and functions (to be removed or commented out)
/*
export interface Wallet {
  address: string;
  balance: number;
  currency: string; 
  createdAt: string;
}
let currentWallet: Wallet | null = null;
export const getWallet = (): Wallet | null => currentWallet;
export const createNewWallet = (initialBalance: number = 0, currency: string = "MockCoin"): Wallet => { ... };
export const updateBalance = (amount: number): Wallet | null => { ... };
export const clearWallet = () => { ... };
*/ 