import { useState, useEffect, useCallback } from 'react';
import { api, type Library, type CreateLibraryRequest, type UpdateLibraryRequest } from '../../api/client';

interface LibrariesTabProps {
  showSaveMessage: (type: 'success' | 'error', text: string) => void;
}

interface LibraryFormData {
  name: string;
  path: string;
  platform: string;
  monitored: boolean;
  downloadEnabled: boolean;
  downloadCategory: string;
  priority: number;
}

const emptyFormData: LibraryFormData = {
  name: '',
  path: '',
  platform: '',
  monitored: true,
  downloadEnabled: true,
  downloadCategory: 'gamearr',
  priority: 0,
};

export default function LibrariesTab({ showSaveMessage }: LibrariesTabProps) {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // qBittorrent categories
  const [qbCategories, setQbCategories] = useState<string[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<LibraryFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingPath, setIsTestingPath] = useState(false);
  const [pathTestResult, setPathTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLibraries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getLibraries();
      if (response.success && response.data) {
        setLibraries(response.data);
      } else {
        setError(response.error || 'Failed to load libraries');
      }
    } catch {
      setError('Failed to load libraries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibraries();
    // Load qBittorrent categories for the dropdown
    api.getQBittorrentCategories().then((response) => {
      if (response.success && response.data) {
        setQbCategories(response.data as string[]);
      }
    });
  }, [loadLibraries]);

  const handleTestPath = useCallback(async () => {
    if (!formData.path.trim()) {
      setPathTestResult({ valid: false, error: 'Path is required' });
      return;
    }

    setIsTestingPath(true);
    setPathTestResult(null);
    try {
      const response = await api.testLibraryPath(formData.path.trim());
      if (response.success && response.data) {
        setPathTestResult(response.data);
      } else {
        setPathTestResult({ valid: false, error: response.error || 'Test failed' });
      }
    } catch {
      setPathTestResult({ valid: false, error: 'Failed to test path' });
    } finally {
      setIsTestingPath(false);
    }
  }, [formData.path]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.path.trim()) {
      showSaveMessage('error', 'Name and path are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId !== null) {
        // Update existing library
        const updateData: UpdateLibraryRequest = {
          name: formData.name.trim(),
          path: formData.path.trim(),
          platform: formData.platform.trim() || null,
          monitored: formData.monitored,
          downloadEnabled: formData.downloadEnabled,
          downloadCategory: formData.downloadCategory.trim() || null,
          priority: formData.priority,
        };
        const response = await api.updateLibrary(editingId, updateData);
        if (response.success) {
          showSaveMessage('success', 'Library updated!');
          await loadLibraries();
          resetForm();
        } else {
          showSaveMessage('error', response.error || 'Failed to update library');
        }
      } else {
        // Create new library
        const createData: CreateLibraryRequest = {
          name: formData.name.trim(),
          path: formData.path.trim(),
          platform: formData.platform.trim() || undefined,
          monitored: formData.monitored,
          downloadEnabled: formData.downloadEnabled,
          downloadCategory: formData.downloadCategory.trim() || undefined,
          priority: formData.priority,
        };
        const response = await api.createLibrary(createData);
        if (response.success) {
          showSaveMessage('success', 'Library created!');
          await loadLibraries();
          resetForm();
        } else {
          showSaveMessage('error', response.error || 'Failed to create library');
        }
      }
    } catch {
      showSaveMessage('error', 'Failed to save library');
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingId, showSaveMessage, loadLibraries]);

  const handleEdit = useCallback((library: Library) => {
    setFormData({
      name: library.name,
      path: library.path,
      platform: library.platform || '',
      monitored: library.monitored,
      downloadEnabled: library.downloadEnabled,
      downloadCategory: library.downloadCategory || 'gamearr',
      priority: library.priority,
    });
    setEditingId(library.id);
    setShowForm(true);
    setPathTestResult(null);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    setIsDeleting(true);
    try {
      const response = await api.deleteLibrary(id);
      if (response.success) {
        showSaveMessage('success', 'Library deleted!');
        await loadLibraries();
        setDeletingId(null);
      } else {
        showSaveMessage('error', response.error || 'Failed to delete library');
      }
    } catch {
      showSaveMessage('error', 'Failed to delete library');
    } finally {
      setIsDeleting(false);
    }
  }, [showSaveMessage, loadLibraries]);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setEditingId(null);
    setShowForm(false);
    setPathTestResult(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-6">
        <p className="text-red-200">{error}</p>
        <button
          onClick={loadLibraries}
          className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold">Libraries</h3>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Library
            </button>
          )}
        </div>
        <p className="text-gray-400">
          Configure multiple game library folders for different platforms or collections.
          Each library can be independently monitored and used for downloads.
        </p>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">
            {editingId !== null ? 'Edit Library' : 'Add New Library'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., PC Games, PlayStation, Nintendo"
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Platform
                </label>
                <input
                  type="text"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="e.g., PC, PlayStation, Nintendo Switch"
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional tag for filtering games by platform
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Path <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.path}
                  onChange={(e) => {
                    setFormData({ ...formData, path: e.target.value });
                    setPathTestResult(null);
                  }}
                  placeholder="e.g., D:\Games\PC or /mnt/games/pc"
                  className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestPath}
                  disabled={isTestingPath || !formData.path.trim()}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50"
                >
                  {isTestingPath ? 'Testing...' : 'Test Path'}
                </button>
              </div>
              {pathTestResult && (
                <p className={`text-sm mt-2 ${pathTestResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {pathTestResult.valid ? 'Path is valid and accessible!' : pathTestResult.error}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Download Category
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.downloadCategory}
                  onChange={(e) => setFormData({ ...formData, downloadCategory: e.target.value })}
                  className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="gamearr">gamearr (default)</option>
                  {qbCategories.filter(c => c !== 'gamearr').map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.downloadCategory}
                  onChange={(e) => setFormData({ ...formData, downloadCategory: e.target.value })}
                  placeholder="Or type a new category..."
                  className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                qBittorrent category for downloads to this library. Select existing or enter a new one.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher priority libraries are checked first
                </p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.monitored}
                    onChange={(e) => setFormData({ ...formData, monitored: e.target.checked })}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Monitored</span>
                </label>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.downloadEnabled}
                    onChange={(e) => setFormData({ ...formData, downloadEnabled: e.target.checked })}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Enable Downloads</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingId !== null ? 'Update Library' : 'Add Library'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Libraries List */}
      {libraries.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-gray-400 mb-4">No libraries configured yet.</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition"
            >
              Add Your First Library
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {libraries.map((library) => (
            <div
              key={library.id}
              className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-1">{library.name}</h4>
                <p className="text-gray-400 text-sm font-mono mb-2">{library.path}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                  <div>
                    <span className="text-gray-500">Platform: </span>
                    <span className="text-gray-300">{library.platform || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Category: </span>
                    <span className="text-gray-300 font-mono">{library.downloadCategory || 'gamearr'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Priority: </span>
                    <span className="text-gray-300">{library.priority}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status: </span>
                    <span className="text-gray-300">
                      {library.monitored ? 'Monitored' : 'Not monitored'}
                      {library.downloadEnabled ? ', Downloads enabled' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(library)}
                  className="p-2 text-gray-400 hover:text-blue-400 transition"
                  title="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {deletingId === library.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(library.id)}
                      disabled={isDeleting}
                      className="p-2 text-red-400 hover:text-red-300 transition disabled:opacity-50"
                      title="Confirm Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="p-2 text-gray-400 hover:text-gray-300 transition"
                      title="Cancel"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(library.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-800 rounded-lg p-6 border-l-4 border-blue-500">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About Libraries
        </h4>
        <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
          <li><strong>Monitored</strong> libraries are scanned for existing games</li>
          <li><strong>Downloads-enabled</strong> libraries can receive new downloads</li>
          <li><strong>Platform</strong> tags help filter games in the library view</li>
          <li>Higher <strong>priority</strong> libraries are preferred when multiple match</li>
        </ul>
      </div>
    </>
  );
}
