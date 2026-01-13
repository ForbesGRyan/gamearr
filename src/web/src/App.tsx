import { useEffect, useState, Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  NavLink,
  Navigate,
  useLocation,
  Outlet,
} from 'react-router-dom';
import { GamepadIcon } from './components/Icons';
import { NavDropdown } from './components/NavDropdown';
import { MobileNav } from './components/MobileNav';
import { startBackgroundPreload } from './hooks/usePreloadCache';
import { api } from './api/client';

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
          <div key={i} className="bg-gray-800 rounded-lg overflow-hidden">
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

// Stable className function for NavLink to avoid re-renders
const getNavLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded transition ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-gray-300 hover:bg-gray-700'
  }`;

// Component to check setup status and redirect if needed
function SetupGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  // When on setup page, skip all checking - setup page should always be accessible
  const isOnSetupPage = location.pathname === '/setup';

  // Initialize to false (no checking needed) when on setup page
  const [isChecking, setIsChecking] = useState(!isOnSetupPage);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    // Skip check if on setup page
    if (location.pathname === '/setup') {
      setIsChecking(false);
      setNeedsSetup(false);
      return;
    }

    const checkSetup = async () => {
      setIsChecking(true);
      try {
        const response = await api.getSetupStatus();
        if (response.success && response.data) {
          setNeedsSetup(!response.data.isComplete);
        }
      } catch {
        // If we can't check, assume setup is needed
        setNeedsSetup(true);
      } finally {
        setIsChecking(false);
      }
    };

    // Check setup status when navigating to other pages
    checkSetup();
  }, [location.pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Redirect to setup if needed (and not already there)
  if (needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

// Main layout with header and navigation
function MainLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mobile Navigation Drawer */}
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4 md:space-x-8">
              {/* Hamburger Menu Button - Mobile Only */}
              <button
                onClick={() => setMobileNavOpen(true)}
                className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition"
                aria-label="Open navigation menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <h1 className="text-xl md:text-2xl font-bold text-blue-500 flex items-center gap-2">
                <GamepadIcon className="w-6 h-6 md:w-7 md:h-7" aria-hidden="true" />
                <span className="hidden sm:inline">Gamearr</span>
              </h1>

              {/* Desktop Navigation - Hidden on Mobile */}
              <nav className="hidden md:flex space-x-4" aria-label="Main navigation">
                <NavDropdown
                  label="Library"
                  basePath="/"
                  end
                  items={[
                    { label: 'Games', to: '/', tab: undefined },
                    { label: 'Import', to: '/?tab=scan', tab: 'scan' },
                    { label: 'Health', to: '/?tab=health', tab: 'health' },
                  ]}
                />
                <NavLink to="/discover" viewTransition className={getNavLinkClassName}>
                  Discover
                </NavLink>
                <NavLink to="/search" viewTransition className={getNavLinkClassName}>
                  Search
                </NavLink>
                <NavLink to="/activity" viewTransition className={getNavLinkClassName}>
                  Activity
                </NavLink>
                <NavLink to="/updates" viewTransition className={getNavLinkClassName}>
                  Updates
                </NavLink>
                <NavDropdown
                  label="Settings"
                  basePath="/settings"
                  items={[
                    { label: 'General', to: '/settings', tab: undefined },
                    { label: 'Libraries', to: '/settings?tab=libraries', tab: 'libraries' },
                    { label: 'Indexers', to: '/settings?tab=indexers', tab: 'indexers' },
                    { label: 'Downloads', to: '/settings?tab=downloads', tab: 'downloads' },
                    { label: 'Metadata', to: '/settings?tab=metadata', tab: 'metadata' },
                    { label: 'Updates', to: '/settings?tab=updates', tab: 'updates' },
                    { label: 'System', to: '/settings?tab=system', tab: 'system' },
                  ]}
                />
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8" role="main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

// Root layout that wraps everything with SetupGuard
function RootLayout() {
  return (
    <SetupGuard>
      <Outlet />
    </SetupGuard>
  );
}

// Create the router with data router API for View Transitions support
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Setup page - no header/nav
      {
        path: '/setup',
        element: <Setup />,
      },
      // Main app routes - with header/nav
      {
        element: <MainLayout />,
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
  // Start background preloading of Discover page data
  useEffect(() => {
    startBackgroundPreload();
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
