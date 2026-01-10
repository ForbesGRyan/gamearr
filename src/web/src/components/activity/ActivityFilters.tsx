import { StatusFilter } from './types';

interface ActivityFiltersProps {
  searchQuery: string;
  statusFilter: StatusFilter;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
}

function ActivityFilters({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
}: ActivityFiltersProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="flex-1">
        <input
          type="text"
          placeholder="Search downloads..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 md:py-2 text-base md:text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
        className="bg-gray-800 border border-gray-700 rounded px-3 py-3 md:py-2 text-base md:text-sm focus:outline-none focus:border-blue-500"
      >
        <option value="all">All Status</option>
        <option value="downloading">Downloading</option>
        <option value="seeding">Seeding</option>
        <option value="paused">Paused</option>
        <option value="completed">Completed</option>
        <option value="checking">Checking</option>
        <option value="error">Error</option>
      </select>
    </div>
  );
}

export default ActivityFilters;
