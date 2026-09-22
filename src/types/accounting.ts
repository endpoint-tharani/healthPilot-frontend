import type { DocumentType, PageMeta } from './api';

/**
 * The accounting API contract. Every money figure arrives as a fixed-point
 * string, exactly as the rest of the ERP does, and is never converted to a JS
 * number before it is displayed.
 */

export type BalanceType = 'DR' | 'CR';

export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type AccountingEvent =
  | 'SUPPLIER_INVOICE'
  | 'SUPPLIER_PAYMENT'
  | 'CREDIT_NOTE'
  | 'SALES'
  | 'COGS'
  | 'MANUAL'
  | 'REVERSAL';

export type AccountMappingType =
  | 'CUSTOMER'
  | 'VENDOR'
  | 'SALES'
  | 'PURCHASE'
  | 'CASH'
  | 'BANK'
  | 'TAX'
  | 'ROUNDING'
  | 'DISCOUNT'
  | 'DIRECT_COST'
  | 'INDIRECT_COST'
  | 'INVENTORY'
  | 'OTHER'
  | 'INPUT_TAX'
  | 'OUTPUT_TAX';

export type ChartLevel =
  | 'NATURE'
  | 'NATURE_TYPE'
  | 'HEAD'
  | 'GROUP'
  | 'SUB_GROUP'
  | 'LEDGER';

export interface ChartNode {
  id: string;
  code: string;
  name: string;
  level: ChartLevel;
  parentCode: string | null;
  isLocked: boolean;
  isActive: boolean;
  children: ChartNode[];
  openingBalanceType?: BalanceType;
  isDefault?: boolean;
}

export interface ChartCounts {
  natures: number;
  natureTypes: number;
  heads: number;
  groups: number;
  subGroups: number;
  ledgers: number;
  mappings: number;
}

export interface ChartOfAccounts {
  templateKey: string | null;
  templateVersion: string | null;
  initializedAt: string | null;
  counts: ChartCounts;
  tree: ChartNode[];
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  openingBalanceType: BalanceType;
  isDefault: boolean;
  isLocked: boolean;
  isActive: boolean;
  head: { code: string; name: string };
  natureType: { code: string; name: string };
  nature: { code: string; name: string };
  group: { code: string; name: string } | null;
  subGroup: { code: string; name: string } | null;
}

export interface AccountMapping {
  id: string;
  mappingType: AccountMappingType;
  target: 'HEAD' | 'LEDGER';
  scope: 'COMPANY' | 'BRANCH';
  branch: { id: string; code: string; name: string } | null;
  head: { code: string; name: string } | null;
  ledger: { code: string; name: string } | null;
}

/**
 * Where a business document or payment stands with the books.
 *
 * POSTED has a journal behind it. SKIPPED and NOT_REQUIRED are answers rather
 * than gaps - a stock transfer raises no entry by design, and a credit note that
 * cleared value the invoice journal never booked has nothing to reverse. PENDING
 * and FAILED are the only two that need anybody to do something, and both are
 * retryable.
 */
export type AccountingStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'POSTED'
  | 'SKIPPED'
  | 'FAILED';

export interface DocumentAccountingState {
  status: AccountingStatus;
  message: string | null;
  postedAt: string | null;
}

export interface ResolvedAccount {
  ledgerId: string;
  ledgerCode: string;
  ledgerName: string;
  headCode: string;
  headName: string;
  natureCode: string;
  resolvedFrom: 'BRANCH' | 'COMPANY';
  via: 'HEAD' | 'LEDGER';
}

export interface JournalSummary {
  id: string;
  journalNumber: string;
  documentDate: string;
  event: AccountingEvent;
  status: JournalStatus;
  description: string;
  branch: { id: string; code: string; name: string } | null;
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  sourceDocument: { id: string; documentNumber: string; documentType: DocumentType } | null;
  sourcePayment: { id: string; paymentNumber: string } | null;
  sourceDocumentType: string | null;
  sourceReference: string | null;
  postedAt: string | null;
  createdAt: string;
}

export interface JournalLine {
  id: string;
  lineNumber: number;
  ledger: {
    id: string;
    code: string;
    name: string;
    head: { code: string; name: string };
  };
  branch: { id: string; code: string; name: string } | null;
  /** The subledger a payable line belongs to; null on every other line. */
  supplier: { id: string; code: string; name: string } | null;
  debit: string;
  credit: string;
  description: string | null;
  reference: string | null;
}

export interface JournalDetail extends JournalSummary {
  createdBy: { id: string; name: string; email: string } | null;
  postedBy: { id: string; name: string; email: string } | null;
  reversalOf: { id: string; journalNumber: string } | null;
  reversedBy: { id: string; journalNumber: string } | null;
  sourceEventKey: string;
  lines: JournalLine[];
}

export interface GeneralLedgerRow {
  journalLineId: string;
  date: string;
  journalEntryId: string;
  journalNumber: string;
  event: AccountingEvent;
  sourceDocumentId: string | null;
  sourceDocument: string | null;
  sourceDocumentType: string | null;
  branch: { id: string; code: string; name: string } | null;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface GeneralLedgerMeta extends PageMeta {
  ledger: {
    id: string;
    code: string;
    name: string;
    openingBalanceType: BalanceType;
    head: { code: string; name: string };
    nature: { code: string; name: string };
  };
  openingBalance: string;
  closingBalance: string;
  periodDebit: string;
  periodCredit: string;
}

export interface ReportScope {
  branchId: string | null;
  fromDate: string | null;
  toDate: string | null;
}

export interface TrialBalanceRow {
  ledgerId: string;
  code: string;
  name: string;
  natureCode: string;
  natureName: string;
  headCode: string;
  headName: string;
  debit: string;
  credit: string;
}

export interface TrialBalance {
  scope: ReportScope;
  rows: TrialBalanceRow[];
  totals: { totalDebit: string; totalCredit: string; difference: string };
  isBalanced: boolean;
  /** Set only when the two columns disagree, which they never should. */
  integrityError: string | null;
}

export interface ReportLedgerRow {
  ledgerId: string;
  code: string;
  name: string;
  amount: string;
}

export interface ReportHead {
  code: string;
  name: string;
  amount: string;
  ledgers: ReportLedgerRow[];
}

export interface ReportSection {
  code: string;
  name: string;
  amount: string;
  heads: ReportHead[];
}

export interface ProfitAndLoss {
  scope: ReportScope;
  income: { sections: ReportSection[]; total: string };
  expenses: { sections: ReportSection[]; total: string };
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
  isProfit: boolean;
}

export interface BalanceSheet {
  scope: ReportScope;
  assets: { sections: ReportSection[]; total: string };
  liabilities: { sections: ReportSection[]; total: string };
  equity: {
    sections: ReportSection[];
    postedTotal: string;
    /** Income less expenses for the period, carried into equity for presentation. */
    retainedResultForPeriod: string;
    total: string;
  };
  totals: {
    totalAssets: string;
    totalLiabilities: string;
    totalEquity: string;
    totalLiabilitiesAndEquity: string;
    difference: string;
  };
  isBalanced: boolean;
  integrityError: string | null;
}

export interface DocumentAccountingOutcome {
  documentNumber: string;
  documentType: DocumentType;
  journals: {
    event: AccountingEvent;
    journalEntryId: string;
    journalNumber: string;
    alreadyPosted: boolean;
  }[];
  skipped: { event: string; reason: string }[];
}

export type MappingHealthStatus = 'PASS' | 'NOT_CONFIGURED' | 'ERROR';

export interface MappingHealthRow {
  mappingType: AccountMappingType;
  required: boolean;
  status: MappingHealthStatus;
  resolved: ResolvedAccount | null;
  error: string | null;
}

export interface MappingHealth {
  initialized: boolean;
  templateKey: string | null;
  rows: MappingHealthRow[];
  postable: boolean;
  failing: number;
}

export interface SupplierLedgerRow {
  journalLineId: string;
  date: string;
  journalEntryId: string;
  journalNumber: string;
  event: AccountingEvent;
  document: string | null;
  documentType: string | null;
  sourceDocumentId: string | null;
  sourcePaymentId: string | null;
  supplier: { id: string; code: string; name: string } | null;
  branch: { id: string; code: string; name: string } | null;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface SupplierLedger {
  supplier: { id: string; code: string; name: string } | null;
  controlAccount: {
    ledgerId: string;
    code: string;
    name: string;
    headCode: string;
    headName: string;
  };
  scope: { branchId: string | null; fromDate: string | null; toDate: string | null };
  rows: SupplierLedgerRow[];
  openingBalance: string;
  periodDebit: string;
  periodCredit: string;
  closingBalance: string;
}

export interface SupplierOutstandingRow {
  supplier: { id: string; code: string; name: string };
  invoiced: string;
  credited: string;
  paid: string;
  disputed: string;
  outstanding: string;
  ledgerBalance: string;
  difference: string;
  reconciled: boolean;
}

export interface SupplierOutstanding {
  controlAccount: { ledgerId: string; code: string; name: string };
  rows: SupplierOutstandingRow[];
  totals: { outstanding: string; ledgerBalance: string; difference: string };
  reconciled: boolean;
}

export interface PostPaymentAccountingResult {
  journalEntryId: string;
  journalNumber: string;
  alreadyPosted: boolean;
}

export interface InitializeAccountingResult {
  companyId: string;
  templateKey: string;
  templateVersion: string;
  alreadyInitialized: boolean;
  created: ChartCounts;
  total: ChartCounts;
}
