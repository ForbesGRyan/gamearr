interface LibraryPaginationProps {
  pageIndex: number; // 0-based
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

export function LibraryPagination({
  pageIndex,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'games',
}: LibraryPaginationProps) {
  const currentPage = pageIndex + 1;
  const totalPages = Math.max(pageCount, 1);
  const startItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalItems);
  const isFirst = pageIndex <= 0;
  const isLast = pageIndex >= pageCount - 1;

  return (
    <div className="mt-6 flex items-center justify-between bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">
          Showing {startItem}-{endItem} of {totalItems} {itemLabel}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="pagination-page-size" className="text-sm text-gray-400">Per page:</label>
          <select
            id="pagination-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(0)}
          disabled={isFirst}
          className="px-3 py-2 min-h-[44px] md:min-h-0 md:py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
        >
          First
        </button>
        <button
          onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
          disabled={isFirst}
          className="px-3 py-2 min-h-[44px] md:min-h-0 md:py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))}
          disabled={isLast}
          className="px-3 py-2 min-h-[44px] md:min-h-0 md:py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(pageCount - 1)}
          disabled={isLast}
          className="px-3 py-2 min-h-[44px] md:min-h-0 md:py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
        >
          Last
        </button>
      </div>
    </div>
  );
}
