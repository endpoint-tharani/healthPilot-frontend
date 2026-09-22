import type {
  AccountMapping,
  AccountMappingType,
  AccountingEvent,
  BalanceSheet,
  ChartOfAccounts,
  DocumentAccountingOutcome,
  GeneralLedgerMeta,
  GeneralLedgerRow,
  InitializeAccountingResult,
  JournalDetail,
  JournalStatus,
  JournalSummary,
  LedgerAccount,
  MappingHealth,
  PostPaymentAccountingResult,
  ProfitAndLoss,
  ResolvedAccount,
  SupplierLedger,
  SupplierOutstanding,
  TrialBalance,
} from '@/types/accounting';
import type { Paginated } from '@/types/api';
import { apiGet, apiGetList, apiPost, cleanParams, http } from './client';
import { toApiError } from './errors';
import type { ListQuery } from './endpoints';

export interface JournalListQuery extends ListQuery {
  branchId?: string;
  status?: JournalStatus;
  event?: AccountingEvent;
  sourceDocumentId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface GeneralLedgerQuery extends ListQuery {
  ledgerId: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ReportQuery {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * The general ledger returns its account, opening and closing balances alongside
 * the page meta, so the summary line above the table comes from the same request
 * as the rows rather than a second one that could disagree with them.
 */
async function getGeneralLedgerPage(
  query: GeneralLedgerQuery
): Promise<{ data: GeneralLedgerRow[]; meta: GeneralLedgerMeta }> {
  try {
    const response = await http.get('/accounting/general-ledger', {
      params: cleanParams({ ...query }),
    });
    return {
      data: response.data.data as GeneralLedgerRow[],
      meta: response.data.meta as GeneralLedgerMeta,
    };
  } catch (error) {
    throw toApiError(error);
  }
}

export const accountingApi = {
  /* -------------------------------------------------- chart of accounts ---- */

  chartOfAccounts: () => apiGet<ChartOfAccounts>('/accounting/chart-of-accounts'),

  initialize: (templateKey?: string) =>
    apiPost<InitializeAccountingResult>(
      '/accounting/initialize',
      templateKey ? { templateKey } : {}
    ),

  ledgers: (query: { headCode?: string; natureCode?: string; search?: string } = {}) =>
    apiGet<LedgerAccount[]>('/accounting/ledgers', { params: cleanParams({ ...query }) }),

  /* ---------------------------------------------------------- mappings ---- */

  mappings: () => apiGet<AccountMapping[]>('/accounting/mappings'),

  resolvedMappings: () =>
    apiGet<{ mappingType: AccountMappingType; resolved: ResolvedAccount | null; error: string | null }[]>(
      '/accounting/mappings/resolved'
    ),

  /**
   * Every role a posting needs and whether it resolves, including the ones nobody
   * configured - which `resolvedMappings` cannot report, because a missing role
   * has no row to report on.
   */
  mappingHealth: () => apiGet<MappingHealth>('/accounting/mappings/health'),

  /* ---------------------------------------------------------- journals ---- */

  journals: (query: JournalListQuery = {}): Promise<Paginated<JournalSummary>> =>
    apiGetList<JournalSummary>('/accounting/journals', { params: cleanParams({ ...query }) }),

  journal: (id: string) => apiGet<JournalDetail>(`/accounting/journals/${id}`),

  /** The only write against a posted journal: its mirror image. */
  reverseJournal: (id: string, reason: string) =>
    apiPost<{ journalEntryId: string; journalNumber: string; alreadyPosted: boolean }>(
      `/accounting/journals/${id}/reverse`,
      { reason }
    ),

  journalsForDocument: (documentId: string) =>
    apiGet<JournalSummary[]>(`/accounting/documents/${documentId}/journals`),

  /** Idempotent: posting the same document twice returns the first journal. */
  postDocumentAccounting: (documentId: string) =>
    apiPost<DocumentAccountingOutcome>(`/accounting/documents/${documentId}/post`),

  journalsForPayment: (paymentId: string) =>
    apiGet<JournalSummary[]>(`/accounting/payments/${paymentId}/journals`),

  /** A payment is not a Document, so it posts through its own route. Idempotent. */
  postPaymentAccounting: (paymentId: string) =>
    apiPost<PostPaymentAccountingResult>(`/accounting/payments/${paymentId}/post`),

  /* ------------------------------------------------- supplier subledger ---- */

  supplierLedger: (
    query: {
      supplierId?: string;
      branchId?: string;
      fromDate?: string;
      toDate?: string;
    } = {}
  ) =>
    apiGet<SupplierLedger>('/accounting/supplier-ledger', {
      params: cleanParams({ ...query }),
    }),

  supplierOutstanding: (query: { supplierId?: string; branchId?: string } = {}) =>
    apiGet<SupplierOutstanding>('/accounting/supplier-outstanding', {
      params: cleanParams({ ...query }),
    }),

  /* ------------------------------------------------- ledger and reports ---- */

  generalLedger: getGeneralLedgerPage,

  trialBalance: (query: ReportQuery = {}) =>
    apiGet<TrialBalance>('/accounting/reports/trial-balance', {
      params: cleanParams({ ...query }),
    }),

  profitLoss: (query: ReportQuery = {}) =>
    apiGet<ProfitAndLoss>('/accounting/reports/profit-loss', {
      params: cleanParams({ ...query }),
    }),

  balanceSheet: (query: ReportQuery = {}) =>
    apiGet<BalanceSheet>('/accounting/reports/balance-sheet', {
      params: cleanParams({ ...query }),
    }),
};
