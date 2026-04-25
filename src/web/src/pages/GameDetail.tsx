import { useCallback } from 'react';
import { Link, useNavigate, getRouteApi } from '@tanstack/react-router';

const route = getRouteApi('/_auth/game/$platform/$slug');
import {
  useDeleteGame,
  useGameBySlug,
  useGameEvents,
  useGameHistory,
  useGameReleases,
  useGameUpdates,
} from '../queries/games';
import { useLibraries } from '../queries/libraries';
import {
  GameDetailHeader,
  GameInfoSection,
  GameMetadataSection,
  GameReleasesSection,
  GameUpdatesSection,
  GameHistorySection,
  GameEventsSection,
} from '../components/gameDetail';
import { ChevronLeftIcon } from '../components/Icons';

type TabId = 'info' | 'metadata' | 'releases' | 'updates' | 'history' | 'events';

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
  { id: 'events', label: 'Events' },
];

function GameDetail() {
  const { platform, slug } = route.useParams();
  const search = route.useSearch();
  const routeNavigate = route.useNavigate();
  const navigate = useNavigate();

  const gameQuery = useGameBySlug(platform, slug);
  const game = gameQuery.data ?? null;
  const gameId = game?.id;

  const releasesQuery = useGameReleases(gameId);
  const historyQuery = useGameHistory(gameId);
  const updatesQuery = useGameUpdates(gameId);
  const eventsQuery = useGameEvents(gameId);
  const { data: libraries = [] } = useLibraries();
  const deleteGameMutation = useDeleteGame();

  const releases = releasesQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const updates = updatesQuery.data ?? [];
  const events = eventsQuery.data ?? [];

  const activeTab: TabId = search.tab ?? 'info';
  const setActiveTab = useCallback(
    (tab: TabId) => {
      routeNavigate({
        search: (prev) => ({ ...prev, tab: tab === 'info' ? undefined : tab }),
        replace: true,
      });
    },
    [routeNavigate]
  );

  const loading = gameQuery.isLoading;
  const error = gameQuery.isError
    ? (gameQuery.error as Error)?.message || 'Game not found'
    : null;

  const handleDelete = async () => {
    if (!game) return;
    try {
      await deleteGameMutation.mutateAsync(game.id);
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          navigate({ to: '/' });
        });
      } else {
        navigate({ to: '/' });
      }
    } catch {
      // Error surfaces via mutation state; navigation skipped.
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
        <Link
          to="/"
          viewTransition
          className="flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition min-h-[44px]"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back to Library
        </Link>
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 text-center">
          <p className="text-red-200">{error || 'Game not found'}</p>
        </div>
      </div>
    );
  }

  const pendingUpdateCount = updates.filter((u) => u.status === 'pending').length;

  return (
    <div>
      <Link
        to="/"
        viewTransition
        className="flex items-center gap-1 text-gray-400 hover:text-white mb-6 transition min-h-[44px]"
      >
        <ChevronLeftIcon className="w-5 h-5" />
        Back to Library
      </Link>

      <GameDetailHeader game={game} onDelete={handleDelete} />

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
              {tab.id === 'updates' && pendingUpdateCount > 0 && (
                <span className="ml-2 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingUpdateCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'info' && (
          <GameInfoSection game={game} libraries={libraries} />
        )}
        {activeTab === 'metadata' && <GameMetadataSection game={game} />}
        {activeTab === 'releases' && (
          <GameReleasesSection gameId={game.id} releases={releases} />
        )}
        {activeTab === 'updates' && (
          <GameUpdatesSection game={game} updates={updates} />
        )}
        {activeTab === 'history' && (
          <GameHistorySection history={history} releases={releases} />
        )}
        {activeTab === 'events' && <GameEventsSection events={events} />}
      </div>
    </div>
  );
}

export default GameDetail;
