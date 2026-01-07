import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Library from './pages/Library';
import Discover from './pages/Discover';
import Search from './pages/Search';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
import { GamepadIcon } from './components/Icons';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-2">
                  <GamepadIcon className="w-7 h-7" />
                  Gamearr
                </h1>
                <nav className="flex space-x-4">
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      `px-3 py-2 rounded transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`
                    }
                  >
                    Library
                  </NavLink>
                  <NavLink
                    to="/discover"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`
                    }
                  >
                    Discover
                  </NavLink>
                  <NavLink
                    to="/search"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`
                    }
                  >
                    Search
                  </NavLink>
                  <NavLink
                    to="/activity"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`
                    }
                  >
                    Activity
                  </NavLink>
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`
                    }
                  >
                    Settings
                  </NavLink>
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/search" element={<Search />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
