import { useQuery } from '@tanstack/react-query';
import {
  branchApi,
  inventoryApi,
  productApi,
  supplierApi,
  type StockQuery,
} from '@/api/endpoints';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Branch, product and supplier pickers. `/branches` is already filtered to the
 * caller branch scope by the backend, so the selector can never offer a branch
 * the user may not transact in.
 */
export function useBranches(enabled = true) {
  return useQuery({
    queryKey: ['branches', 'options'],
    queryFn: () => branchApi.list({ limit: 100, isActive: true, sortBy: 'name', sortOrder: 'asc' }),
    select: (result) => result.data,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

/**
 * Destination branches for a stock transfer. The receiving branch does not have to
 * be in the sender's scope - the backend authorises the receipt separately - so
 * this list is the company-wide one, which the API only serves to users who may
 * raise a transfer.
 */
export function useTransferDestinations(enabled = true) {
  return useQuery({
    queryKey: ['branches', 'transfer-destinations'],
    queryFn: () =>
      branchApi.list({
        limit: 100,
        isActive: true,
        sortBy: 'name',
        sortOrder: 'asc',
        scope: 'company',
      }),
    select: (result) => result.data,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

export function useProducts(enabled = true) {
  return useQuery({
    queryKey: ['products', 'options'],
    queryFn: () => productApi.list({ limit: 100, isActive: true, sortBy: 'name', sortOrder: 'asc' }),
    select: (result) => result.data,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

export function useSuppliers(enabled = true) {
  return useQuery({
    queryKey: ['suppliers', 'options'],
    queryFn: () =>
      supplierApi.list({ limit: 100, isActive: true, sortBy: 'name', sortOrder: 'asc' }),
    select: (result) => result.data,
    staleTime: FIVE_MINUTES,
    enabled,
  });
}

/**
 * Live stock for a branch/product, used by the transfer and dispensing forms to
 * offer only batches that actually hold usable stock. The backend still re-checks
 * the balance under lock when the document is written.
 */
export function useStock(query: StockQuery, enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'stock', query],
    queryFn: () => inventoryApi.stock(query),
    enabled,
  });
}
