import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

function QBittorrentCategorySelector() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCategories();

    // Cleanup timeout on unmount
    return () => {
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
    };
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load available categories from qBittorrent
      const categoriesResponse = await api.getQBittorrentCategories();
      if (categoriesResponse.success && categoriesResponse.data) {
        setCategories(categoriesResponse.data as string[]);
      } else {
        setError('Failed to load categories from qBittorrent');
      }

      // Load selected category
      const selectedResponse = await api.getQBittorrentCategory();
      if (selectedResponse.success && selectedResponse.data) {
        setSelectedCategory(selectedResponse.data as string);
      }
    } catch (err) {
      setError('Failed to load categories. Make sure qBittorrent is configured and running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await api.updateQBittorrentCategory(selectedCategory);
      if (response.success) {
        setSaveMessage('Category filter saved successfully!');
        // Clear any existing timeout before setting a new one
        if (saveMessageTimeoutRef.current) {
          clearTimeout(saveMessageTimeoutRef.current);
        }
        saveMessageTimeoutRef.current = setTimeout(() => setSaveMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(response.error || 'Failed to save category');
      }
    } catch (err) {
      setError('Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    loadCategories();
    setSaveMessage(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-white">Activity Page Filter</h3>
        <p className="text-gray-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-2 text-white">Activity Page Filter</h3>
      <p className="text-gray-300 mb-4 text-sm">
        Filter which torrents appear in the Activity page. This does not affect downloads - configure download categories per-library in Settings → Libraries.
      </p>

      {error && (
        <div className="bg-red-900 mb-4 p-3 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="bg-green-700 mb-4 p-3 border border-green-700 rounded text-green-200 text-sm">
          {saveMessage}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-gray-600 p-4 rounded text-center">
          <p className="text-gray-300">
            No categories found in qBittorrent. Categories will be created automatically when you download releases.
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm text-gray-300 mb-2">qBittorrent Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-600 w-full px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white mb-4"
          >
            <option value="">Select a category...</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category || '(No category)'}
              </option>
            ))}
          </select>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedCategory}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              {isSaving ? 'Saving...' : 'Save Category'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="bg-gray-500 hover:bg-gray-400 px-6 py-2 rounded transition disabled:opacity-50 text-white"
            >
              Reset
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            This only filters what's shown in Activity. Download categories are set per-library in Settings → Libraries.
          </p>
        </div>
      )}
    </div>
  );
}

export default QBittorrentCategorySelector;
