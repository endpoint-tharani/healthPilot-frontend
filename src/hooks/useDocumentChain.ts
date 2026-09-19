import { useQueries } from '@tanstack/react-query';
import { documentApi } from '@/api/endpoints';
import { sumDecimals } from '@/utils/decimal';
import type { ActivityEntry } from '@/components/ActivityTimeline';
import type { FlowNode } from '@/components/DocumentFlow';
import type { MovementRow } from '@/components/InventoryMovementsTable';
import { DOCUMENT_TYPE_LABELS, documentPath } from '@/utils/format';
import type {
  DocumentDetail,
  DocumentPaymentAllocation,
  DocumentRef,
  DocumentType,
} from '@/types/api';

/**
 * Walks the real DocumentLink graph outwards from whatever document is open, so
 * every module shows the same chain rather than each one knowing a different
 * part of it:
 *
 *   requirement --FULFILLS--          purchase order
 *               --RECEIVED_AGAINST--  goods receipt --CORRECTS--    correction
 *               --INVOICED_AGAINST--  supplier invoice --CREDIT_FOR-- credit note
 *                                     invoice.paymentAllocations -> payment
 *               --TRANSFER_FOR--      stock transfer (the internal route)
 *
 * Links are followed in both directions, because `outgoing` and `incoming` are
 * the two ends of the same recorded relationship. Four rounds reach every step
 * from any starting point (a credit note is four hops from a correction), and
 * each document is fetched once under the shared ['documents', id] key, so two
 * panels reading the same record cost one request.
 *
 * Nothing here infers a relationship: a step appears only when the backend
 * actually linked a document to it.
 */

/** How many documents one chain may pull in, as a guard against a wide fan-out. */
const MAX_DOCUMENTS = 40;

function linkedIds(detail: DocumentDetail | undefined): string[] {
  if (!detail) {
    return [];
  }
  return [...detail.links.outgoing, ...detail.links.incoming].map((link) => link.document.id);
}

export function toDocumentRef(detail: DocumentDetail): DocumentRef {
  return {
    id: detail.id,
    documentNumber: detail.documentNumber,
    documentType: detail.documentType,
    status: detail.status,
  };
}

export interface ChainPayment {
  /** The document the allocation was actually recorded against. */
  document: DocumentRef;
  allocation: DocumentPaymentAllocation;
}

export interface ChainFinancials {
  ordered: string;
  invoiced: string;
  credited: string;
  paid: string;
  outstanding: string;
  disputed: string;
}

export interface DocumentChain {
  /** Every document reached, including the one that is open. */
  documents: DocumentDetail[];
  byType: (type: DocumentType) => DocumentDetail[];
  movements: MovementRow[];
  activity: ActivityEntry[];
  payments: ChainPayment[];
  financials: ChainFinancials;
  flowNodes: FlowNode[];
  isLoading: boolean;
  /** True when part of the chain sits outside the caller branch scope. */
  partial: boolean;
}

/** One round of "fetch these ids", skipping anything already in the chain. */
function useRound(ids: string[], seen: Set<string>) {
  const next = Array.from(new Set(ids)).filter((id) => !seen.has(id));
  const capped = next.slice(0, Math.max(0, MAX_DOCUMENTS - seen.size));
  capped.forEach((id) => seen.add(id));

  const results = useQueries({
    queries: capped.map((id) => ({
      queryKey: ['documents', id],
      queryFn: () => documentApi.get(id),
      retry: false,
    })),
  });

  return {
    documents: results.flatMap((result) => (result.data ? [result.data] : [])),
    isLoading: results.some((result) => result.isLoading),
    failed: results.some((result) => result.isError),
  };
}

/** The steps of the procurement chain, in the order the business runs them. */
const PROCUREMENT_STEPS: DocumentType[] = [
  'STOCK_REQUIREMENT',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'RECEIPT_CORRECTION',
  'SUPPLIER_INVOICE',
  'CREDIT_NOTE',
];

export function useDocumentChain(root: DocumentDetail | undefined): DocumentChain {
  const seen = new Set<string>(root ? [root.id] : []);

  const round1 = useRound(linkedIds(root), seen);
  const round2 = useRound(round1.documents.flatMap(linkedIds), seen);
  const round3 = useRound(round2.documents.flatMap(linkedIds), seen);
  const round4 = useRound(round3.documents.flatMap(linkedIds), seen);

  const rounds = [round1, round2, round3, round4];
  const reached = rounds.flatMap((round) => round.documents);

  return {
    ...buildChain(root, reached),
    isLoading: rounds.some((round) => round.isLoading),
    partial: rounds.some((round) => round.failed),
  };
}

/**
 * Everything the chain view derives from a set of documents, with no fetching of
 * its own. Kept separate from the hook so the same derivation can be exercised
 * against real API payloads outside React.
 */
export function buildChain(
  root: DocumentDetail | undefined,
  reached: DocumentDetail[]
): Omit<DocumentChain, 'isLoading' | 'partial'> {
  const documents = root ? [root, ...reached] : [];

  const byType = (type: DocumentType) =>
    documents.filter((document) => document.documentType === type);

  // Ledger rows from every document in the chain, tagged with what posted them.
  const movements: MovementRow[] = documents
    .flatMap((document) =>
      document.inventoryTransactions.map((movement) => ({
        ...movement,
        sourceDocument: toDocumentRef(document),
      }))
    )
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));

  const activity: ActivityEntry[] = documents
    .flatMap((document) =>
      (document.history ?? []).map((entry) => ({ ...entry, document: toDocumentRef(document) }))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const payments: ChainPayment[] = documents.flatMap((document) =>
    document.paymentAllocations.map((allocation) => ({
      document: toDocumentRef(document),
      allocation,
    }))
  );

  const purchaseOrders = byType('PURCHASE_ORDER');
  const invoices = byType('SUPPLIER_INVOICE');
  const creditNotes = byType('CREDIT_NOTE');

  // Aggregation only: each figure is a value the backend stored on a document.
  const financials: ChainFinancials = {
    ordered: sumDecimals(purchaseOrders.map((order) => order.totalAmount)).toFixed(2),
    invoiced: sumDecimals(invoices.map((invoice) => invoice.totalAmount)).toFixed(2),
    credited: sumDecimals(creditNotes.map((note) => note.totalAmount)).toFixed(2),
    paid: sumDecimals(invoices.map((invoice) => invoice.paidAmount)).toFixed(2),
    outstanding: sumDecimals(invoices.map((invoice) => invoice.balanceAmount)).toFixed(2),
    disputed: sumDecimals(invoices.map((invoice) => invoice.disputedAmount)).toFixed(2),
  };

  return {
    documents,
    byType,
    movements,
    activity,
    payments,
    financials,
    flowNodes: buildFlowNodes(root, byType, payments),
  };
}

/** One procurement step, using the first document of that kind in the chain. */
function procurementStep(
  type: DocumentType,
  documents: DocumentDetail[],
  currentId: string | undefined
): FlowNode {
  const first = documents[0];
  if (!first) {
    return { label: DOCUMENT_TYPE_LABELS[type] };
  }
  return {
    label: DOCUMENT_TYPE_LABELS[type],
    number: first.documentNumber,
    status: first.status,
    to: documentPath(first.documentType, first.id),
    current: first.id === currentId,
    extra: documents.length > 1 ? `+${documents.length - 1} more` : undefined,
  };
}

/**
 * The chain as cards. Transfers and dispensing do not run the procurement chain,
 * so they get the steps their own workflow actually has - the transfer's second
 * leg is a status on the transfer itself, and a dispensing's stock issue is an
 * inventory movement, not a document.
 */
function buildFlowNodes(
  root: DocumentDetail | undefined,
  byType: (type: DocumentType) => DocumentDetail[],
  payments: ChainPayment[]
): FlowNode[] {
  if (!root) {
    return [];
  }

  if (root.documentType === 'STOCK_TRANSFER') {
    const dispatched = root.inventoryTransactions.some(
      (movement) => movement.transactionType === 'TRANSFER_OUT'
    );
    const received = root.inventoryTransactions.some(
      (movement) => movement.transactionType === 'TRANSFER_IN'
    );
    return [
      procurementStep('STOCK_REQUIREMENT', byType('STOCK_REQUIREMENT'), root.id),
      {
        label: 'Stock Transfer',
        number: root.documentNumber,
        status: root.status,
        current: true,
      },
      {
        label: 'Dispatch',
        done: dispatched,
        caption: dispatched
          ? `Issued from ${root.sourceBranch?.name ?? 'source branch'}`
          : undefined,
        hint: 'Not dispatched yet',
      },
      {
        label: 'Branch receipt',
        done: received,
        caption: received
          ? `Received at ${root.destinationBranch?.name ?? 'destination branch'}`
          : undefined,
        hint: 'Not received yet',
      },
    ];
  }

  if (root.documentType === 'DISPENSING') {
    const issued = root.inventoryTransactions.filter(
      (movement) => movement.transactionType === 'DISPENSING'
    );
    const payment = payments[0]?.allocation.payment;
    return [
      {
        label: 'Dispensing',
        number: root.documentNumber,
        status: root.status,
        current: true,
      },
      {
        label: 'Inventory issued',
        done: issued.length > 0,
        caption:
          issued.length > 0
            ? `${issued.length} usable stock movement${issued.length > 1 ? 's' : ''}`
            : undefined,
        hint: 'No stock issued yet',
      },
      payment
        ? {
            label: 'Payment',
            number: payment.paymentNumber,
            to: `/payments/${payment.id}`,
          }
        : { label: 'Payment' },
    ];
  }

  const payment = payments[0]?.allocation.payment;

  // A requirement met from another branch has a second, shorter route beside the
  // procurement one. It is shown only when a transfer was actually linked, so a
  // purely procured requirement looks exactly as it did before.
  const transfers = byType('STOCK_TRANSFER');
  const transferStep: FlowNode[] =
    root.documentType === 'STOCK_REQUIREMENT' && transfers.length > 0
      ? [
          {
            label: 'Internal transfer',
            number: transfers[0].documentNumber,
            status: transfers[0].status,
            to: documentPath('STOCK_TRANSFER', transfers[0].id),
            extra: transfers.length > 1 ? `+${transfers.length - 1} more` : undefined,
            caption: transfers[0].sourceBranch?.name
              ? `From ${transfers[0].sourceBranch.name}`
              : undefined,
          },
        ]
      : [];

  return [
    ...PROCUREMENT_STEPS.map((type) => procurementStep(type, byType(type), root.id)),
    ...transferStep,
    // Payments are not Documents, so the last step carries its own route rather
    // than being forced into a DocumentRef.
    payment
      ? {
          label: 'Payment',
          number: payment.paymentNumber,
          to: `/payments/${payment.id}`,
          extra: payments.length > 1 ? `+${payments.length - 1} more` : undefined,
        }
      : { label: 'Payment' },
  ];
}
