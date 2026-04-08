import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const errorHandler = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.error);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1a1a1a] text-white p-8">
        <div className="max-w-md w-full space-y-4 bg-red-900/20 border border-red-500/50 p-6 rounded-xl backdrop-blur-md">
          <h2 className="text-xl font-bold text-red-400">System Error</h2>
          <p className="text-sm text-gray-300 font-mono break-all">
            {error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-bold transition-colors"
            onClick={() => window.location.reload()}
          >
            Reload Console
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
