// Compatibility shim that mirrors the react-router-dom v6 hook + component
// surface on top of @tanstack/react-router. Lets us migrate the app to TSR in
// one swoop without touching every call site. Phase 3 will start replacing
// shim usages with typed Route.useSearch / Route.useParams call-site by
// call-site.
import { useCallback, useMemo, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  Link as TSRLink,
  Navigate as TSRNavigate,
  Outlet as TSROutlet,
  useLocation as useTSRLocation,
  useNavigate as useTSRNavigate,
  useParams as useTSRParams,
} from '@tanstack/react-router';

export { TSROutlet as Outlet, TSRNavigate as Navigate };

type AnySearch = Record<string, unknown>;

function searchToQueryString(search: AnySearch | undefined): string {
  if (!search) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const entry of v) params.append(k, String(entry));
    } else {
      params.set(k, String(v));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

function queryStringToSearch(qs: string): Record<string, string> {
  const search: Record<string, string> = {};
  const cleaned = qs.startsWith('?') ? qs.slice(1) : qs;
  if (!cleaned) return search;
  for (const [k, v] of new URLSearchParams(cleaned).entries()) {
    search[k] = v;
  }
  return search;
}

function splitPathQuery(raw: string): {
  pathname: string;
  search: Record<string, string>;
} {
  const hashIndex = raw.indexOf('#');
  const beforeHash = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const [pathname, queryString = ''] = beforeHash.split('?');
  return { pathname, search: queryStringToSearch(queryString) };
}

// --- useLocation shim -----------------------------------------------------
export function useLocation() {
  const loc = useTSRLocation();
  const search = useMemo(
    () => searchToQueryString(loc.search as AnySearch),
    [loc.search]
  );
  return {
    pathname: loc.pathname,
    search,
    hash: loc.hash ?? '',
    state: (loc as { state?: unknown }).state ?? null,
  };
}

// --- useParams shim -------------------------------------------------------
export function useParams<
  T extends Record<string, string> = Record<string, string>,
>(): Partial<T> {
  return useTSRParams({ strict: false }) as unknown as Partial<T>;
}

// --- useNavigate shim -----------------------------------------------------
interface NavigateOpts {
  replace?: boolean;
  viewTransition?: boolean | { types: Array<string> };
  state?: unknown;
}

type NavigateArg =
  | string
  | {
      pathname?: string;
      search?: string | AnySearch;
      hash?: string;
    };

export function useNavigate() {
  const navigate = useTSRNavigate();
  return useCallback(
    (to: NavigateArg, opts?: NavigateOpts) => {
      let pathname: string | undefined;
      let search: AnySearch | undefined;
      let hash: string | undefined;
      if (typeof to === 'string') {
        const hashIndex = to.indexOf('#');
        hash = hashIndex === -1 ? undefined : to.slice(hashIndex + 1);
        const split = splitPathQuery(to);
        pathname = split.pathname;
        search = split.search;
      } else {
        pathname = to.pathname;
        hash = to.hash;
        if (typeof to.search === 'string') {
          search = queryStringToSearch(to.search);
        } else if (to.search) {
          search = to.search;
        }
      }
      navigate({
        to: (pathname ?? '.') as string,
        search: search ?? {},
        hash,
        replace: opts?.replace,
        viewTransition: opts?.viewTransition,
      } as unknown as Parameters<typeof navigate>[0]);
    },
    [navigate]
  );
}

// --- useSearchParams shim -------------------------------------------------
type SearchParamsInit =
  | URLSearchParams
  | Record<string, string | Array<string>>
  | ((prev: URLSearchParams) => URLSearchParams);

export function useSearchParams(): [
  URLSearchParams,
  (init: SearchParamsInit, opts?: { replace?: boolean }) => void,
] {
  const loc = useTSRLocation();
  const navigate = useTSRNavigate();
  const pathname = loc.pathname;

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries((loc.search ?? {}) as AnySearch)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const entry of v) params.append(k, String(entry));
      } else {
        params.set(k, String(v));
      }
    }
    return params;
  }, [loc.search]);

  const setSearchParams = useCallback(
    (init: SearchParamsInit, opts?: { replace?: boolean }) => {
      let next: URLSearchParams;
      if (typeof init === 'function') {
        next = init(new URLSearchParams(searchParams));
      } else if (init instanceof URLSearchParams) {
        next = init;
      } else {
        next = new URLSearchParams();
        for (const [k, v] of Object.entries(init)) {
          if (Array.isArray(v)) v.forEach((entry) => next.append(k, entry));
          else next.set(k, v);
        }
      }
      const searchObj: Record<string, string> = {};
      for (const [k, v] of next.entries()) searchObj[k] = v;
      navigate({
        to: pathname,
        search: searchObj,
        replace: opts?.replace,
      } as unknown as Parameters<typeof navigate>[0]);
    },
    [searchParams, navigate, pathname]
  );

  return [searchParams, setSearchParams];
}

// --- NavLink shim ---------------------------------------------------------
interface NavLinkRenderState {
  isActive: boolean;
  isPending: boolean;
}

interface NavLinkProps {
  to: string;
  end?: boolean;
  viewTransition?: boolean;
  replace?: boolean;
  className?: string | ((state: NavLinkRenderState) => string);
  style?:
    | CSSProperties
    | ((state: NavLinkRenderState) => CSSProperties | undefined);
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children?: ReactNode | ((state: NavLinkRenderState) => ReactNode);
  'aria-current'?: 'page' | 'true' | false;
}

export function NavLink({
  to,
  end,
  viewTransition,
  replace,
  className,
  style,
  onClick,
  children,
}: NavLinkProps) {
  const loc = useTSRLocation();
  const { pathname, search } = useMemo(() => splitPathQuery(to), [to]);

  // Mirrors react-router-dom NavLink defaults: pathname-only active match;
  // `end` requires exact pathname equality.
  const isActive = useMemo(() => {
    if (end) return loc.pathname === pathname;
    if (loc.pathname === pathname) return true;
    if (pathname === '/') return true;
    return loc.pathname.startsWith(`${pathname}/`);
  }, [loc.pathname, pathname, end]);

  const state: NavLinkRenderState = { isActive, isPending: false };
  const resolvedClassName =
    typeof className === 'function' ? className(state) : className;
  const resolvedStyle = typeof style === 'function' ? style(state) : style;
  const resolvedChildren =
    typeof children === 'function' ? children(state) : children;

  return (
    <TSRLink
      to={pathname as string}
      search={search}
      viewTransition={viewTransition}
      replace={replace}
      className={resolvedClassName}
      style={resolvedStyle}
      onClick={onClick}
    >
      {resolvedChildren}
    </TSRLink>
  );
}

// --- Link shim ------------------------------------------------------------
interface LinkShimProps {
  to: string;
  viewTransition?: boolean;
  replace?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children?: ReactNode;
  target?: string;
  rel?: string;
  title?: string;
  'aria-label'?: string;
}

export function Link({
  to,
  viewTransition,
  replace,
  className,
  style,
  onClick,
  children,
  ...rest
}: LinkShimProps) {
  const { pathname, search } = useMemo(() => splitPathQuery(to), [to]);
  return (
    <TSRLink
      to={pathname as string}
      search={search}
      viewTransition={viewTransition}
      replace={replace}
      className={className}
      style={style}
      onClick={onClick}
      {...rest}
    >
      {children}
    </TSRLink>
  );
}
