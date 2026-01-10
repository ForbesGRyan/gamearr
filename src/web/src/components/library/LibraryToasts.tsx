interface LibraryToastsProps {
  error: string | null;
  successMessage: string | null;
}

export function LibraryToasts({ error, successMessage }: LibraryToastsProps) {
  return (
    <>
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-4 z-50 p-4 bg-red-900 border border-red-700 rounded-lg shadow-lg text-red-200 max-w-md animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-900 border border-green-700 rounded-lg shadow-lg text-green-200 max-w-md animate-fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{successMessage}</span>
          </div>
        </div>
      )}
    </>
  );
}
