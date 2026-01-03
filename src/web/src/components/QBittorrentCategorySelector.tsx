import { useState, useEffect } from 'react';
import { api } from '../api/client';

function QBittorrentCategorySelector() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
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
        setTimeout(() => setSaveMessage(null), 3000);
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
      <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(31, 41, 55)' }}>
        <h3 className="text-xl font-semibold mb-4 text-white">Activity Page Filter</h3>
        <p className="text-gray-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6" style={{ backgroundColor: 'rgb(31, 41, 55)' }}>
      <h3 className="text-xl font-semibold mb-2 text-white">Activity Page Filter</h3>
      <p className="text-gray-300 mb-4 text-sm">
        Select which qBittorrent category to show in the Activity page. Only torrents in this category will be displayed.
      </p>

      {error && (
        <div className="mb-4 p-3 border border-red-700 rounded text-red-200 text-sm" style={{ backgroundColor: 'rgb(127, 29, 29)' }}>
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="mb-4 p-3 border border-green-700 rounded text-green-200 text-sm" style={{ backgroundColor: 'rgb(21, 128, 61)' }}>
          {saveMessage}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="p-4 rounded text-center" style={{ backgroundColor: 'rgb(55, 65, 81)' }}>
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
            className="w-full px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white mb-4"
            style={{ backgroundColor: 'rgb(55, 65, 81)' }}
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
              className="px-6 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              onMouseEnter={(e) => !isSaving && selectedCategory && (e.currentTarget.style.backgroundColor = 'rgb(29, 78, 216)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37, 99, 235)'}
            >
              {isSaving ? 'Saving...' : 'Save Category'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-6 py-2 rounded transition disabled:opacity-50 text-white"
              style={{ backgroundColor: 'rgb(75, 85, 99)' }}
              onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = 'rgb(107, 114, 128)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(75, 85, 99)'}
            >
              Reset
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Default: "gamearr" - This category is automatically assigned when you download releases through Gamearr.
          </p>
        </div>
      )}
    </div>
  );
}

export default QBittorrentCategorySelector;
