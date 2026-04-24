import { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
  Outlet,
} from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { MainLayout } from './components/layouts/MainLayout';
import { useSetupStatus } from './queries/system';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';

// Lazy load all page components for faster initial load
// Library is eagerly fetched since it's the default route
const libraryPromise = import('./pages/Library');
const Library = lazy(() => libraryPromise);
const GameDetail = lazy(() => import('./pages/GameDetail'));
const Discover = lazy(() => import('./pages/Discover'));
const Search = lazy(() => import('./pages/Search'));
const Activity = lazy(() => import('./pages/Activity'));
const Updates = lazy(() => import('./pages/Updates'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
// Setup is eagerly loaded to avoid lazy-loading timing issues with navigation
import { Setup } from './pages/Setup';

// Loading skeleton that resembles the Library page
function PageLoader() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-9 bg-gray-700 rounded w-32"></div>
        <div className="h-10 bg-blue-600 rounded w-28"></div>
      </div>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 mb-6">
        <div className="h-10 w-20 border-b-2 border-blue-500"></div>
        <div className="h-10 w-20"></div>
        <div className="h-10 w-20"></div>
      </div>
      {/* Filter bar */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4 flex-wrap">
        <div className="h-9 bg-gray-700 rounded w-44"></div>
        <div className="h-9 bg-gray-700 rounded w-36"></div>
        <div className="h-9 bg-gray-700 rounded w-28"></div>
        <div className="h-9 bg-gray-700 rounded w-36"></div>
      </div>
      {/* Game grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={`skeleton-${i}`} className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="aspect-[2/3] bg-gray-700"></div>
            <div className="p-3">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-3/5"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to check setup status and redirect if needed
function SetupGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  // When on setup page, skip all checking — setup page should always be
  // accessible. Matches the pre-migration behavior in main; there is a known
  // e2e test ("setup redirects to home if already completed") that expects
  // a redirect away from /setup once setup is marked complete, but that
  // case was never handled by the original SetupGuard either. Leaving it
  // that way here rather than regressing other screenshot tests.
  const isOnSetupPage = location.pathname === '/setup';

  const { data, isLoading, isError } = useSetupStatus();

  if (isOnSetupPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // If we can't check, assume setup is needed (matches prior behavior).
  const needsSetup = isError ? true : !(data?.isComplete ?? false);

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

// Layout wrapper that renders MainLayout with react-router-dom's Outlet
function MainLayoutWithOutlet() {
  return (
    <MainLayout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </MainLayout>
  );
}

// Root layout that wraps everything with SetupGuard
function RootLayout() {
  return (
    <SetupGuard>
      <ToastContainer />
      <Outlet />
    </SetupGuard>
  );
}

// Create the router with data router API for View Transitions support
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Auth pages - no header/nav
      {
        path: '/login',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Login />
          </Suspense>
        ),
      },
      {
        path: '/register',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Register />
          </Suspense>
        ),
      },
      // Setup page - no header/nav
      {
        path: '/setup',
        element: <Setup />,
      },
      // Main app routes - with header/nav, protected by AuthGuard
      {
        element: (
          <AuthGuard>
            <MainLayoutWithOutlet />
          </AuthGuard>
        ),
        children: [
          {
            path: '/',
            element: <Library />,
          },
          {
            path: '/game/:platform/:slug',
            element: <GameDetail />,
          },
          {
            path: '/discover',
            element: <Discover />,
          },
          {
            path: '/search',
            element: <Search />,
          },
          {
            path: '/activity',
            element: <Activity />,
          },
          {
            path: '/updates',
            element: <Updates />,
          },
          {
            path: '/settings',
            element: <Settings />,
          },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}

export default App;
