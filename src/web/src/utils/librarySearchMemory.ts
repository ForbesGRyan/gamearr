const KEY = 'library-last-search';

export type LibrarySearch = Record<string, unknown>;

export function saveLibrarySearch(search: LibrarySearch): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(search));
  } catch {
    // ignore
  }
}

export function loadLibrarySearch(): LibrarySearch {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LibrarySearch) : {};
  } catch {
    return {};
  }
}
