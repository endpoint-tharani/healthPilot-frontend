import { Navigate, Route, Routes } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from '@/auth/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
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

/**
 * Route-level permission gates mirror the backend permission model. They are a UX
 * convenience: the API re-checks authorization on every request regardless.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />

      <Route
        path="/signup"
        element={
          <RedirectIfAuthenticated>
            <SignupPage />
          </RedirectIfAuthenticated>
        }
      />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />

          <Route element={<RequirePermission permissions={['STOCK_REQUIREMENT_VIEW']} />}>
            <Route path="requirements" element={<RequirementListPage />} />
            <Route path="requirements/new" element={<RequirementCreatePage />} />
            <Route path="requirements/:id" element={<RequirementDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['PURCHASE_ORDER_VIEW']} />}>
            <Route path="purchase-orders" element={<PurchaseOrderListPage />} />
            <Route path="purchase-orders/new" element={<PurchaseOrderCreatePage />} />
            <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['GOODS_RECEIPT_VIEW']} />}>
            <Route path="goods-receipts" element={<GoodsReceiptListPage />} />
            <Route path="goods-receipts/new" element={<GoodsReceiptCreatePage />} />
            <Route path="goods-receipts/:id" element={<GoodsReceiptDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['RECEIPT_CORRECTION_VIEW']} />}>
            <Route path="receipt-corrections" element={<CorrectionListPage />} />
            <Route path="receipt-corrections/new" element={<CorrectionCreatePage />} />
            <Route path="receipt-corrections/:id" element={<CorrectionDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['SUPPLIER_INVOICE_VIEW']} />}>
            <Route path="supplier-invoices" element={<SupplierInvoiceListPage />} />
            <Route path="supplier-invoices/new" element={<SupplierInvoiceCreatePage />} />
            <Route path="supplier-invoices/:id" element={<SupplierInvoiceDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['CREDIT_NOTE_VIEW']} />}>
            <Route path="credit-notes" element={<CreditNoteListPage />} />
            <Route path="credit-notes/new" element={<CreditNoteCreatePage />} />
            <Route path="credit-notes/:id" element={<CreditNoteDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['PAYMENT_VIEW']} />}>
            <Route path="payments" element={<PaymentListPage />} />
            <Route path="payments/new" element={<PaymentCreatePage />} />
            <Route path="payments/:id" element={<PaymentDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['STOCK_TRANSFER_VIEW']} />}>
            <Route path="stock-transfers" element={<TransferListPage />} />
            <Route path="stock-transfers/new" element={<TransferCreatePage />} />
            <Route path="stock-transfers/:id" element={<TransferDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['DISPENSING_VIEW']} />}>
            <Route path="dispensing" element={<DispensingListPage />} />
            <Route path="dispensing/new" element={<DispensingCreatePage />} />
            <Route path="dispensing/:id" element={<DispensingDetailPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['INVENTORY_VIEW']} />}>
            <Route path="inventory" element={<StockOverviewPage />} />
            <Route path="inventory/ledger" element={<StockLedgerPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['DOCUMENT_VIEW']} />}>
            <Route path="documents" element={<DocumentRegisterPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['PRODUCT_VIEW']} />}>
            <Route path="products" element={<ProductsPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['SUPPLIER_VIEW']} />}>
            <Route path="suppliers" element={<SuppliersPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['BRANCH_VIEW']} />}>
            <Route path="branches" element={<BranchesPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['USER_VIEW']} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route element={<RequirePermission permissions={['AUDIT_VIEW']} />}>
            <Route path="audit" element={<AuditHistoryPage />} />
          </Route>

          {/* No permission gate: a user's own notifications are not a business
              record a role is granted, and the API scopes them to the caller. */}
          <Route path="notifications" element={<NotificationsPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
