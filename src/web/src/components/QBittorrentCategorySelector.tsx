import { useState, useEffect, useRef } from 'react';
import {
  useQBittorrentCategories,
  useQBittorrentCategory,
  useUpdateQBittorrentCategory,
} from '../queries/settings';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

function QBittorrentCategorySelector() {
  const categoriesQuery = useQBittorrentCategories();
  const selectedQuery = useQBittorrentCategory();
  const updateCategory = useUpdateQBittorrentCategory();

  const categories = (categoriesQuery.data ?? []) as string[];
  const savedCategory = (selectedQuery.data ?? '') as string;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local form state with server value whenever it changes
  useEffect(() => {
    setSelectedCategory(savedCategory);
  }, [savedCategory]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
    };
  }, []);

  const isLoading = categoriesQuery.isLoading || selectedQuery.isLoading;
  const isSaving = updateCategory.isPending;
  const loadError = categoriesQuery.isError
    ? 'Failed to load categories. Make sure qBittorrent is configured and running.'
    : null;
  const displayError = error ?? loadError;

  const handleSave = async () => {
    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    setError(null);
    setSaveMessage(null);

    try {
      await updateCategory.mutateAsync(selectedCategory);
      setSaveMessage('Category filter saved successfully!');
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
      saveMessageTimeoutRef.current = setTimeout(
        () => setSaveMessage(null),
        SUCCESS_MESSAGE_TIMEOUT_MS
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save category';
      setError(message);
    }
  };

  const handleReset = () => {
    void categoriesQuery.refetch();
    void selectedQuery.refetch();
    setSelectedCategory(savedCategory);
    setSaveMessage(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-700 rounded-lg p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-semibold mb-4 text-white">Activity Page Filter</h3>
        <p className="text-gray-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4 md:p-6">
      <h3 className="text-lg md:text-xl font-semibold mb-2 text-white">Activity Page Filter</h3>
      <p className="text-gray-300 mb-4 text-sm">
        Filter which torrents appear in the Activity page. This does not affect downloads - configure download categories per-library in Settings {'>'} Libraries.
      </p>

      {displayError && (
        <div className="bg-red-900 mb-4 p-3 border border-red-700 rounded text-red-200 text-sm">
          {displayError}
        </div>
      )}

      {saveMessage && (
        <div className="bg-green-700 mb-4 p-3 border border-green-700 rounded text-green-200 text-sm">
          {saveMessage}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-gray-600 p-4 rounded text-center">
          <p className="text-gray-300 text-sm">
            No categories found in qBittorrent. Categories will be created automatically when you download releases.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="qb-category" className="block text-sm text-gray-300 mb-2">qBittorrent Category</label>
          <select
            id="qb-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-600 w-full px-4 py-3 md:py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white mb-4 text-base"
          >
            <option value="">Select a category...</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category || '(No category)'}
              </option>
            ))}
          </select>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedCategory}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-6 py-3 md:py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white min-h-[44px]"
            >
              {isSaving ? 'Saving...' : 'Save Category'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="w-full sm:w-auto bg-gray-500 hover:bg-gray-400 px-6 py-3 md:py-2 rounded transition disabled:opacity-50 text-white min-h-[44px]"
            >
              Reset
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            This only filters what's shown in Activity. Download categories are set per-library in Settings {'>'} Libraries.
          </p>
        </div>
      )}
    </div>
  );
}

export default QBittorrentCategorySelector;
