import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GamepadIcon } from './Icons';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemProps {
  to: string;
  label: string;
  onClick: () => void;
  end?: boolean;
}

function NavItem({ to, label, onClick, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `block px-4 py-3 text-lg rounded-lg transition ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:bg-gray-700 active:bg-gray-600'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

interface NavGroupProps {
  title: string;
  children: React.ReactNode;
}

function NavGroup({ title, children }: NavGroupProps) {
  return (
    <div className="mb-4">
      <h3 className="px-4 py-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    onClose();
  }, [location.pathname, location.search]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-gray-800 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-blue-500 flex items-center gap-2">
            <GamepadIcon className="w-6 h-6" aria-hidden="true" />
            Gamearr
          </h2>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition"
            aria-label="Close navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto h-[calc(100%-72px)]">
          <NavGroup title="Library">
            <NavItem to="/" label="Games" onClick={onClose} end />
            <NavItem to="/?tab=scan" label="Import" onClick={onClose} />
            <NavItem to="/?tab=health" label="Health" onClick={onClose} />
          </NavGroup>

          <NavGroup title="Browse">
            <NavItem to="/discover" label="Discover" onClick={onClose} />
            <NavItem to="/search" label="Search" onClick={onClose} />
          </NavGroup>

          <NavGroup title="Downloads">
            <NavItem to="/activity" label="Activity" onClick={onClose} />
            <NavItem to="/updates" label="Updates" onClick={onClose} />
          </NavGroup>

          <NavGroup title="Settings">
            <NavItem to="/settings" label="General" onClick={onClose} />
            <NavItem to="/settings?tab=libraries" label="Libraries" onClick={onClose} />
            <NavItem to="/settings?tab=indexers" label="Indexers" onClick={onClose} />
            <NavItem to="/settings?tab=downloads" label="Downloads" onClick={onClose} />
            <NavItem to="/settings?tab=metadata" label="Metadata" onClick={onClose} />
            <NavItem to="/settings?tab=updates" label="Updates" onClick={onClose} />
            <NavItem to="/settings?tab=system" label="System" onClick={onClose} />
          </NavGroup>
        </nav>
      </div>
    </>
  );
}
