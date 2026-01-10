import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Game, GrabbedRelease, DownloadHistoryEntry, GameUpdate, Library } from '../api/client';
import {
  GameDetailHeader,
  GameInfoSection,
  GameMetadataSection,
  GameReleasesSection,
  GameUpdatesSection,
  GameHistorySection,
} from '../components/gameDetail';
import { ChevronLeftIcon } from '../components/Icons';

type TabId = 'info' | 'metadata' | 'releases' | 'updates' | 'history';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'info', label: 'Info' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'releases', label: 'Releases' },
  { id: 'updates', label: 'Updates' },
  { id: 'history', label: 'History' },
];

function GameDetail() {
  const { platform, slug } = useParams<{ platform: string; slug: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [releases, setReleases] = useState<GrabbedRelease[]>([]);
  const [history, setHistory] = useState<DownloadHistoryEntry[]>([]);
  const [updates, setUpdates] = useState<GameUpdate[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // Load game data
  useEffect(() => {
    const loadGame = async () => {
      if (!platform || !slug) return;

      setLoading(true);
      setError(null);

      const response = await api.getGameBySlug(platform, slug);

      if (response.success && response.data) {
        setGame(response.data);
        // Load additional data
        loadAdditionalData(response.data.id);
      } else {
        setError(response.error || 'Game not found');
      }

      setLoading(false);
    };

    loadGame();
  }, [platform, slug]);

  // Load libraries on mount
  useEffect(() => {
    const loadLibraries = async () => {
      const response = await api.getLibraries();
      if (response.success && response.data) {
        setLibraries(response.data);
      }
    };
    loadLibraries();
  }, []);

  const loadAdditionalData = async (gameId: number) => {
    // Load releases, history, and updates in parallel
    const [releasesRes, historyRes, updatesRes] = await Promise.all([
      api.getGameReleases(gameId),
      api.getGameHistory(gameId),
      api.getGameUpdates(gameId),
    ]);

    if (releasesRes.success && releasesRes.data) {
      setReleases(releasesRes.data);
    }
    if (historyRes.success && historyRes.data) {
      setHistory(historyRes.data);
    }
    if (updatesRes.success && updatesRes.data) {
      setUpdates(updatesRes.data);
    }
  };

  const handleGameUpdate = async () => {
    if (!game) return;
    // Reload game data
    const response = await api.getGame(game.id);
    if (response.success && response.data) {
      setGame(response.data);
    }
  };

  const handleUpdatesChange = async () => {
    if (!game) return;
    const response = await api.getGameUpdates(game.id);
    if (response.success && response.data) {
      setUpdates(response.data);
    }
  };

  const handleDelete = async () => {
    if (!game) return;
    const response = await api.deleteGame(game.id);
    if (response.success) {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-6 w-6 bg-gray-700 rounded"></div>
          <div className="h-6 bg-gray-700 rounded w-32"></div>
        </div>
        <div className="flex gap-6 mb-6">
          <div className="w-48 h-72 bg-gray-700 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-8 bg-gray-700 rounded w-64 mb-4"></div>
            <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
            <div className="flex gap-2">
              <div className="h-10 bg-gray-700 rounded w-32"></div>
              <div className="h-10 bg-gray-700 rounded w-24"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition min-h-[44px]"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back to Library
        </button>
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-200">{error || 'Game not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition min-h-[44px]"
      >
        <ChevronLeftIcon className="w-5 h-5" />
        Back to Library
      </button>

      {/* Header */}
      <GameDetailHeader
        game={game}
        onDelete={handleDelete}
      />

      {/* Tabs */}
      <div className="border-b border-gray-700 mb-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 min-h-[44px] font-medium transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
              }`}
            >
              {tab.label}
              {tab.id === 'updates' && updates.filter(u => u.status === 'pending').length > 0 && (
                <span className="ml-2 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {updates.filter(u => u.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'info' && (
          <GameInfoSection
            game={game}
            libraries={libraries}
            onUpdate={handleGameUpdate}
          />
        )}
        {activeTab === 'metadata' && (
          <GameMetadataSection game={game} />
        )}
        {activeTab === 'releases' && (
          <GameReleasesSection
            gameId={game.id}
            releases={releases}
            onReleaseGrabbed={() => loadAdditionalData(game.id)}
          />
        )}
        {activeTab === 'updates' && (
          <GameUpdatesSection
            game={game}
            updates={updates}
            onUpdatesChange={handleUpdatesChange}
          />
        )}
        {activeTab === 'history' && (
          <GameHistorySection history={history} releases={releases} />
        )}
      </div>
    </div>
  );
}

export default GameDetail;
