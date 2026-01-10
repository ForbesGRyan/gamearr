import { PopularityType } from './types';

interface TrendingControlsProps {
  popularityTypes: PopularityType[];
  selectedType: number;
  activeFilterCount: number;
  showFilters: boolean;
  onToggleFilters: () => void;
  onSelectedTypeChange: (type: number) => void;
}

export default function TrendingControls({
  popularityTypes,
  selectedType,
  activeFilterCount,
  showFilters,
  onToggleFilters,
  onSelectedTypeChange,
}: TrendingControlsProps) {
  return (
    <div className="flex flex-wrap justify-end items-center gap-2 sm:gap-4 mb-4">
      <button
        onClick={onToggleFilters}
        className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded border transition ${
          activeFilterCount > 0
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>
      <label className="text-sm text-gray-400">Ranked by:</label>
      <select
        value={selectedType}
        onChange={(e) => onSelectedTypeChange(parseInt(e.target.value))}
        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 min-h-[44px] text-white focus:outline-none focus:border-blue-500"
      >
        {popularityTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
    </div>
  );
}
