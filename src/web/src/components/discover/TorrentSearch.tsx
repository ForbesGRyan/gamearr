interface TorrentSearchProps {
  searchInput: string;
  currentSearch: string;
  maxAge: number;
  isLoading: boolean;
  onSearchInputChange: (value: string) => void;
  onMaxAgeChange: (age: number) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function TorrentSearch({
  searchInput,
  currentSearch,
  maxAge,
  isLoading,
  onSearchInputChange,
  onMaxAgeChange,
  onSubmit,
}: TorrentSearchProps) {
  return (
    <form onSubmit={onSubmit} className="mb-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder="Search torrents (e.g., 'elden ring', 'cyberpunk')"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={maxAge}
          onChange={(e) => onMaxAgeChange(parseInt(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
          <option value={7}>Last Week</option>
          <option value={30}>Last Month</option>
          <option value={90}>Last 3 Months</option>
          <option value={365}>Last Year</option>
          <option value={3650}>All Time</option>
        </select>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded text-white"
        >
          Search
        </button>
      </div>
      {currentSearch && (
        <p className="text-sm text-gray-400 mt-2">
          Showing results for: <span className="text-blue-400">{currentSearch}</span>
        </p>
      )}
    </form>
  );
}
