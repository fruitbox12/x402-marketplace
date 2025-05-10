import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="text-center space-y-12">
        <header className="space-y-4">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            X402 API Marketplace
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
            Discover, publish, and monetize APIs using the power of X402 for seamless, crypto-native payments.
          </p>
        </header>

        <nav className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto w-full">
          <Link href="/marketplace" legacyBehavior>
            <a className="group block p-6 bg-slate-800/50 hover:bg-slate-700/70 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              <h2 className="text-2xl font-semibold text-purple-300 mb-2 group-hover:text-purple-200">Browse Marketplace</h2>
              <p className="text-slate-400 group-hover:text-slate-300">
                Explore and interact with X402-enabled APIs.
              </p>
            </a>
          </Link>

          <Link href="/add-api" legacyBehavior>
            <a className="group block p-6 bg-slate-800/50 hover:bg-slate-700/70 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              <h2 className="text-2xl font-semibold text-pink-300 mb-2 group-hover:text-pink-200">Add Your API</h2>
              <p className="text-slate-400 group-hover:text-slate-300">
                Publish your API and set a price per call.
              </p>
            </a>
          </Link>

          <Link href="/wallet" legacyBehavior>
            <a className="group block p-6 bg-slate-800/50 hover:bg-slate-700/70 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105">
              <h2 className="text-2xl font-semibold text-red-300 mb-2 group-hover:text-red-200">Manage Wallet</h2>
              <p className="text-slate-400 group-hover:text-slate-300">
                Create, fund, and check your mock wallet balance.
              </p>
            </a>
          </Link>
        </nav>

        <p className="text-sm text-slate-500 pt-8">
          This is a demonstration project. Wallet and payments are currently mocked.
        </p>
      </main>

      <footer className="absolute bottom-8 text-center w-full text-slate-600 text-sm">
        Powered by Next.js & X402 Concepts
      </footer>
    </div>
  );
}
