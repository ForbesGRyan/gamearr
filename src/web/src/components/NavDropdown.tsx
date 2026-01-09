import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  label: string;
  to: string;
  tab?: string;
}

interface NavDropdownProps {
  label: string;
  basePath: string;
  items: NavItem[];
  end?: boolean;
}

export function NavDropdown({ label, basePath, items, end }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Check if current path matches this nav item
  const isActive = end
    ? location.pathname === basePath
    : location.pathname.startsWith(basePath);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    openTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NavLink
        to={basePath}
        end={end}
        viewTransition
        className={`px-3 py-2 rounded transition flex items-center gap-1 ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:bg-gray-700'
        }`}
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </NavLink>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[160px] py-1 z-50">
          {items.map((item) => {
            const searchParams = new URLSearchParams(location.search);
            const currentTab = searchParams.get('tab');
            const isItemActive = location.pathname === basePath &&
              (item.tab ? currentTab === item.tab : !currentTab);

            const handleClick = () => {
              setIsOpen(false);
              // Use navigate with viewTransition for smooth page transitions
              navigate(item.to, { viewTransition: true });
            };

            return (
              <button
                key={item.to}
                type="button"
                className={`block w-full text-left px-4 py-2 text-sm transition ${
                  isItemActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={handleClick}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
