import { NextResponse } from 'next/server';
import { cdp } from '@/lib/cdpClient'; // Import the initialized CDP client
import { getCdpAccount, updateMockBalance, CdpAccount } from '@/lib/walletStore';

// We'll use a fixed faucet amount for the mock balance update, 
// as the actual faucet amount can vary and is primarily for on-chain balance.
const MOCK_FAUCET_INCREMENT = 1000; // Represents a unit for our mock balance
const FAUCET_NETWORK = "base-sepolia"; // Example network for EVM faucet
const FAUCET_TOKEN = "eth";            // Example token for EVM faucet

export async function POST(request: Request) {
  try {
    if (!cdp) {
      console.error('CDP Client is not initialized. Check .env file and cdpClient.ts logs.');
      return NextResponse.json({ error: 'Wallet service is currently unavailable. CDP Client not initialized.' }, { status: 503 });
    }

    let account = getCdpAccount();

    if (!account) {
      return NextResponse.json({ error: 'No active CDP account. Please create one first.' }, { status: 404 });
    }

    if (account.networkType !== 'evm') {
      // For now, this faucet route only supports EVM accounts based on the CDP example
      return NextResponse.json({ error: `Faucet not supported for ${account.networkType} accounts via this endpoint yet.` }, { status: 400 });
    }

    // Call the actual CDP Faucet API
    console.log(`Requesting ${FAUCET_TOKEN} from ${FAUCET_NETWORK} faucet for address: ${account.address}`);
    const faucetResponse = await cdp.evm.requestFaucet({
      address: account.address,
      network: FAUCET_NETWORK,
      token: FAUCET_TOKEN
    });
    console.log(`Faucet request successful. Transaction hash: ${faucetResponse.transactionHash}`);

    // Update our mock balance for the X402 proxy simulation
    const updatedAccount = updateMockBalance(MOCK_FAUCET_INCREMENT);

    if (!updatedAccount) {
        return NextResponse.json({ error: 'Failed to update mock wallet balance after faucet request.' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Successfully requested ${FAUCET_TOKEN} from ${FAUCET_NETWORK} faucet. Transaction: ${faucetResponse.transactionHash}. Mock balance updated.`, 
      account: updatedAccount, 
      faucetTransactionHash: faucetResponse.transactionHash 
    });

  } catch (error: any) {
    console.error('Error requesting funds from CDP faucet:', error);
    let errorMessage = `Failed to request funds from ${FAUCET_TOKEN} faucet.`;
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 