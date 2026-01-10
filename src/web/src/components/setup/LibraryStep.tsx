import { useState } from 'react';
import { api } from '../../api/client';
import type { BaseStepProps } from './types';

interface LibraryStepProps extends BaseStepProps {
  libraryName: string;
  setLibraryName: (value: string) => void;
  libraryPath: string;
  setLibraryPath: (value: string) => void;
}

export default function LibraryStep({
  onNext,
  onBack,
  error,
  setError,
  libraryName,
  setLibraryName,
  libraryPath,
  setLibraryPath,
}: LibraryStepProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!libraryPath.trim()) {
      setError('Library path is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createLibrary({
        name: libraryName.trim() || 'Main Library',
        path: libraryPath.trim(),
        monitored: true,
        downloadEnabled: true,
      });

      if (response.success) {
        onNext();
      } else {
        setError(response.error || 'Failed to create library');
      }
    } catch {
      setError('Failed to save library settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-2">Library Location</h2>
      <p className="text-gray-400 mb-6">
        Where should Gamearr store and organize your games?
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Library Name</label>
          <input
            type="text"
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            placeholder="Main Library"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Library Path *</label>
          <input
            type="text"
            value={libraryPath}
            onChange={(e) => setLibraryPath(e.target.value)}
            placeholder="/path/to/games or C:\Games"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            The folder where your games will be organized
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="text-gray-500 hover:text-gray-300 text-sm transition"
        >
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
