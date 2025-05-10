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
  return currentCdpAccount;
};

// Clears the stored CDP account
export const clearCdpAccount = () => {
  currentCdpAccount = null;
  console.log('Stored CDP Account cleared.');
};

// Updates the mock balance for the proxy simulation
export const updateMockBalance = (amount: number): CdpAccount | null => {
  if (currentCdpAccount) {
    if (currentCdpAccount.mockBalance === undefined) currentCdpAccount.mockBalance = 0;
    currentCdpAccount.mockBalance += amount;
    console.log('CDP Account mock balance updated:', currentCdpAccount);
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