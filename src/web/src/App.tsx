import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Library from './pages/Library';
import Search from './pages/Search';
import Activity from './pages/Activity';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-2xl font-bold text-blue-500">🎮 Gamearr</h1>
                <nav className="flex space-x-4">
                  <Link
                    to="/"
                    className="px-3 py-2 rounded hover:bg-gray-700 transition"
                  >
                    Library
                  </Link>
                  <Link
                    to="/search"
                    className="px-3 py-2 rounded hover:bg-gray-700 transition"
                  >
                    Search
                  </Link>
                  <Link
                    to="/activity"
                    className="px-3 py-2 rounded hover:bg-gray-700 transition"
                  >
                    Activity
                  </Link>
                  <Link
                    to="/settings"
                    className="px-3 py-2 rounded hover:bg-gray-700 transition"
                  >
                    Settings
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Library />} />
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
