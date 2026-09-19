import type {
  DocumentLinkType,
  DocumentStatus,
  DocumentType,
  InventoryTransactionType,
  PaymentMethod,
  StockStatus,
  UserRole,
} from '@/types/api';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

/** ISO date (yyyy-mm-dd) for <input type="date"> values. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function todayInput(): string {
  return toDateInput(new Date());
}

export function daysFromNowInput(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

/** Turns SCREAMING_SNAKE_CASE enums into "Screaming snake case" labels. */
export function humanise(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  STOCK_REQUIREMENT: 'Stock Requirement',
  PURCHASE_ORDER: 'Purchase Order',
  GOODS_RECEIPT: 'Goods Receipt',
  RECEIPT_CORRECTION: 'Receipt Correction',
  SUPPLIER_INVOICE: 'Supplier Invoice',
  CREDIT_NOTE: 'Credit Note',
  STOCK_TRANSFER: 'Stock Transfer',
  DISPENSING: 'Dispensing',
};

export const DOCUMENT_TYPES: DocumentType[] = [
  'STOCK_REQUIREMENT',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'RECEIPT_CORRECTION',
  'SUPPLIER_INVOICE',
  'CREDIT_NOTE',
  'STOCK_TRANSFER',
  'DISPENSING',
];

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CORRECTED',
  'DISPATCHED',
  'RECEIVED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'COMPLETED',
  'CANCELLED',
  'DISCREPANT',
  'PAID',
];

export const STOCK_STATUSES: StockStatus[] = ['USABLE', 'DAMAGED', 'QUARANTINED', 'EXPIRED'];

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER'];

export const USER_ROLES: UserRole[] = [
  'COMPANY_ADMIN',
  'CENTRAL_PHARMACY',
  'BRANCH_MANAGER',
  'PHARMACIST',
  'STAFF',
];

export const INVENTORY_TRANSACTION_TYPES: InventoryTransactionType[] = [
  'OPENING_BALANCE',
  'PURCHASE',
  'RECEIPT',
  'CORRECTION',
  'DAMAGE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'SALE',
  'DISPENSING',
  'RETURN',
  'ADJUSTMENT',
];

export const DOCUMENT_LINK_LABELS: Record<DocumentLinkType, string> = {
  FULFILLS: 'Fulfils',
  RECEIVED_AGAINST: 'Received against',
  CORRECTS: 'Corrects',
  INVOICED_AGAINST: 'Invoiced against',
  CREDIT_FOR: 'Credit for',
  TRANSFER_FOR: 'Transfer for',
  DISPENSED_FROM: 'Dispensed from',
};

/** Route segment that owns each document type, for cross-document navigation. */
export const DOCUMENT_TYPE_ROUTES: Record<DocumentType, string> = {
  STOCK_REQUIREMENT: '/requirements',
  PURCHASE_ORDER: '/purchase-orders',
  GOODS_RECEIPT: '/goods-receipts',
  RECEIPT_CORRECTION: '/receipt-corrections',
  SUPPLIER_INVOICE: '/supplier-invoices',
  CREDIT_NOTE: '/credit-notes',
  STOCK_TRANSFER: '/stock-transfers',
  DISPENSING: '/dispensing',
};

export function documentPath(documentType: DocumentType, id: string): string {
  return `${DOCUMENT_TYPE_ROUTES[documentType]}/${id}`;
}
