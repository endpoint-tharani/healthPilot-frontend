import { useQueries } from '@tanstack/react-query';
import { documentApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import type { DocumentStatus, DocumentType, Permission } from '@/types/api';

/**
 * What is actually waiting on this user, counted from the document register.
 *
 * Each entry pairs a document type and the statuses that a given permission lets
 * the holder act on, so a pharmacist and a finance user see different queues.
 * The count is `meta.total` from a real `GET /api/documents` call with `limit: 1`
 * - no figure here is estimated, and the row only appears when the user holds
 * the permission that makes it actionable.
 */
export interface ActionQueueItem {
  key: string;
  /** What the user is being asked to do. */
  label: string;
  /** Why it is in the queue. */
  caption: string;
  to: string;
  documentType: DocumentType;
  statuses: DocumentStatus[];
  permission: Permission;
  tone: 'warning' | 'danger' | 'info';
}

export const ACTION_QUEUE: ActionQueueItem[] = [
  {
    key: 'approve-requirements',
    label: 'Requirements to approve',
    caption: 'Submitted and waiting for a decision',
    to: '/requirements?status=SUBMITTED',
    documentType: 'STOCK_REQUIREMENT',
    statuses: ['SUBMITTED'],
    permission: 'STOCK_REQUIREMENT_APPROVE',
    tone: 'warning',
  },
  {
    key: 'approve-orders',
    label: 'Purchase orders to approve',
    caption: 'Raised but not yet approved',
    to: '/purchase-orders?status=DRAFT',
    documentType: 'PURCHASE_ORDER',
    statuses: ['DRAFT', 'SUBMITTED'],
    permission: 'PURCHASE_ORDER_APPROVE',
    tone: 'warning',
  },
  {
    key: 'post-receipts',
    label: 'Goods receipts to post',
    caption: 'Drafted — no stock has moved yet',
    to: '/goods-receipts?status=DRAFT',
    documentType: 'GOODS_RECEIPT',
    statuses: ['DRAFT'],
    permission: 'GOODS_RECEIPT_POST',
    tone: 'warning',
  },
  {
    key: 'invoice-disputes',
    label: 'Invoices in dispute',
    caption: 'Carrying value the receipts did not accept',
    to: '/supplier-invoices?status=DISCREPANT',
    documentType: 'SUPPLIER_INVOICE',
    statuses: ['DISCREPANT'],
    permission: 'SUPPLIER_INVOICE_VIEW',
    tone: 'danger',
  },
  {
    key: 'receive-transfers',
    label: 'Transfers to receive',
    caption: 'Dispatched and in transit to a branch',
    to: '/stock-transfers?status=DISPATCHED',
    documentType: 'STOCK_TRANSFER',
    statuses: ['DISPATCHED'],
    permission: 'STOCK_TRANSFER_RECEIVE',
    tone: 'info',
  },
];

export interface ActionQueueResult {
  items: (ActionQueueItem & { count: number })[];
  /** Total across the queue, for the notification badge. */
  total: number;
  isLoading: boolean;
}

export function useActionQueue(): ActionQueueResult {
  const { can } = useAuth();
  const visible = ACTION_QUEUE.filter((item) => can(item.permission));

  const queries = useQueries({
    queries: visible.map((item) => ({
      queryKey: ['action-queue', item.key],
      queryFn: async () => {
        const result = await documentApi.list({
          documentType: item.documentType,
          status: item.statuses.join(','),
          limit: 1,
        });
        return result.meta.total;
      },
      staleTime: 60_000,
    })),
  });

  const items = visible
    .map((item, index) => ({ ...item, count: queries[index]?.data ?? 0 }))
    .filter((item) => item.count > 0);

  return {
    items,
    total: items.reduce((sum, item) => sum + item.count, 0),
    isLoading: queries.some((query) => query.isLoading),
  };
}
