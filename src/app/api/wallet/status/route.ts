import { NextResponse } from 'next/server';
import { getCdpAccount } from '@/lib/walletStore';

export async function GET(request: Request) {
  try {
    const account = getCdpAccount();

    if (!account) {
      return NextResponse.json({ message: 'No active CDP account found. Please create one.', account: null }, { status: 200 }); // Or 404 if preferred
    }

    return NextResponse.json({ message: 'Current CDP account status', account });

  } catch (error) {
    console.error('Error fetching CDP account status:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 