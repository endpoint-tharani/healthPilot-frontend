import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import MedicationLiquidOutlinedIcon from '@mui/icons-material/MedicationLiquidOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import ImportContactsOutlinedIcon from '@mui/icons-material/ImportContactsOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import type { Permission } from '@/types/api';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Shown when the user holds at least one of these; empty means never gated. */
  permissions: Permission[];
}

export interface NavSection {
  /** Empty title renders the item(s) at the top level, outside any group. */
  title: string;
  items: NavItem[];
}

/**
 * Sidebar model. Visibility is a UX convenience only - every route and every
 * request is authorised again by the backend.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      {
        label: 'Dashboard',
        path: '/',
        icon: <GridViewOutlinedIcon fontSize="small" />,
        permissions: ['DOCUMENT_VIEW'],
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Stock Requisitions',
        path: '/requirements',
        icon: <ListAltOutlinedIcon fontSize="small" />,
        permissions: ['STOCK_REQUIREMENT_VIEW'],
      },
      {
        label: 'Purchase Orders',
        path: '/purchase-orders',
        icon: <ShoppingCartOutlinedIcon fontSize="small" />,
        permissions: ['PURCHASE_ORDER_VIEW'],
      },
      {
        label: 'Goods Receipts',
        path: '/goods-receipts',
        icon: <LocalShippingOutlinedIcon fontSize="small" />,
        permissions: ['GOODS_RECEIPT_VIEW'],
      },
      {
        label: 'Receipt Corrections',
        path: '/receipt-corrections',
        icon: <EditNoteOutlinedIcon fontSize="small" />,
        permissions: ['RECEIPT_CORRECTION_VIEW'],
      },
      {
        label: 'Supplier Invoices',
        path: '/supplier-invoices',
        icon: <ReceiptLongOutlinedIcon fontSize="small" />,
        permissions: ['SUPPLIER_INVOICE_VIEW'],
      },
      {
        label: 'Credit Notes',
        path: '/credit-notes',
        icon: <ReceiptOutlinedIcon fontSize="small" />,
        permissions: ['CREDIT_NOTE_VIEW'],
      },
      {
        label: 'Payments',
        path: '/payments',
        icon: <PaymentsOutlinedIcon fontSize="small" />,
        permissions: ['PAYMENT_VIEW'],
      },
      {
        label: 'Stock Transfers',
        path: '/stock-transfers',
        icon: <SwapHorizOutlinedIcon fontSize="small" />,
        permissions: ['STOCK_TRANSFER_VIEW'],
      },
      {
        label: 'Dispensing',
        path: '/dispensing',
        icon: <MedicationLiquidOutlinedIcon fontSize="small" />,
        permissions: ['DISPENSING_VIEW'],
      },
    ],
  },
  {
    title: 'Inventory',
    items: [
      {
        label: 'Stock Overview',
        path: '/inventory',
        icon: <WarehouseOutlinedIcon fontSize="small" />,
        permissions: ['INVENTORY_VIEW'],
      },
      {
        label: 'Stock Ledger',
        path: '/inventory/ledger',
        icon: <MenuBookOutlinedIcon fontSize="small" />,
        permissions: ['INVENTORY_VIEW'],
      },
    ],
  },
  {
    title: 'Accounting',
    items: [
      {
        label: 'Chart of Accounts',
        path: '/accounting/chart-of-accounts',
        icon: <AccountTreeOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'Ledger Accounts',
        path: '/accounting/ledgers',
        icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'Journal Entries',
        path: '/accounting/journals',
        icon: <ArticleOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'General Ledger',
        path: '/accounting/general-ledger',
        icon: <ImportContactsOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'Supplier Ledger',
        path: '/accounting/supplier-ledger',
        icon: <StorefrontOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'Trial Balance',
        path: '/accounting/reports/trial-balance',
        icon: <BalanceOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'Profit & Loss',
        path: '/accounting/reports/profit-loss',
        icon: <ShowChartOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      {
        label: 'Balance Sheet',
        path: '/accounting/reports/balance-sheet',
        icon: <AccountBalanceOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
      // Last in the section on purpose: it is where somebody goes when something
      // did not post, not somewhere they pass through daily.
      {
        label: 'Accounting Setup',
        path: '/accounting/setup',
        icon: <FactCheckOutlinedIcon fontSize="small" />,
        permissions: ['ACCOUNTING_VIEW'],
      },
    ],
  },
  {
    title: 'Masters',
    items: [
      {
        label: 'Products',
        path: '/products',
        icon: <Inventory2OutlinedIcon fontSize="small" />,
        permissions: ['PRODUCT_VIEW'],
      },
      {
        label: 'Suppliers',
        path: '/suppliers',
        icon: <StorefrontOutlinedIcon fontSize="small" />,
        permissions: ['SUPPLIER_VIEW'],
      },
      {
        label: 'Branches',
        path: '/branches',
        icon: <AccountTreeOutlinedIcon fontSize="small" />,
        permissions: ['BRANCH_VIEW'],
      },
    ],
  },
  {
    title: 'Documents',
    items: [
      {
        label: 'Document Register',
        path: '/documents',
        icon: <FolderOpenOutlinedIcon fontSize="small" />,
        permissions: ['DOCUMENT_VIEW'],
      },
      {
        label: 'Notifications',
        path: '/notifications',
        icon: <NotificationsNoneOutlinedIcon fontSize="small" />,
        // Everyone has their own inbox, so this is shown to every signed-in user.
        permissions: [],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Users',
        path: '/users',
        icon: <PeopleAltOutlinedIcon fontSize="small" />,
        permissions: ['USER_VIEW'],
      },
      {
        label: 'Audit / History',
        path: '/audit',
        icon: <HistoryOutlinedIcon fontSize="small" />,
        permissions: ['AUDIT_VIEW'],
      },
    ],
  },
];

/** Breadcrumb/page titles for routes that are not in the sidebar. */
export const ROUTE_TITLES: Record<string, string> = {
  '/requirements/new': 'New Stock Requirement',
  '/purchase-orders/new': 'New Purchase Order',
  '/goods-receipts/new': 'New Goods Receipt',
  '/receipt-corrections/new': 'New Receipt Correction',
  '/supplier-invoices/new': 'New Supplier Invoice',
  '/credit-notes/new': 'New Credit Note',
  '/payments/new': 'New Payment',
  '/stock-transfers/new': 'New Stock Transfer',
  '/dispensing/new': 'New Dispensing',
  '/products/new': 'New Product',
  '/suppliers/new': 'New Supplier',
  '/branches/new': 'New Branch',
  '/users/new': 'New User',
  '/notifications': 'Notifications',
  '/accounting/chart-of-accounts': 'Chart of Accounts',
  '/accounting/ledgers': 'Ledger Accounts',
  '/accounting/journals': 'Journal Entries',
  '/accounting/general-ledger': 'General Ledger',
  '/accounting/supplier-ledger': 'Supplier Ledger',
  '/accounting/setup': 'Accounting Setup',
  '/accounting/reports/trial-balance': 'Trial Balance',
  '/accounting/reports/profit-loss': 'Profit & Loss',
  '/accounting/reports/balance-sheet': 'Balance Sheet',
};

/** Quick-create menu behind the "+" button, filtered by permission. */
export interface QuickAction {
  label: string;
  path: string;
  permission: Permission;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Stock Requirement', path: '/requirements/new', permission: 'STOCK_REQUIREMENT_CREATE' },
  { label: 'Purchase Order', path: '/purchase-orders/new', permission: 'PURCHASE_ORDER_CREATE' },
  { label: 'Goods Receipt', path: '/goods-receipts/new', permission: 'GOODS_RECEIPT_CREATE' },
  {
    label: 'Receipt Correction',
    path: '/receipt-corrections/new',
    permission: 'RECEIPT_CORRECTION_CREATE',
  },
  {
    label: 'Supplier Invoice',
    path: '/supplier-invoices/new',
    permission: 'SUPPLIER_INVOICE_CREATE',
  },
  { label: 'Credit Note', path: '/credit-notes/new', permission: 'CREDIT_NOTE_CREATE' },
  { label: 'Payment', path: '/payments/new', permission: 'PAYMENT_CREATE' },
  { label: 'Stock Transfer', path: '/stock-transfers/new', permission: 'STOCK_TRANSFER_CREATE' },
  { label: 'Dispensing', path: '/dispensing/new', permission: 'DISPENSING_CREATE' },
];
