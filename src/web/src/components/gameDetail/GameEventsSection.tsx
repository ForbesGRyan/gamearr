import {
  GameEvent,
  GameEventType,
  SteamImportEventData,
  GogImportEventData,
  IgdbRematchEventData,
} from '../../api/client';
import { MobileCard } from '../MobileCard';

interface GameEventsSectionProps {
  events: GameEvent[];
}

function GameEventsSection({ events }: GameEventsSectionProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (eventType: GameEventType) => {
    switch (eventType) {
      case 'imported_steam':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        );
      case 'imported_gog':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        );
      case 'igdb_rematch':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'imported_manual':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      case 'folder_matched':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getEventColor = (eventType: GameEventType) => {
    switch (eventType) {
      case 'imported_steam':
        return 'bg-blue-600';
      case 'imported_gog':
        return 'bg-purple-600';
      case 'igdb_rematch':
        return 'bg-yellow-600';
      case 'imported_manual':
        return 'bg-green-600';
      case 'folder_matched':
        return 'bg-cyan-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getEventTitle = (event: GameEvent): string => {
    switch (event.eventType) {
      case 'imported_steam':
        return 'Imported from Steam';
      case 'imported_gog':
        return 'Imported from GOG';
      case 'igdb_rematch':
        return 'IGDB Match Changed';
      case 'imported_manual':
        return 'Added Manually';
      case 'folder_matched':
        return 'Matched to Folder';
      case 'status_changed':
        return 'Status Changed';
      default:
        return 'Event';
    }
  };

  const getEventDescription = (event: GameEvent): React.ReactNode => {
    if (!event.data) return null;

    try {
      const data = JSON.parse(event.data);

      switch (event.eventType) {
        case 'imported_steam': {
          const steamData = data as SteamImportEventData;
          if (steamData.steamName !== steamData.matchedTitle) {
            return (
              <div className="text-sm text-gray-400 mt-1">
                <span className="text-gray-500">Original name:</span>{' '}
                <span className="text-gray-300">"{steamData.steamName}"</span>
                <span className="text-gray-500 mx-1">{'->'}</span>
                <span className="text-gray-300">"{steamData.matchedTitle}"</span>
              </div>
            );
          }
          return (
            <div className="text-sm text-gray-400 mt-1">
              Steam App ID: {steamData.steamAppId}
            </div>
          );
        }
        case 'imported_gog': {
          const gogData = data as GogImportEventData;
          if (gogData.gogTitle !== gogData.matchedTitle) {
            return (
              <div className="text-sm text-gray-400 mt-1">
                <span className="text-gray-500">Original name:</span>{' '}
                <span className="text-gray-300">"{gogData.gogTitle}"</span>
                <span className="text-gray-500 mx-1">{'->'}</span>
                <span className="text-gray-300">"{gogData.matchedTitle}"</span>
              </div>
            );
          }
          return (
            <div className="text-sm text-gray-400 mt-1">
              GOG ID: {gogData.gogId}
            </div>
          );
        }
        case 'igdb_rematch': {
          const rematchData = data as IgdbRematchEventData;
          return (
            <div className="text-sm text-gray-400 mt-1">
              <span className="text-gray-300">"{rematchData.previousTitle}"</span>
              <span className="text-gray-500 mx-1">{'->'}</span>
              <span className="text-gray-300">"{rematchData.newTitle}"</span>
              <div className="text-xs text-gray-500 mt-0.5">
                IGDB: {rematchData.previousIgdbId} {'->'} {rematchData.newIgdbId}
              </div>
            </div>
          );
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  };

  const getStatusInfo = (
    eventType: GameEventType
  ): { label: string; color: 'green' | 'blue' | 'yellow' | 'purple' | 'cyan' | 'gray' } => {
    switch (eventType) {
      case 'imported_steam':
        return { label: 'Steam', color: 'blue' };
      case 'imported_gog':
        return { label: 'GOG', color: 'purple' };
      case 'igdb_rematch':
        return { label: 'Rematch', color: 'yellow' };
      case 'imported_manual':
        return { label: 'Manual', color: 'green' };
      case 'folder_matched':
        return { label: 'Folder', color: 'cyan' };
      default:
        return { label: 'Event', color: 'gray' };
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No events recorded for this game yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Game Events</h3>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {events.map((event) => (
          <MobileCard
            key={event.id}
            title={getEventTitle(event)}
            subtitle={formatDate(event.createdAt)}
            status={getStatusInfo(event.eventType)}
            fields={[]}
          >
            {getEventDescription(event)}
          </MobileCard>
        ))}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

        {/* Timeline items */}
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className={`absolute left-2 w-5 h-5 rounded-full ${getEventColor(event.eventType)} flex items-center justify-center`}
              >
                {getEventIcon(event.eventType)}
              </div>

              {/* Content */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{getEventTitle(event)}</p>
                    {getEventDescription(event)}
                  </div>
                  <div className="text-right text-sm text-gray-400 shrink-0">
                    {formatDate(event.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GameEventsSection;
