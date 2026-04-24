import { useMemo } from 'react';
import { useLibraries } from '../queries/libraries';

interface LibrarySelectorProps {
  value: number | null;
  onChange: (libraryId: number | null) => void;
  label?: string;
  optional?: boolean;
}

export default function LibrarySelector({
  value,
  onChange,
  label = 'Library',
  optional = true,
}: LibrarySelectorProps) {
  const { data, isLoading } = useLibraries();
  const libraries = useMemo(
    () => (data ?? []).filter((lib) => lib.downloadEnabled),
    [data]
  );

  if (!isLoading && libraries.length === 0) {
    return null;
  }

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">
        {label}
        {!optional && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? parseInt(val, 10) : null);
        }}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white disabled:opacity-50"
      >
        {optional && <option value="">Default (auto-assign)</option>}
        {!optional && !value && <option value="">Select a library...</option>}
        {libraries.map((lib) => (
          <option key={lib.id} value={lib.id}>
            {lib.name}
            {lib.platform ? ` (${lib.platform})` : ''}
          </option>
        ))}
      </select>
      {optional && (
        <p className="text-xs text-gray-500 mt-1">
          Leave empty to auto-assign based on platform
        </p>
      )}
    </div>
  );
}
