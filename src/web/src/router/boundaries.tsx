import { Link } from '@tanstack/react-router';

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong.';
}

export function RouteErrorComponent({ error, reset }: { error: unknown; reset?: () => void }) {
  return (
    <div className="max-w-lg mx-auto my-12 bg-red-900/40 border border-red-700 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-red-100 mb-2">Something broke</h2>
      <p className="text-red-200 text-sm mb-4 break-words">{extractMessage(error)}</p>
      <div className="flex gap-2">
        {reset && (
          <button
            type="button"
            onClick={reset}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition text-sm"
          >
            Retry
          </button>
        )}
        <Link
          to="/"
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition text-sm"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

export function RoutePendingComponent() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}

export function RouteNotFoundComponent() {
  return (
    <div className="max-w-lg mx-auto my-16 text-center">
      <p className="text-5xl mb-4">🔎</p>
      <h2 className="text-2xl font-semibold text-white mb-2">Page not found</h2>
      <p className="text-gray-400 text-sm mb-6">
        The URL you followed doesn't match any known route.
      </p>
      <Link
        to="/"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition"
      >
        Back to Library
      </Link>
    </div>
  );
}
