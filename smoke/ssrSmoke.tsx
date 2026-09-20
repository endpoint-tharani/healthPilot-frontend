/**
 * Render smoke test: server-renders every page with a stubbed auth context so that
 * import errors, bad element types and hook misuse surface without a browser.
 * Not part of the app bundle - built on demand with `vite build --ssr`.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material';
import { createAppTheme, type ColorMode } from '@/app/theme';
import { AuthContext, type AuthState } from '@/auth/AuthContext';
import type { CurrentUser, Permission } from '@/types/api';

import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { AppLayout } from '@/layouts/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { RequirementListPage } from '@/features/requirements/RequirementListPage';
import { RequirementCreatePage } from '@/features/requirements/RequirementCreatePage';
import { RequirementDetailPage } from '@/features/requirements/RequirementDetailPage';
import { PurchaseOrderListPage } from '@/features/purchase-orders/PurchaseOrderListPage';
import { PurchaseOrderCreatePage } from '@/features/purchase-orders/PurchaseOrderCreatePage';
import { PurchaseOrderDetailPage } from '@/features/purchase-orders/PurchaseOrderDetailPage';
import { GoodsReceiptListPage } from '@/features/goods-receipts/GoodsReceiptListPage';
import { GoodsReceiptCreatePage } from '@/features/goods-receipts/GoodsReceiptCreatePage';
import { GoodsReceiptDetailPage } from '@/features/goods-receipts/GoodsReceiptDetailPage';
import { CorrectionListPage } from '@/features/corrections/CorrectionListPage';
import { CorrectionCreatePage } from '@/features/corrections/CorrectionCreatePage';
import { CorrectionDetailPage } from '@/features/corrections/CorrectionDetailPage';
import { SupplierInvoiceListPage } from '@/features/supplier-invoices/SupplierInvoiceListPage';
import { SupplierInvoiceCreatePage } from '@/features/supplier-invoices/SupplierInvoiceCreatePage';
import { SupplierInvoiceDetailPage } from '@/features/supplier-invoices/SupplierInvoiceDetailPage';
import { CreditNoteListPage } from '@/features/credit-notes/CreditNoteListPage';
import { CreditNoteCreatePage } from '@/features/credit-notes/CreditNoteCreatePage';
import { CreditNoteDetailPage } from '@/features/credit-notes/CreditNoteDetailPage';
import { PaymentListPage } from '@/features/payments/PaymentListPage';
import { PaymentCreatePage } from '@/features/payments/PaymentCreatePage';
import { PaymentDetailPage } from '@/features/payments/PaymentDetailPage';
import { TransferListPage } from '@/features/transfers/TransferListPage';
import { TransferCreatePage } from '@/features/transfers/TransferCreatePage';
import { TransferDetailPage } from '@/features/transfers/TransferDetailPage';
import { DispensingListPage } from '@/features/dispensing/DispensingListPage';
import { DispensingCreatePage } from '@/features/dispensing/DispensingCreatePage';
import { DispensingDetailPage } from '@/features/dispensing/DispensingDetailPage';
import { StockOverviewPage } from '@/features/inventory/StockOverviewPage';
import { StockLedgerPage } from '@/features/inventory/StockLedgerPage';
import { DocumentRegisterPage } from '@/features/documents/DocumentRegisterPage';
import { AuditHistoryPage } from '@/features/documents/AuditHistoryPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { SuppliersPage } from '@/features/suppliers/SuppliersPage';
import { BranchesPage } from '@/features/branches/BranchesPage';
import { UsersPage } from '@/features/users/UsersPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const ALL_PERMISSIONS: Permission[] = [
  'BRANCH_VIEW',
  'BRANCH_MANAGE',
  'PRODUCT_VIEW',
  'PRODUCT_MANAGE',
  'SUPPLIER_VIEW',
  'SUPPLIER_MANAGE',
  'USER_VIEW',
  'USER_MANAGE',
  'STOCK_REQUIREMENT_CREATE',
  'STOCK_REQUIREMENT_VIEW',
  'STOCK_REQUIREMENT_APPROVE',
  'PURCHASE_ORDER_CREATE',
  'PURCHASE_ORDER_VIEW',
  'PURCHASE_ORDER_APPROVE',
  'GOODS_RECEIPT_CREATE',
  'GOODS_RECEIPT_VIEW',
  'GOODS_RECEIPT_POST',
  'RECEIPT_CORRECTION_CREATE',
  'RECEIPT_CORRECTION_VIEW',
  'SUPPLIER_INVOICE_CREATE',
  'SUPPLIER_INVOICE_VIEW',
  'CREDIT_NOTE_CREATE',
  'CREDIT_NOTE_VIEW',
  'PAYMENT_CREATE',
  'PAYMENT_VIEW',
  'PAYMENT_ALLOCATE',
  'STOCK_TRANSFER_CREATE',
  'STOCK_TRANSFER_VIEW',
  'STOCK_TRANSFER_DISPATCH',
  'STOCK_TRANSFER_RECEIVE',
  'DISPENSING_CREATE',
  'DISPENSING_VIEW',
  'INVENTORY_VIEW',
  'DOCUMENT_VIEW',
  'AUDIT_VIEW',
];

const user: CurrentUser = {
  id: 'u1',
  name: 'Smoke Tester',
  email: 'smoke@example.test',
  role: 'COMPANY_ADMIN',
  companyId: 'c1',
  branch: null,
  scopeType: 'ALL_BRANCHES',
  allowedBranchIds: null,
  permissions: ALL_PERMISSIONS,
};

const auth: AuthState = {
  user,
  initialising: false,
  login: async () => undefined,
  signup: async () => undefined,
  logout: async () => undefined,
  can: () => true,
  canAny: () => true,
  hasAllBranches: true,
  allowedBranchIds: null,
};

const PAGES: { name: string; path: string; element: React.ReactNode }[] = [
  { name: 'LoginPage', path: '/login', element: <LoginPage /> },
  { name: 'SignupPage', path: '/signup', element: <SignupPage /> },
  { name: 'DashboardPage', path: '/', element: <DashboardPage /> },
  { name: 'RequirementListPage', path: '/requirements', element: <RequirementListPage /> },
  { name: 'RequirementCreatePage', path: '/requirements/new', element: <RequirementCreatePage /> },
  { name: 'RequirementDetailPage', path: '/requirements/abc', element: <RequirementDetailPage /> },
  { name: 'PurchaseOrderListPage', path: '/purchase-orders', element: <PurchaseOrderListPage /> },
  {
    name: 'PurchaseOrderCreatePage',
    path: '/purchase-orders/new',
    element: <PurchaseOrderCreatePage />,
  },
  {
    name: 'PurchaseOrderDetailPage',
    path: '/purchase-orders/abc',
    element: <PurchaseOrderDetailPage />,
  },
  { name: 'GoodsReceiptListPage', path: '/goods-receipts', element: <GoodsReceiptListPage /> },
  {
    name: 'GoodsReceiptCreatePage',
    path: '/goods-receipts/new',
    element: <GoodsReceiptCreatePage />,
  },
  {
    name: 'GoodsReceiptDetailPage',
    path: '/goods-receipts/abc',
    element: <GoodsReceiptDetailPage />,
  },
  { name: 'CorrectionListPage', path: '/receipt-corrections', element: <CorrectionListPage /> },
  {
    name: 'CorrectionCreatePage',
    path: '/receipt-corrections/new',
    element: <CorrectionCreatePage />,
  },
  {
    name: 'CorrectionDetailPage',
    path: '/receipt-corrections/abc',
    element: <CorrectionDetailPage />,
  },
  {
    name: 'SupplierInvoiceListPage',
    path: '/supplier-invoices',
    element: <SupplierInvoiceListPage />,
  },
  {
    name: 'SupplierInvoiceCreatePage',
    path: '/supplier-invoices/new',
    element: <SupplierInvoiceCreatePage />,
  },
  {
    name: 'SupplierInvoiceDetailPage',
    path: '/supplier-invoices/abc',
    element: <SupplierInvoiceDetailPage />,
  },
  { name: 'CreditNoteListPage', path: '/credit-notes', element: <CreditNoteListPage /> },
  { name: 'CreditNoteCreatePage', path: '/credit-notes/new', element: <CreditNoteCreatePage /> },
  { name: 'CreditNoteDetailPage', path: '/credit-notes/abc', element: <CreditNoteDetailPage /> },
  { name: 'PaymentListPage', path: '/payments', element: <PaymentListPage /> },
  { name: 'PaymentCreatePage', path: '/payments/new', element: <PaymentCreatePage /> },
  { name: 'PaymentDetailPage', path: '/payments/abc', element: <PaymentDetailPage /> },
  { name: 'TransferListPage', path: '/stock-transfers', element: <TransferListPage /> },
  { name: 'TransferCreatePage', path: '/stock-transfers/new', element: <TransferCreatePage /> },
  { name: 'TransferDetailPage', path: '/stock-transfers/abc', element: <TransferDetailPage /> },
  { name: 'DispensingListPage', path: '/dispensing', element: <DispensingListPage /> },
  { name: 'DispensingCreatePage', path: '/dispensing/new', element: <DispensingCreatePage /> },
  { name: 'DispensingDetailPage', path: '/dispensing/abc', element: <DispensingDetailPage /> },
  { name: 'StockOverviewPage', path: '/inventory', element: <StockOverviewPage /> },
  { name: 'StockLedgerPage', path: '/inventory/ledger', element: <StockLedgerPage /> },
  { name: 'DocumentRegisterPage', path: '/documents', element: <DocumentRegisterPage /> },
  { name: 'AuditHistoryPage', path: '/audit', element: <AuditHistoryPage /> },
  { name: 'ProductsPage', path: '/products', element: <ProductsPage /> },
  { name: 'SuppliersPage', path: '/suppliers', element: <SuppliersPage /> },
  { name: 'BranchesPage', path: '/branches', element: <BranchesPage /> },
  { name: 'UsersPage', path: '/users', element: <UsersPage /> },
  { name: 'NotificationsPage', path: '/notifications', element: <NotificationsPage /> },
  { name: 'NotFoundPage', path: '/nope', element: <NotFoundPage /> },
];

function render(path: string, element: React.ReactNode, mode: ColorMode = 'light') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });

  return renderToString(
    <ThemeProvider theme={createAppTheme(mode)}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="*" element={element} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function runSmoke(): number {
  let failures = 0;

  // The layout shell is rendered on its own: sidebar, breadcrumbs and user menu.
  try {
    const html = render('/requirements', <AppLayout />);
    // The wordmark is split for the brand accent, so assert on stable landmarks.
    for (const marker of ['Pharmacy ERP', 'Operations', 'Stock Requisitions', 'Search documents']) {
      if (!html.includes(marker)) {
        throw new Error(`layout did not render "${marker}"`);
      }
    }
    console.log('PASS AppLayout');
  } catch (error) {
    failures += 1;
    console.log(`FAIL AppLayout: ${(error as Error).message}`);
  }

  for (const page of PAGES) {
    try {
      const html = render(page.path, page.element);
      if (html.length < 40) {
        throw new Error(`rendered only ${html.length} characters`);
      }
      console.log(`PASS ${page.name}`);
    } catch (error) {
      failures += 1;
      console.log(`FAIL ${page.name}: ${(error as Error).message}`);
    }
  }

  // Both colour modes must render: the shell and tables read palette tokens.
  // Selected by name so inserting a page cannot silently change the sample.
  const THEMED = ['DashboardPage', 'RequirementCreatePage', 'StockOverviewPage'];
  for (const mode of ['light', 'dark'] as ColorMode[]) {
    for (const page of PAGES.filter((p) => THEMED.includes(p.name))) {
      try {
        render(page.path, page.element, mode);
        console.log(`PASS ${page.name} [${mode}]`);
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${page.name} [${mode}]: ${(error as Error).message}`);
      }
    }
    try {
      render('/requirements', <AppLayout />, mode);
      console.log(`PASS AppLayout [${mode}]`);
    } catch (error) {
      failures += 1;
      console.log(`FAIL AppLayout [${mode}]: ${(error as Error).message}`);
    }
  }

  console.log(failures === 0 ? '\nSMOKE PASSED' : `\nSMOKE FAILED (${failures})`);
  return failures;
}

runSmoke();
