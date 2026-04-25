import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { GamepadIcon } from '../Icons';
import { NavDropdown } from '../NavDropdown';
import { MobileNav } from '../MobileNav';
import { UpdateBanner } from '../UpdateBanner';
import { DryRunBanner } from '../DryRunBanner';
import { useAuth } from '../AuthGuard';

const NAV_BASE = 'px-3 py-2 rounded transition text-gray-300 hover:bg-gray-700';
const NAV_ACTIVE = 'px-3 py-2 rounded transition bg-blue-600 text-white';

function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="hidden sm:inline">{user.username}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" role="presentation" onClick={() => setIsOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }} />

          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-sm text-white font-medium">{user.username}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
            <div className="py-1">
              <Link
                to="/settings"
                search={{ tab: 'security' }}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Security Settings
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <header className="bg-gray-800 border-b border-gray-700" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4 md:space-x-8">
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
                <Link
                  to="/discover"
                  viewTransition
                  className={NAV_BASE}
                  activeProps={{ className: NAV_ACTIVE }}
                >
                  Discover
                </Link>
                <Link
                  to="/search"
                  viewTransition
                  className={NAV_BASE}
                  activeProps={{ className: NAV_ACTIVE }}
                >
                  Search
                </Link>
                <Link
                  to="/activity"
                  viewTransition
                  className={NAV_BASE}
                  activeProps={{ className: NAV_ACTIVE }}
                >
                  Activity
                </Link>
                <Link
                  to="/updates"
                  viewTransition
                  className={NAV_BASE}
                  activeProps={{ className: NAV_ACTIVE }}
                >
                  Updates
                </Link>
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
                    { label: 'Security', to: '/settings?tab=security', tab: 'security' },
                  ]}
                />
              </nav>
            </div>

            <UserMenu />
          </div>
        </div>
      </header>

      <DryRunBanner />
      <UpdateBanner />

      <main className="container mx-auto px-4 py-6 md:py-8" role="main">
        {children}
      </main>
    </div>
  );
}
