import { NextResponse } from 'next/server';
import { cdp } from '@/lib/cdpClient'; // Import the initialized CDP client
import { getCdpAccount, setCdpAccount, CdpAccount } from '@/lib/walletStore';

export async function POST(request: Request) {
  try {
    if (!cdp) {
      console.error('CDP Client is not initialized. Check .env file and cdpClient.ts logs.');
      return NextResponse.json({ error: 'Wallet service is currently unavailable. CDP Client not initialized.' }, { status: 503 });
    }

    let existingAccount = getCdpAccount();
    if (existingAccount) {
      // For simplicity, if an account (EVM or Solana) already exists in our store, we don't create another one.
      // A more advanced app might allow multiple named accounts.
      return NextResponse.json({ message: 'An account already exists in the current session.', account: existingAccount }, { status: 200 });
    }

    // For now, we'll default to creating an EVM account.
    // We could extend this to take a parameter for 'evm' or 'solana'.
    const newCdpEvmAccount = await cdp.evm.createAccount();
    console.log(`Created EVM account via CDP SDK: ${newCdpEvmAccount.address}`);

    // Store this new account in our application's wallet store
    const appAccount = setCdpAccount({
      address: newCdpEvmAccount.address,
      networkType: 'evm',
      // mockBalance and currency will be set by setCdpAccount
    });

    return NextResponse.json({ 
      message: 'EVM Account created successfully via CDP SDK.', 
      account: appAccount 
    });

  } catch (error: any) {
    console.error('Error creating EVM account via CDP SDK:', error);
    let errorMessage = 'Failed to create EVM account.';
    if (error.response && error.response.data && error.response.data.message) {
      // If the CDP SDK error has a specific message structure
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 