import { useNavigate } from 'react-router-dom';
import { getGameDetailPath } from '../../utils/slug';
import { MobileCard, MobileCardButton } from '../MobileCard';
import StoreIcon from '../StoreIcon';
import type { Game } from './types';

interface LibraryMobileViewProps {
  games: Game[];
  onToggleMonitor: (id: number) => void;
  onSearch: (game: Game) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
}

function getStatusInfo(status: Game['status']): { label: string; color: 'green' | 'blue' | 'yellow' } {
  switch (status) {
    case 'downloaded':
      return { label: 'Downloaded', color: 'green' };
    case 'downloading':
      return { label: 'Downloading', color: 'blue' };
    case 'wanted':
    default:
      return { label: 'Wanted', color: 'yellow' };
  }
}

export function LibraryMobileView({
  games,
  onToggleMonitor,
  onSearch,
  onEdit,
  onDelete,
}: LibraryMobileViewProps) {
  const navigate = useNavigate();

  return (
    <div className="md:hidden space-y-3">
      {games.map((game) => {
        const statusInfo = getStatusInfo(game.status);
        return (
          <MobileCard
            key={game.id}
            title={game.title}
            subtitle={game.platform}
            image={game.coverUrl}
            status={statusInfo}
            onClick={() => navigate(getGameDetailPath(game.platform, game.title))}
            fields={[
              { label: 'Year', value: game.year || '\u2014' },
              {
                label: 'Store',
                value: game.store ? <StoreIcon store={game.store} /> : <span className="text-gray-500">{'\u2014'}</span>,
              },
              {
                label: 'Monitored',
                value: game.monitored ? (
                  <span className="text-green-400">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                ),
              },
              {
                label: 'Rating',
                value: game.totalRating ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                    game.totalRating >= 95 ? 'bg-sky-500' :
                    game.totalRating >= 90 ? 'bg-green-700' :
                    game.totalRating >= 85 ? 'bg-green-600' :
                    game.totalRating >= 80 ? 'bg-green-500' :
                    game.totalRating >= 70 ? 'bg-yellow-600' :
                    game.totalRating >= 60 ? 'bg-orange-600' : 'bg-red-600'
                  }`}>
                    {game.totalRating}%
                  </span>
                ) : (
                  <span className="text-gray-500">{'\u2014'}</span>
                ),
              },
            ]}
            actions={
              <>
                <MobileCardButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMonitor(game.id);
                  }}
                  variant={game.monitored ? 'secondary' : 'primary'}
                >
                  {game.monitored ? 'Unmonitor' : 'Monitor'}
                </MobileCardButton>
                <MobileCardButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onSearch(game);
                  }}
                >
                  Search
                </MobileCardButton>
                <MobileCardButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(game);
                  }}
                >
                  Edit
                </MobileCardButton>
                <MobileCardButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(game);
                  }}
                  variant="danger"
                >
                  Delete
                </MobileCardButton>
              </>
            }
          />
        );
      })}
    </div>
  );
}
