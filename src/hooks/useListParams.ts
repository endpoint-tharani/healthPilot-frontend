import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Query state for a list page. Pagination is numeric; every filter is a string so
 * it can go straight onto the query string, and the index signature lets pages add
 * their own filter keys (productId, transactionType, role, …).
 */
export interface ListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  branchId?: string;
  supplierId?: string;
  productId?: string;
  batchId?: string;
  stockStatus?: string;
  transactionType?: string;
  documentType?: string;
  method?: string;
  role?: string;
  type?: string;
  isActive?: string;
  fromDate?: string;
  toDate?: string;
  [key: string]: string | number | undefined;
}

export interface ListParamsApi {
  params: ListParams;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  /** Any filter change resets pagination, so page 3 of the old filter never sticks. */
  setFilter: (key: string, value: string | undefined) => void;
  reset: () => void;
  activeFilterCount: number;
}

const RESERVED = new Set(['page', 'limit']);

/**
 * Filters can also arrive in the URL - the global search box, a notification that
 * opens "requirements awaiting approval", a link shared with a colleague. Those
 * are seeded into the filter state and re-applied whenever the query string
 * changes, so navigating to the page you are already on still re-filters it.
 */
export function useListParams(initial: Partial<ListParams> = {}): ListParamsApi {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  // The initial object is a literal at every call site; it is captured once on purpose.
  const initialRef = useRef(initial);

  const seeded = useMemo(() => {
    const base: ListParams = { page: 1, limit: 20, ...initialRef.current };
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      if (!RESERVED.has(key) && value) {
        base[key] = value;
      }
    });
    return base;
  }, [queryString]);

  const [params, setParams] = useState<ListParams>(seeded);

  useEffect(() => {
    setParams(seeded);
  }, [seeded]);

  const setPage = useCallback((page: number) => {
    setParams((current) => ({ ...current, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setParams((current) => ({ ...current, limit, page: 1 }));
  }, []);

  const setFilter = useCallback((key: string, value: string | undefined) => {
    setParams((current) => {
      if ((current[key] ?? undefined) === (value === '' ? undefined : value)) {
        return current;
      }
      const next: ListParams = { ...current, page: 1 };
      if (value === undefined || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  const reset = useCallback(
    () => setParams({ page: 1, limit: 20, ...initialRef.current }),
    []
  );

  const activeFilterCount = useMemo(
    () =>
      Object.entries(params).filter(
        ([key, value]) => !RESERVED.has(key) && value !== undefined && value !== ''
      ).length,
    [params]
  );

  return { params, setPage, setLimit, setFilter, reset, activeFilterCount };
}
