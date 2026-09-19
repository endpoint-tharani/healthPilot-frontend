import { useQuery } from '@tanstack/react-query';
import { requirementApi } from '@/api/endpoints';
import { dec, type Decimal } from '@/utils/decimal';
import { useDocumentChain, type DocumentChain } from '@/hooks/useDocumentChain';
import type { DocumentDetail, RequirementAvailability } from '@/types/api';

interface FulfilmentResult {
  /** Usable quantity accepted so far, keyed by product id. */
  fulfilledByProduct: Map<string, Decimal>;
  isLoading: boolean;
  /** True when part of the chain sits outside the caller branch scope. */
  partial: boolean;
}

export interface RequirementLineProgress {
  requested: Decimal;
  fulfilled: Decimal;
  remaining: Decimal;
  /** 0-100, clamped, for the progress bar. */
  percent: number;
}

/**
 * Usable stock the requirement actually received, keyed by product, from both
 * routes it may be met by.
 *
 * Receipts add and corrections subtract because the ledger stores both as signed
 * USABLE rows, so the two net without the UI deciding anything.
 *
 * A transfer is counted only through its TRANSFER_IN rows, which receipt posts at
 * the destination. That single filter does two jobs: a dispatched-but-unreceived
 * transfer contributes nothing, matching the backend rule, and the outbound leg
 * cannot cancel the inbound one - both sit on the same document, so summing every
 * USABLE row on it would always come to zero.
 *
 * These are the same rows the backend reads when it sets the requirement status,
 * so the figures can only ever agree with it - and the backend status is still
 * the one displayed.
 */
export function fulfilledUsableByProduct(documents: DocumentDetail[]): Map<string, Decimal> {
  const fulfilled = new Map<string, Decimal>();
  for (const document of documents) {
    const isReceiptChain =
      document.documentType === 'GOODS_RECEIPT' || document.documentType === 'RECEIPT_CORRECTION';
    const isTransfer = document.documentType === 'STOCK_TRANSFER';
    if (!isReceiptChain && !isTransfer) {
      continue;
    }
    for (const movement of document.inventoryTransactions) {
      if (movement.stockStatus !== 'USABLE' || !movement.product) {
        continue;
      }
      if (isTransfer && movement.transactionType !== 'TRANSFER_IN') {
        continue;
      }
      const current = fulfilled.get(movement.product.id) ?? dec(0);
      fulfilled.set(movement.product.id, current.plus(dec(movement.quantity)));
    }
  }
  return fulfilled;
}

/** The fulfilment slice of the chain, for callers that need only this part. */
export function useRequirementFulfilment(requirement: DocumentDetail | undefined): FulfilmentResult {
  const chain = useDocumentChain(requirement);
  return {
    fulfilledByProduct: fulfilledUsableByProduct(chain.documents),
    isLoading: chain.isLoading,
    partial: chain.partial,
  };
}

/** Per-product fulfilment exactly as the backend computed it. */
export function backendFulfilledByProduct(
  availability: RequirementAvailability | undefined
): Map<string, Decimal> | null {
  if (!availability) {
    return null;
  }
  return new Map(availability.lines.map((line) => [line.product.id, dec(line.fulfilled)]));
}

/**
 * The authoritative fulfilment figures for a requirement.
 *
 * There is one fulfilment engine, and it is the backend's: the same
 * `getFulfilledByProduct` that decides whether the requirement is
 * PARTIALLY_FULFILLED or FULFILLED is what this reads, so the progress bar can
 * never disagree with the status chip printed beside it.
 *
 * The chain-derived figure is kept only as a fallback for the moment before that
 * request lands, and for a caller whose chain is readable while the requirement
 * endpoint is not. It sums the same ledger rows over the same documents, so the
 * two agree; it is a slower way to the same answer, not a second opinion.
 */
export function useAuthoritativeFulfilment(
  requirement: DocumentDetail | undefined
): FulfilmentResult & { availability: RequirementAvailability | undefined } {
  const chain = useDocumentChain(requirement);

  const availability = useQuery({
    queryKey: ['stock-requirements', requirement?.id, 'internal-availability'],
    queryFn: () => requirementApi.internalAvailability(requirement!.id),
    enabled: Boolean(requirement?.id),
    staleTime: 0,
  });

  const fromBackend = backendFulfilledByProduct(availability.data);

  return {
    fulfilledByProduct: fromBackend ?? fulfilledUsableByProduct(chain.documents),
    isLoading: chain.isLoading || availability.isLoading,
    // Only the chain can be partial; the backend figure already counts everything
    // the requirement has, whether or not this user may open each document.
    partial: fromBackend ? false : chain.partial,
    availability: availability.data,
  };
}

/** The same figures, taken from a chain the caller already walked. */
export function fulfilmentFromChain(chain: DocumentChain): Map<string, Decimal> {
  return fulfilledUsableByProduct(chain.documents);
}

/** Per-line requested / fulfilled / remaining, from backend quantities only. */
export function lineProgress(
  line: { product: { id: string }; quantity: string },
  fulfilledByProduct: Map<string, Decimal>
): RequirementLineProgress {
  const requested = dec(line.quantity);
  const fulfilledRaw = fulfilledByProduct.get(line.product.id) ?? dec(0);
  const fulfilled = fulfilledRaw.greaterThan(0) ? fulfilledRaw : dec(0);
  const remainingRaw = requested.minus(fulfilled);
  const remaining = remainingRaw.greaterThan(0) ? remainingRaw : dec(0);
  const percent = requested.greaterThan(0)
    ? Math.min(100, Math.max(0, Number(fulfilled.dividedBy(requested).times(100).toFixed(2))))
    : 0;

  return { requested, fulfilled, remaining, percent };
}
