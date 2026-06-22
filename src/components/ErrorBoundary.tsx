import React, { useState, useEffect } from 'react';
import { FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
      try {
        const parsed = JSON.parse(event.error?.message || event.message) as FirestoreErrorInfo;
        if (parsed.error && parsed.operationType) {
          setErrorInfo(parsed);
        }
      } catch (e) {
        // Not a JSON error
      }
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
        <div className="max-w-md w-full p-6 bg-card rounded-xl border shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-destructive">Something went wrong</h2>
          <p className="mb-4 text-muted-foreground">
            {errorInfo 
              ? `A database error occurred during ${errorInfo.operationType}.`
              : "An unexpected error occurred while rendering the application."}
          </p>
          {errorInfo && (
            <div className="p-3 bg-muted rounded text-xs font-mono overflow-auto mb-4">
              {errorInfo.error}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
