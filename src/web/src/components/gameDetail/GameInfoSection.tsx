import { useState } from 'react';
import { api, Game, Library, SearchResult } from '../../api/client';
import StoreSelector from '../StoreSelector';
import ConfirmModal from '../ConfirmModal';
import { FolderOpenIcon, PencilIcon, CloseIcon } from '../Icons';

interface GameInfoSectionProps {
  game: Game;
  libraries: Library[];
  onUpdate: () => void;
}

function GameInfoSection({ game, libraries, onUpdate }: GameInfoSectionProps) {
  const [saving, setSaving] = useState(false);

  // Form state
  const [store, setStore] = useState(game.store || null);
  const [libraryId, setLibraryId] = useState<number | null>(game.libraryId || null);
  const [status, setStatus] = useState(game.status);
  const [monitored, setMonitored] = useState(game.monitored);
  const [updatePolicy, setUpdatePolicy] = useState(game.updatePolicy || 'notify');
  const [platform, setPlatform] = useState(game.platform);

  // Rematch state
  const [showRematch, setShowRematch] = useState(false);
  const [rematchQuery, setRematchQuery] = useState('');
  const [rematchResults, setRematchResults] = useState<SearchResult[]>([]);
  const [isSearchingRematch, setIsSearchingRematch] = useState(false);
  const [selectedRematch, setSelectedRematch] = useState<SearchResult | null>(null);
  const [isRematching, setIsRematching] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await api.updateGame(game.id, {
      store,
      libraryId,
      status,
      monitored,
      updatePolicy,
      platform,
    } as Parameters<typeof api.updateGame>[1]);
    setSaving(false);
    onUpdate();
  };

  const handleOpenFolder = async () => {
    if (game.folderPath) {
      await api.openFolder(game.folderPath);
    }
  };

  const handleSearchRematch = async () => {
    if (!rematchQuery.trim()) return;
    setIsSearchingRematch(true);
    setRematchResults([]);
    try {
      const response = await api.searchGames(rematchQuery);
      if (response.success && response.data) {
        setRematchResults(response.data);
      }
    } finally {
      setIsSearchingRematch(false);
    }
  };

  const handleConfirmRematch = async () => {
    if (!selectedRematch) return;
    setIsRematching(true);
    try {
      const response = await api.rematchGame(game.id, selectedRematch.igdbId);
      if (response.success) {
        onUpdate();
        setShowRematch(false);
        setRematchQuery('');
        setRematchResults([]);
        setSelectedRematch(null);
      }
    } finally {
      setIsRematching(false);
    }
  };

  // Check if form has changes
  const hasChanges =
    store !== (game.store || null) ||
    libraryId !== (game.libraryId || null) ||
    status !== game.status ||
    monitored !== game.monitored ||
    updatePolicy !== (game.updatePolicy || 'notify') ||
    platform !== game.platform;

  return (
    <div className="space-y-6">
      {/* Store & Library */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Store & Library</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <StoreSelector
              value={store}
              onChange={setStore}
              label="Digital Store"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Library
            </label>
            <select
              value={libraryId || ''}
              onChange={(e) => setLibraryId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">No Library (General)</option>
              {libraries.map((lib) => (
                <option key={lib.id} value={lib.id}>
                  {lib.name} {lib.platform ? `(${lib.platform})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Platform
            </label>
            <input
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g., PC (Windows)"
            />
          </div>
        </div>
      </div>

      {/* Status & Monitoring */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Status & Monitoring</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Game['status'])}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="wanted">Wanted</option>
              <option value="downloading">Downloading</option>
              <option value="downloaded">Downloaded</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Monitored
            </label>
            <button
              onClick={() => setMonitored(!monitored)}
              className={`w-full px-4 py-2 rounded transition ${
                monitored
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              {monitored ? 'Monitored' : 'Unmonitored'}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Update Policy
            </label>
            <select
              value={updatePolicy}
              onChange={(e) => setUpdatePolicy(e.target.value as 'notify' | 'auto' | 'ignore')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="notify">Notify</option>
              <option value="auto">Auto-grab</option>
              <option value="ignore">Ignore</option>
            </select>
          </div>
        </div>
      </div>

      {/* Folder Path */}
      {game.folderPath && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Installation</h3>
          <div className="flex items-center gap-2">
            <span className="flex-1 bg-gray-700 px-4 py-2 rounded font-mono text-sm text-gray-300 truncate">
              {game.folderPath}
            </span>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition"
            >
              <FolderOpenIcon className="w-5 h-5" />
              Open
            </button>
          </div>
          {game.installedVersion && (
            <p className="text-sm text-gray-400 mt-2">
              Installed version: <span className="text-gray-200">{game.installedVersion}</span>
              {game.installedQuality && (
                <span className="ml-2 bg-gray-700 px-2 py-0.5 rounded text-xs">{game.installedQuality}</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Change IGDB Match */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">IGDB Match</h3>
          {showRematch && (
            <button
              onClick={() => {
                setShowRematch(false);
                setRematchQuery('');
                setRematchResults([]);
              }}
              className="text-gray-400 hover:text-white"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Currently matched to IGDB ID: <span className="text-gray-200 font-mono">{game.igdbId}</span>
        </p>

        {!showRematch ? (
          <button
            onClick={() => {
              setShowRematch(true);
              setRematchQuery(game.title);
            }}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded transition"
          >
            <PencilIcon className="w-5 h-5" />
            Change Match
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={rematchQuery}
                onChange={(e) => setRematchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchRematch()}
                placeholder="Search for correct game..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSearchRematch}
                disabled={isSearchingRematch || !rematchQuery.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition disabled:opacity-50"
              >
                {isSearchingRematch ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {rematchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-2 bg-gray-700 rounded-lg p-2">
                {rematchResults.map((result) => (
                  <button
                    key={result.igdbId}
                    onClick={() => setSelectedRematch(result)}
                    disabled={result.igdbId === game.igdbId}
                    className={`w-full flex items-center gap-3 p-2 rounded text-left transition ${
                      result.igdbId === game.igdbId
                        ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    {result.coverUrl ? (
                      <img
                        src={result.coverUrl}
                        alt={result.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-gray-500 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">?</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {result.title}
                        {result.igdbId === game.igdbId && (
                          <span className="ml-2 text-xs text-green-400">(current)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {result.year || 'Unknown year'}
                        {result.developer && ` - ${result.developer}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Rematch Confirmation Modal */}
      <ConfirmModal
        isOpen={selectedRematch !== null}
        title="Change Game Match"
        message={selectedRematch ? `Change this game's IGDB match from "${game.title}" to "${selectedRematch.title}"? This will update the cover, metadata, and other game information.` : ''}
        confirmText={isRematching ? 'Updating...' : 'Confirm Change'}
        cancelText="Cancel"
        variant="info"
        onConfirm={handleConfirmRematch}
        onCancel={() => setSelectedRematch(null)}
      />
    </div>
  );
}

export default GameInfoSection;
