import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { GamepadIcon } from './components/Icons';
import { NavDropdown } from './components/NavDropdown';
import { startBackgroundPreload } from './hooks/usePreloadCache';

// Lazy load all page components for faster initial load
// Library is eagerly fetched since it's the default route
const libraryPromise = import('./pages/Library');
const Library = lazy(() => libraryPromise);
const Discover = lazy(() => import('./pages/Discover'));
const Search = lazy(() => import('./pages/Search'));
const Activity = lazy(() => import('./pages/Activity'));
const Updates = lazy(() => import('./pages/Updates'));
const Settings = lazy(() => import('./pages/Settings'));

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

function App() {
  // Start background preloading of Discover page data
  useEffect(() => {
    startBackgroundPreload();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700" role="banner">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-2">
                  <GamepadIcon className="w-7 h-7" aria-hidden="true" />
                  Gamearr
                </h1>
                <nav className="flex space-x-4" aria-label="Main navigation">
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
                    ]}
                  />
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8" role="main">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Library />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/search" element={<Search />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/updates" element={<Updates />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
