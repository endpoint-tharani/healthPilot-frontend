/**
 * Mirrors the backend contracts exactly. Every monetary or quantity value arrives
 * as a fixed-point string (Decimal.toFixed(2)) and stays a string until it is
 * formatted or handed to decimal.js - it is never parsed into a JS float.
 */
import type { DocumentAccountingState } from './accounting';

export type BranchType = 'CENTRAL_WAREHOUSE' | 'BRANCH';
export type BranchScopeType = 'ALL_BRANCHES' | 'SPECIFIC_BRANCHES';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'CENTRAL_PHARMACY'
  | 'BRANCH_MANAGER'
  | 'PHARMACIST'
  | 'STAFF';

export type DocumentType =
  | 'STOCK_REQUIREMENT'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'RECEIPT_CORRECTION'
  | 'SUPPLIER_INVOICE'
  | 'CREDIT_NOTE'
  | 'STOCK_TRANSFER'
  | 'DISPENSING';

export type DocumentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'CORRECTED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISCREPANT'
  | 'PAID';

export type DocumentLinkType =
  | 'FULFILLS'
  | 'RECEIVED_AGAINST'
  | 'CORRECTS'
  | 'INVOICED_AGAINST'
  | 'CREDIT_FOR'
  | 'TRANSFER_FOR'
  | 'DISPENSED_FROM';

export type StockStatus = 'USABLE' | 'DAMAGED' | 'QUARANTINED' | 'EXPIRED';

export type InventoryTransactionType =
  | 'OPENING_BALANCE'
  | 'PURCHASE'
  | 'RECEIPT'
  | 'CORRECTION'
  | 'DAMAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'SALE'
  | 'DISPENSING'
  | 'RETURN'
  | 'ADJUSTMENT';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';

export type Permission =
  | 'BRANCH_VIEW'
  | 'BRANCH_MANAGE'
  | 'PRODUCT_VIEW'
  | 'PRODUCT_MANAGE'
  | 'SUPPLIER_VIEW'
  | 'SUPPLIER_MANAGE'
  | 'USER_VIEW'
  | 'USER_MANAGE'
  | 'STOCK_REQUIREMENT_CREATE'
  | 'STOCK_REQUIREMENT_VIEW'
  | 'STOCK_REQUIREMENT_APPROVE'
  | 'PURCHASE_ORDER_CREATE'
  | 'PURCHASE_ORDER_VIEW'
  | 'PURCHASE_ORDER_APPROVE'
  | 'GOODS_RECEIPT_CREATE'
  | 'GOODS_RECEIPT_VIEW'
  | 'GOODS_RECEIPT_POST'
  | 'RECEIPT_CORRECTION_CREATE'
  | 'RECEIPT_CORRECTION_VIEW'
  | 'SUPPLIER_INVOICE_CREATE'
  | 'SUPPLIER_INVOICE_VIEW'
  | 'CREDIT_NOTE_CREATE'
  | 'CREDIT_NOTE_VIEW'
  | 'PAYMENT_CREATE'
  | 'PAYMENT_VIEW'
  | 'PAYMENT_ALLOCATE'
  | 'STOCK_TRANSFER_CREATE'
  | 'STOCK_TRANSFER_VIEW'
  | 'STOCK_TRANSFER_DISPATCH'
  | 'STOCK_TRANSFER_RECEIVE'
  | 'DISPENSING_CREATE'
  | 'DISPENSING_VIEW'
  | 'INVENTORY_VIEW'
  | 'DOCUMENT_VIEW'
  | 'AUDIT_VIEW'
  | 'ACCOUNTING_VIEW'
  | 'ACCOUNTING_POST'
  | 'ACCOUNTING_MANAGE';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiFailureBody {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

/* ---------------------------------------------------------------- auth ---- */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface SignupBranchInput {
  code: string;
  name: string;
  type: BranchType;
  address?: string;
}

export interface SignupRequest {
  company: { name: string; code?: string };
  admin: { name: string; email: string; password: string };
  /** Exactly one branch must be the CENTRAL_WAREHOUSE. */
  branches: SignupBranchInput[];
}

export interface SignupResponse extends LoginResponse {
  company: { id: string; code: string; name: string };
  branches: (BranchRef & { type: BranchType; address: string | null })[];
}

export interface CurrentUser extends AuthUser {
  branch: BranchRef | null;
  scopeType: BranchScopeType;
  /** null means ALL_BRANCHES. */
  allowedBranchIds: string[] | null;
  permissions: Permission[];
}

/* ------------------------------------------------------------- masters ---- */

export interface BranchRef {
  id: string;
  code: string;
  name: string;
  type?: BranchType;
}

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: BranchType;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  code: string;
  name: string;
  contactInfo: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupplierRef = Pick<Supplier, 'id' | 'code' | 'name'>;

export interface BatchRef {
  id: string;
  batchNumber: string;
  expiryDate: string;
  status?: StockStatus;
}

export interface Product {
  id: string;
  companyId: string;
  code: string;
  name: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  taxRate: string;
  trackInventory: boolean;
  isActive: boolean;
  minTemp: string | null;
  maxTemp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  batches: BatchRef[];
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
}

export interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  branchScope: BranchScopeType;
  branchId: string | null;
  companyId: string;
  createdAt: string;
  branch: BranchRef | null;
  branches: BranchRef[];
  permissions: Permission[];
}

/* ----------------------------------------------------------- documents ---- */

/** One line of a document, reduced to what a picker or a list row needs. */
export interface DocumentLineSummary {
  product: { id: string; code: string; name: string; unit: string };
  quantity: string;
  unitOfMeasure: string | null;
}

export interface DocumentSummary {
  id: string;
  companyId: string;
  branchId: string | null;
  sourceBranchId: string | null;
  destinationBranchId: string | null;
  supplierId: string | null;
  documentNumber: string;
  documentType: DocumentType;
  status: DocumentStatus;
  documentDate: string;
  expectedDeliveryDate: string | null;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  disputedAmount: string;
  notes: string | null;
  supplierRef: string | null;
  patientRef: string | null;
  prescriptionRef: string | null;
  /** Where this document stands with the books, and why. */
  accounting: DocumentAccountingState;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  branch: BranchRef | null;
  sourceBranch: BranchRef | null;
  destinationBranch: BranchRef | null;
  supplier: SupplierRef | null;
  createdBy: UserRef;
  _count?: { lineItems: number };
  /**
   * The first few product lines, served only by endpoints that opt in - today
   * the stock requisition list, where a picker has to tell one requisition from
   * another by what was asked for rather than by its number alone.
   */
  lineSummary?: DocumentLineSummary[];
}

export interface DocumentLineItem {
  id: string;
  lineNumber: number;
  product: { id: string; code?: string; name?: string; unit?: string };
  batch: BatchRef | null;
  description: string | null;
  quantity: string;
  acceptedQuantity: string | null;
  damagedQuantity: string | null;
  missingQuantity: string | null;
  unitPrice: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  unitOfMeasure: string | null;
  referenceLineItemId: string | null;
}

export interface DocumentRef {
  id: string;
  documentNumber: string;
  documentType: DocumentType;
  status: DocumentStatus;
}

export interface DocumentLinkEntry {
  linkType: DocumentLinkType;
  document: DocumentRef;
}

export interface DocumentInventoryTransaction {
  id: string;
  branch: BranchRef | null;
  product: { id: string; code: string; name: string } | null;
  batch: { id: string; batchNumber: string } | null;
  createdBy: UserRef | null;
  transactionType: InventoryTransactionType;
  stockStatus: StockStatus;
  quantity: string;
  unitCost: string;
  totalCost: string;
  transactionDate: string;
  notes: string | null;
}

export interface DocumentPaymentAllocation {
  id: string;
  allocatedAmount: string;
  payment: {
    id: string;
    paymentNumber: string;
    method: PaymentMethod;
    amount: string;
    paymentDate: string;
  };
}

export interface DocumentHistoryEntry {
  id: string;
  action: string;
  reason: string | null;
  changes: { old?: unknown; new?: unknown } | null;
  user: UserRef;
  createdAt: string;
}

export interface DocumentDetail extends Omit<DocumentSummary, '_count'> {
  lineItems: DocumentLineItem[];
  links: { outgoing: DocumentLinkEntry[]; incoming: DocumentLinkEntry[] };
  inventoryTransactions: DocumentInventoryTransaction[];
  paymentAllocations: DocumentPaymentAllocation[];
  history?: DocumentHistoryEntry[];
}

/* ------------------------------------------- internal stock availability ---- */

/**
 * How much of a requirement the stock a branch can genuinely spare would cover.
 * Always measured against the sourceable SURPLUS, never against stock on hand.
 */
export type SurplusStatus = 'HIGH_SURPLUS' | 'PARTIAL_SURPLUS' | 'NO_SURPLUS';

/** One usable stock bucket at another branch that could be sent to the requester. */
export interface AvailabilitySource {
  branch: { id: string; code: string; name: string; type: BranchType };
  batch: { id: string; batchNumber: string; expiryDate: string };
  /** Usable quantity on hand right now, net of other transfers already raised. */
  available: string;
  /** Of that, what the holding branch could spare once its own demand is met. */
  surplus: string;
  /** What the backend proposes taking from here, capped at what is outstanding. */
  suggested: string;
  /** Weighted average ledger cost; what a transfer would carry to the destination. */
  unitCost: string;
}

export interface AvailabilityLine {
  product: { id: string; code: string; name: string; unit: string };
  requested: string;
  /** Received so far, from supplier receipts and internal transfers alike. */
  fulfilled: string;
  onOrder: string;
  onTransfer: string;
  outstanding: string;
  internalAvailable: string;
  procurementShortfall: string;
  /** Surplus across every source branch, before the cap at what is outstanding. */
  internalSurplus: string;
  /** On-hand quantity the source branches are keeping for their own requirements. */
  reservedBySourceBranches: string;
  surplusStatus: SurplusStatus;
  /** The same figures as internalAvailable / procurementShortfall, named for the decision. */
  suggestedInternalQty: string;
  suggestedProcurementQty: string;
  /** Counted in the total but held at a branch this user may not inspect. */
  withheldQuantity: string;
  withheldBranchCount: number;
  sources: AvailabilitySource[];
}

export interface RequirementAvailability {
  requirement: {
    id: string;
    documentNumber: string;
    status: DocumentStatus;
    branch: { id: string; code: string; name: string } | null;
  };
  lines: AvailabilityLine[];
  totals: {
    requested: string;
    fulfilled: string;
    outstanding: string;
    internalAvailable: string;
    procurementShortfall: string;
    internalSurplus: string;
    reservedBySourceBranches: string;
    suggestedInternalQty: string;
    suggestedProcurementQty: string;
  };
  /** The whole requirement's surplus position, for the procurement guardrail. */
  surplusStatus: SurplusStatus;
  detailRestricted: boolean;
  canCreateTransfer: boolean;
}

/* ------------------------------------------------ requirement sourcing ---- */

/**
 * Where a supplier's price came from. LAST_PURCHASE is what this supplier really
 * charged last time; PRODUCT_MASTER is the list price, shown when they have never
 * supplied this product. Neither is a quote.
 */
export type PriceSource = 'LAST_PURCHASE' | 'PRODUCT_MASTER';

export interface SupplierOption {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  unitPrice: string;
  taxRate: string;
  estimatedSubtotal: string;
  estimatedTax: string;
  estimatedTotal: string;
  /** Mean days from order to first receipt, observed. Null when never supplied. */
  leadTimeDays: number | null;
  leadTimeSampleSize: number;
  priceSource: PriceSource;
  lastPurchasedAt: string | null;
}

export interface SourcingBatch {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  availableQty: string;
  /** Of that, what this branch could genuinely spare. */
  surplusQty: string;
  suggestedQty: string;
  unitCost: string;
  /** Factual flag: earliest-expiring stock offered for this product. */
  expiresSoonest: boolean;
}

export interface SourcingBranch {
  branchId: string;
  branchCode: string;
  branchName: string;
  branchType: BranchType;
  totalAvailableQty: string;
  /** On hand, less what this branch still owes its own approved requirements. */
  sourceableSurplusQty: string;
  reservedQty: string;
  surplusStatus: SurplusStatus;
  totalSuggestedQty: string;
  batches: SourcingBatch[];
}

export interface SourcingProductLine {
  product: { id: string; code: string; name: string; unit: string };
  requestedQty: string;
  fulfilledQty: string;
  remainingQty: string;
  internal: {
    totalSourceableQty: string;
    /** Surplus across every source branch, before the cap at what is outstanding. */
    totalSurplusQty: string;
    reservedQty: string;
    surplusStatus: SurplusStatus;
    suggestedInternalQty: string;
    suggestedProcurementQty: string;
    withheldQty: string;
    withheldBranchCount: number;
    sources: SourcingBranch[];
  };
  procurement: {
    requiredQty: string;
    comparisonRestricted: boolean;
    suppliers: SupplierOption[];
  };
  sourcingSummary: {
    internalAvailableQty: string;
    procurementRequiredQty: string;
    onTransferQty: string;
    onOrderQty: string;
    remainingQty: string;
  };
}

export interface RequirementSourcingAnalysis {
  requirement: {
    id: string;
    documentNumber: string;
    status: DocumentStatus;
    branch: { id: string; code: string; name: string } | null;
  };
  productLines: SourcingProductLine[];
  totals: {
    requested: string;
    fulfilled: string;
    outstanding: string;
    internalAvailable: string;
    procurementShortfall: string;
    internalSurplus: string;
    reservedBySourceBranches: string;
    suggestedInternalQty: string;
    suggestedProcurementQty: string;
  };
  /** The whole requirement's surplus position, for the procurement guardrail. */
  surplusStatus: SurplusStatus;
  detailRestricted: boolean;
  canCreateTransfer: boolean;
  canCreatePurchaseOrder: boolean;
}

export interface InvoiceFinancials {
  invoiceTotal: string;
  acceptedPayable: string;
  disputedAmount: string;
  creditedAmount: string;
  paidAmount: string;
  outstandingBalance: string;
  allocatableAmount: string;
}

export interface SupplierInvoiceDetail extends DocumentDetail {
  financials: InvoiceFinancials;
}

export interface DocumentHistoryResponse {
  document: { id: string; documentNumber: string; documentType: DocumentType };
  history: DocumentHistoryEntry[];
}

/* ------------------------------------------------------------ payments ---- */

export interface PaymentAllocationEntry {
  id: string;
  allocatedAmount: string;
  document?: DocumentRef;
}

export interface Payment {
  id: string;
  companyId: string;
  branchId: string | null;
  supplierId: string | null;
  paymentNumber: string;
  amount: string;
  method: PaymentMethod;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  supplier: SupplierRef | null;
  branch: BranchRef | null;
  createdBy?: UserRef;
  allocations: PaymentAllocationEntry[];
  allocatedAmount: string;
  unallocatedAmount: string;
  /** Mirrors the document shape, so both pages read one accounting contract. */
  accounting: DocumentAccountingState;
}

/* ----------------------------------------------------------- inventory ---- */

export interface StockRow {
  branch: BranchRef | null;
  product: { id: string; code: string; name: string; unit: string } | null;
  batch: BatchRef | null;
  stockStatus: StockStatus;
  quantity: string;
  stockValue: string;
}

export interface LedgerRow {
  id: string;
  branch: BranchRef | null;
  product: { id: string; code: string; name: string } | null;
  batch: BatchRef | null;
  document: { id: string; documentNumber: string; documentType: DocumentType } | null;
  createdBy: UserRef | null;
  transactionType: InventoryTransactionType;
  stockStatus: StockStatus;
  quantity: string;
  unitCost: string;
  totalCost: string;
  transactionDate: string;
  notes: string | null;
}

/* -------------------------------------------------------- notifications ---- */

export type NotificationType =
  | 'STOCK_REQUIREMENT_SUBMITTED'
  | 'STOCK_REQUIREMENT_APPROVED'
  | 'STOCK_REQUIREMENT_REJECTED'
  | 'STOCK_REQUIREMENT_PARTIALLY_FULFILLED'
  | 'STOCK_REQUIREMENT_FULFILLED'
  | 'PURCHASE_ORDER_CREATED'
  | 'PURCHASE_ORDER_APPROVED'
  | 'GOODS_RECEIPT_POSTED'
  | 'GOODS_RECEIPT_CORRECTED'
  | 'SUPPLIER_INVOICE_CREATED'
  | 'SUPPLIER_INVOICE_DISPUTED'
  | 'CREDIT_NOTE_POSTED'
  | 'PAYMENT_ALLOCATED'
  | 'STOCK_TRANSFER_CREATED'
  | 'STOCK_TRANSFER_DISPATCHED'
  | 'STOCK_TRANSFER_RECEIVED'
  | 'DISPENSING_COMPLETED'
  | 'LOW_STOCK'
  | 'EXPIRY_ALERT';

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type NotificationEntityType = 'DOCUMENT' | 'PAYMENT' | 'PRODUCT' | 'BATCH';

/** A notification as the REST API returns it, with its display relations. */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  documentId: string | null;
  branchId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  document: {
    id: string;
    documentNumber: string;
    documentType: DocumentType;
    status: DocumentStatus;
  } | null;
  branch: BranchRef | null;
}

/**
 * The realtime payload. Deliberately narrower than AppNotification: the socket
 * carries only what the bell needs to render and navigate, so the list relations
 * are absent until the query cache refetches them.
 */
export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  documentId: string | null;
  branchId: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPageMeta extends PageMeta {
  /** Unread across the whole inbox, not just this page. */
  unread: number;
}

export interface NotificationPage {
  data: AppNotification[];
  meta: NotificationPageMeta;
}
