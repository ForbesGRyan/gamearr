import { Release } from '../../api/client';
import { formatBytes, formatDate } from '../../utils/formatters';

export type SortField = 'title' | 'indexer' | 'size' | 'seeders' | 'publishedAt' | 'category';
export type SortDirection = 'asc' | 'desc';

// Common Prowlarr category mappings
const CATEGORY_NAMES: Record<number, string> = {
  4000: 'PC',
  4010: 'PC/0day',
  4020: 'PC/ISO',
  4030: 'PC/Mac',
  4040: 'PC/iOS',
  4050: 'PC/Android',
  4060: 'PC/Games',
  1000: 'Console',
  1010: 'Console/NDS',
  1020: 'Console/PSP',
  1030: 'Console/Wii',
  1040: 'Console/Xbox',
  1050: 'Console/Xbox 360',
  1060: 'Console/Wiiware',
  1070: 'Console/Xbox One',
  1080: 'Console/PS3',
  1090: 'Console/PS4',
  1100: 'Console/PSVita',
  1110: 'Console/Switch',
  1120: 'Console/PS5',
  1130: 'Console/Xbox X',
};

function getCategoryName(categories?: number[]): string {
  if (!categories || categories.length === 0) return '-';
  // Return the first recognized category name, or the category ID
  for (const cat of categories) {
    if (CATEGORY_NAMES[cat]) {
      return CATEGORY_NAMES[cat];
    }
  }
  // If no recognized category, return the first one as a number
  return `Cat: ${categories[0]}`;
}

interface ReleasesTableProps {
  releases: Release[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onGrab: (release: Release) => void;
}

function ReleasesTable({
  releases,
  sortField,
  sortDirection,
  onSort,
  onGrab,
}: ReleasesTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-600">&#x21C5;</span>;
    }
    return sortDirection === 'asc' ? <span>&uarr;</span> : <span>&darr;</span>;
  };

  const getSortedReleases = () => {
    const sorted = [...releases].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'category') {
        // Sort by first category number
        aValue = a.categories?.[0] ?? 99999;
        bValue = b.categories?.[0] ?? 99999;
      } else if (sortField === 'publishedAt') {
        aValue = new Date(a[sortField]).getTime();
        bValue = new Date(b[sortField]).getTime();
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const sortedReleases = getSortedReleases();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">
          {releases.length} release{releases.length !== 1 ? 's' : ''} found
        </h3>
        <div className="text-sm text-gray-400">Click column headers to sort</div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th
                  onClick={() => onSort('title')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-2">
                    Title {getSortIcon('title')}
                  </div>
                </th>
                <th
                  onClick={() => onSort('indexer')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-2">
                    Indexer {getSortIcon('indexer')}
                  </div>
                </th>
                <th
                  onClick={() => onSort('category')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-2">
                    Category {getSortIcon('category')}
                  </div>
                </th>
                <th
                  onClick={() => onSort('size')}
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-2">
                    Size {getSortIcon('size')}
                  </div>
                </th>
                <th
                  onClick={() => onSort('seeders')}
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-2">
                    Seeders {getSortIcon('seeders')}
                  </div>
                </th>
                <th
                  onClick={() => onSort('publishedAt')}
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-2">
                    Date {getSortIcon('publishedAt')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedReleases.map((release) => (
                <tr key={release.guid} className="hover:bg-gray-750 transition">
                  <td className="px-4 py-3">
                    <div
                      className="text-sm font-medium text-white truncate max-w-md"
                      title={release.title}
                    >
                      {release.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">{release.indexer}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold bg-blue-900 text-blue-200 rounded">
                      {getCategoryName(release.categories)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-300">{formatBytes(release.size)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-medium ${
                        release.seeders >= 20
                          ? 'text-green-400'
                          : release.seeders >= 5
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {release.seeders}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-400">
                      {formatDate(release.publishedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onGrab(release)}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition text-sm text-white"
                    >
                      Grab
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReleasesTable;
