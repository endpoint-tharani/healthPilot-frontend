import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import MedicationLiquidOutlinedIcon from '@mui/icons-material/MedicationLiquidOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import type { StatusTone } from '@/app/theme';
import { documentPath } from '@/utils/format';
import type { AppNotification, NotificationSeverity, NotificationType } from '@/types/api';

/** Severity drives colour; the existing status palette is reused unchanged. */
export const SEVERITY_TONE: Record<NotificationSeverity, StatusTone> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'danger',
};

/** One icon per type, matching the sidebar icon of the module it came from. */
const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  STOCK_REQUIREMENT_SUBMITTED: ListAltOutlinedIcon,
  STOCK_REQUIREMENT_APPROVED: CheckCircleOutlineIcon,
  STOCK_REQUIREMENT_REJECTED: CancelOutlinedIcon,
  STOCK_REQUIREMENT_PARTIALLY_FULFILLED: PendingOutlinedIcon,
  STOCK_REQUIREMENT_FULFILLED: DoneAllOutlinedIcon,
  PURCHASE_ORDER_CREATED: ShoppingCartOutlinedIcon,
  PURCHASE_ORDER_APPROVED: ShoppingCartOutlinedIcon,
  GOODS_RECEIPT_POSTED: LocalShippingOutlinedIcon,
  GOODS_RECEIPT_CORRECTED: EditNoteOutlinedIcon,
  SUPPLIER_INVOICE_CREATED: ReceiptLongOutlinedIcon,
  SUPPLIER_INVOICE_DISPUTED: ReportGmailerrorredOutlinedIcon,
  CREDIT_NOTE_POSTED: ReceiptOutlinedIcon,
  PAYMENT_ALLOCATED: PaymentsOutlinedIcon,
  STOCK_TRANSFER_CREATED: SwapHorizOutlinedIcon,
  STOCK_TRANSFER_DISPATCHED: SwapHorizOutlinedIcon,
  STOCK_TRANSFER_RECEIVED: SwapHorizOutlinedIcon,
  DISPENSING_COMPLETED: MedicationLiquidOutlinedIcon,
  LOW_STOCK: Inventory2OutlinedIcon,
  EXPIRY_ALERT: EventBusyOutlinedIcon,
};

export function notificationIcon(type: NotificationType): React.ElementType {
  return TYPE_ICONS[type] ?? ListAltOutlinedIcon;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  STOCK_REQUIREMENT_SUBMITTED: 'Requirement submitted',
  STOCK_REQUIREMENT_APPROVED: 'Requirement approved',
  STOCK_REQUIREMENT_REJECTED: 'Requirement rejected',
  STOCK_REQUIREMENT_PARTIALLY_FULFILLED: 'Requirement partially fulfilled',
  STOCK_REQUIREMENT_FULFILLED: 'Requirement fulfilled',
  PURCHASE_ORDER_CREATED: 'Purchase order raised',
  PURCHASE_ORDER_APPROVED: 'Purchase order approved',
  GOODS_RECEIPT_POSTED: 'Goods receipt posted',
  GOODS_RECEIPT_CORRECTED: 'Receipt corrected',
  SUPPLIER_INVOICE_CREATED: 'Supplier invoice booked',
  SUPPLIER_INVOICE_DISPUTED: 'Supplier invoice in dispute',
  CREDIT_NOTE_POSTED: 'Credit note posted',
  PAYMENT_ALLOCATED: 'Payment allocated',
  STOCK_TRANSFER_CREATED: 'Transfer raised',
  STOCK_TRANSFER_DISPATCHED: 'Transfer dispatched',
  STOCK_TRANSFER_RECEIVED: 'Transfer received',
  DISPENSING_COMPLETED: 'Dispensing completed',
  LOW_STOCK: 'Low stock',
  EXPIRY_ALERT: 'Expiry alert',
};

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];

/**
 * Which arrivals also interrupt with a snackbar. Everything reaches the bell;
 * only decisions and exceptions are loud enough to break concentration, so a
 * busy procurement user is not toasted for every routine posting.
 */
const TOASTED: NotificationType[] = [
  'STOCK_REQUIREMENT_SUBMITTED',
  'STOCK_REQUIREMENT_APPROVED',
  'STOCK_REQUIREMENT_REJECTED',
  'STOCK_REQUIREMENT_PARTIALLY_FULFILLED',
  'STOCK_REQUIREMENT_FULFILLED',
  'PURCHASE_ORDER_APPROVED',
  'GOODS_RECEIPT_CORRECTED',
  'SUPPLIER_INVOICE_DISPUTED',
  'STOCK_TRANSFER_DISPATCHED',
  'STOCK_TRANSFER_RECEIVED',
  'LOW_STOCK',
  'EXPIRY_ALERT',
];

export function shouldToast(type: NotificationType): boolean {
  return TOASTED.includes(type);
}

/**
 * Where clicking a notification goes. A notification that has lost its document
 * - deleted, or never had one - returns null and is rendered as non-navigable
 * rather than sending the user to a dead route.
 */
export function notificationTarget(notification: AppNotification): string | null {
  if (notification.document) {
    return documentPath(notification.document.documentType, notification.document.id);
  }
  return null;
}

/** "2 minutes ago" from a timestamp, for the panel and the history list. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '—';
  }
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) {
    return 'just now';
  }

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let previous = 1;
  for (const [limit, unit] of units) {
    if (seconds < limit) {
      return formatter.format(-Math.round(seconds / previous), unit);
    }
    previous = limit;
  }
  return formatter.format(-Math.round(seconds / 31557600), 'year');
}
