import type {
  AppNotification,
  Branch,
  BranchScopeType,
  BranchType,
  CompanyUser,
  CurrentUser,
  DocumentDetail,
  DocumentHistoryResponse,
  DocumentStatus,
  DocumentSummary,
  DocumentType,
  InventoryTransactionType,
  LedgerRow,
  LoginResponse,
  NotificationPage,
  NotificationPageMeta,
  NotificationType,
  Paginated,
  Payment,
  PaymentMethod,
  Product,
  ProductDetail,
  RequirementAvailability,
  RequirementSourcingAnalysis,
  SignupRequest,
  SignupResponse,
  StockRow,
  StockStatus,
  Supplier,
  SupplierInvoiceDetail,
  UserRole,
} from '@/types/api';
import { apiGet, apiGetList, apiPatch, apiPost, apiPut, cleanParams } from './client';

/* ---------------------------------------------------------------- auth ---- */

export const authApi = {
  /** Creates the company, its branches and the founding admin, and signs that admin in. */
  signup: (body: SignupRequest) =>
    apiPost<SignupResponse>('/auth/signup', body, { skipAuthRefresh: true }),
  login: (email: string, password: string) =>
    apiPost<LoginResponse>('/auth/login', { email, password }, { skipAuthRefresh: true }),
  me: () => apiGet<CurrentUser>('/auth/me'),
  logout: (refreshToken: string) =>
    apiPost<{ loggedOut: boolean }>('/auth/logout', { refreshToken }, { skipAuthRefresh: true }),
  logoutAll: () => apiPost<{ loggedOut: boolean }>('/auth/logout-all'),
};

/* ------------------------------------------------------- shared queries ---- */

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentListQuery extends ListQuery {
  status?: string;
  branchId?: string;
  supplierId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DocumentRegisterQuery extends DocumentListQuery {
  documentType?: DocumentType;
}

/* ------------------------------------------------------------- masters ---- */

export interface BranchInput {
  code: string;
  name: string;
  type: BranchType;
  address?: string;
  isActive?: boolean;
}

export const branchApi = {
  /** `scope: 'company'` lists every branch in the company, for transfer destinations. */
  list: (
    query: ListQuery & { type?: BranchType; isActive?: boolean; scope?: 'scope' | 'company' } = {}
  ) => apiGetList<Branch>('/branches', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<Branch>(`/branches/${id}`),
  create: (body: BranchInput) => apiPost<Branch>('/branches', body),
  update: (id: string, body: Partial<BranchInput>) => apiPut<Branch>(`/branches/${id}`, body),
};

export interface ProductInput {
  code: string;
  name: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  taxRate: string;
  trackInventory?: boolean;
  isActive?: boolean;
  minTemp?: string | null;
  maxTemp?: string | null;
}

export const productApi = {
  list: (query: ListQuery & { isActive?: boolean } = {}) =>
    apiGetList<Product>('/products', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<ProductDetail>(`/products/${id}`),
  create: (body: ProductInput) => apiPost<Product>('/products', body),
  update: (id: string, body: Partial<ProductInput>) => apiPut<Product>(`/products/${id}`, body),
};

export interface SupplierInput {
  code: string;
  name: string;
  contactInfo?: string;
  address?: string;
  isActive?: boolean;
}

export const supplierApi = {
  list: (query: ListQuery & { isActive?: boolean } = {}) =>
    apiGetList<Supplier>('/suppliers', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<Supplier>(`/suppliers/${id}`),
  create: (body: SupplierInput) => apiPost<Supplier>('/suppliers', body),
  update: (id: string, body: Partial<SupplierInput>) => apiPut<Supplier>(`/suppliers/${id}`, body),
};

export interface UserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  branchScope: BranchScopeType;
  branchId?: string | null;
  branchIds?: string[];
  isActive?: boolean;
}

export const userApi = {
  list: (query: ListQuery & { role?: UserRole; isActive?: boolean; branchId?: string } = {}) =>
    apiGetList<CompanyUser>('/users', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<CompanyUser>(`/users/${id}`),
  create: (body: UserInput) => apiPost<CompanyUser>('/users', body),
  update: (id: string, body: Partial<Omit<UserInput, 'email'>>) =>
    apiPut<CompanyUser>(`/users/${id}`, body),
};

/* --------------------------------------------------- stock requirements ---- */

export interface RequirementInput {
  branchId: string;
  requiredDate: string;
  reason: string;
  lines: { productId: string; quantity: string; notes?: string }[];
}

export const requirementApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/stock-requirements', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/stock-requirements/${id}`),
  create: (body: RequirementInput) => apiPost<DocumentDetail>('/stock-requirements', body),
  submit: (id: string, reason?: string) =>
    apiPost<DocumentDetail>(`/stock-requirements/${id}/submit`, cleanParams({ reason })),
  approve: (id: string, reason?: string) =>
    apiPost<DocumentDetail>(`/stock-requirements/${id}/approve`, cleanParams({ reason })),
  reject: (id: string, reason: string) =>
    apiPost<DocumentDetail>(`/stock-requirements/${id}/reject`, { reason }),
  /** Read-only sourcing view: reserves nothing and moves no stock. */
  internalAvailability: (id: string) =>
    apiGet<RequirementAvailability>(`/stock-requirements/${id}/internal-availability`),
  /**
   * The full sourcing picture - internal stock by branch, plus supplier options
   * for the shortfall. A superset of internalAvailability, kept separate because
   * the cheap one is on every requirement page and this one is not.
   */
  sourcingAnalysis: (id: string) =>
    apiGet<RequirementSourcingAnalysis>(`/stock-requirements/${id}/sourcing-analysis`),
};

/* ----------------------------------------------------- purchase orders ---- */

export interface PurchaseOrderInput {
  requirementId: string;
  supplierId: string;
  deliveryBranchId: string;
  expectedDeliveryDate: string;
  notes?: string;
  lines: { productId: string; quantity: string; unitPrice?: string; taxRate?: string }[];
}

export const purchaseOrderApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/purchase-orders', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/purchase-orders/${id}`),
  create: (body: PurchaseOrderInput) => apiPost<DocumentDetail>('/purchase-orders', body),
  approve: (id: string, reason?: string) =>
    apiPost<DocumentDetail>(`/purchase-orders/${id}/approve`, cleanParams({ reason })),
  cancel: (id: string, reason: string) =>
    apiPost<DocumentDetail>(`/purchase-orders/${id}/cancel`, { reason }),
};

/* ------------------------------------------------------- goods receipts ---- */

export interface GoodsReceiptLineInput {
  purchaseOrderLineItemId: string;
  quantity: string;
  acceptedQuantity: string;
  damagedQuantity: string;
  missingQuantity: string;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface GoodsReceiptInput {
  purchaseOrderId: string;
  supplierRef: string;
  receiptDate?: string;
  notes?: string;
  lines: GoodsReceiptLineInput[];
}

export const goodsReceiptApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/goods-receipts', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/goods-receipts/${id}`),
  create: (body: GoodsReceiptInput) => apiPost<DocumentDetail>('/goods-receipts', body),
  post: (id: string, reason?: string) =>
    apiPost<DocumentDetail>(`/goods-receipts/${id}/post`, cleanParams({ reason })),
};

/* --------------------------------------------------- receipt corrections ---- */

export interface CorrectionInput {
  goodsReceiptId: string;
  reason: string;
  lines: {
    goodsReceiptLineItemId: string;
    correctedAcceptedQuantity: string;
    correctedDamagedQuantity: string;
    correctedMissingQuantity: string;
  }[];
}

export const correctionApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/receipt-corrections', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/receipt-corrections/${id}`),
  create: (body: CorrectionInput) => apiPost<DocumentDetail>('/receipt-corrections', body),
};

/* ----------------------------------------------------- supplier invoices ---- */

export interface SupplierInvoiceInput {
  purchaseOrderId: string;
  supplierRef: string;
  invoiceDate?: string;
  dueDate?: string;
  notes?: string;
  lines: { productId: string; quantity: string; unitPrice?: string; taxRate?: string }[];
}

export const supplierInvoiceApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/supplier-invoices', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<SupplierInvoiceDetail>(`/supplier-invoices/${id}`),
  create: (body: SupplierInvoiceInput) =>
    apiPost<SupplierInvoiceDetail>('/supplier-invoices', body),
};

/* ---------------------------------------------------------- credit notes ---- */

export interface CreditNoteInput {
  supplierInvoiceId: string;
  supplierRef?: string;
  reason: string;
  lines: { productId: string; quantity: string; unitPrice?: string; taxRate?: string }[];
}

export const creditNoteApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/credit-notes', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/credit-notes/${id}`),
  create: (body: CreditNoteInput) => apiPost<DocumentDetail>('/credit-notes', body),
};

/* --------------------------------------------------------------- payments ---- */

export interface PaymentAllocationInput {
  documentId: string;
  amount: string;
}

export interface PaymentInput {
  supplierId: string;
  branchId: string;
  amount: string;
  method: PaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
  allocations?: PaymentAllocationInput[];
}

export const paymentApi = {
  list: (
    query: ListQuery & {
      supplierId?: string;
      branchId?: string;
      method?: PaymentMethod;
      fromDate?: string;
      toDate?: string;
    } = {}
  ) => apiGetList<Payment>('/payments', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<Payment>(`/payments/${id}`),
  create: (body: PaymentInput) => apiPost<Payment>('/payments', body),
  allocate: (id: string, allocations: PaymentAllocationInput[]) =>
    apiPost<Payment>(`/payments/${id}/allocate`, { allocations }),
};

/* -------------------------------------------------------- stock transfers ---- */

export interface StockTransferInput {
  sourceBranchId: string;
  destinationBranchId: string;
  expectedDate?: string;
  notes?: string;
  /** Links the transfer to the requirement it helps fulfil, when raised from one. */
  requirementId?: string;
  lines: { productId: string; batchId: string; quantity: string }[];
}

export const stockTransferApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/stock-transfers', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/stock-transfers/${id}`),
  create: (body: StockTransferInput) => apiPost<DocumentDetail>('/stock-transfers', body),
  dispatch: (id: string, reason?: string) =>
    apiPost<DocumentDetail>(`/stock-transfers/${id}/dispatch`, cleanParams({ reason })),
  receive: (id: string, reason?: string) =>
    apiPost<DocumentDetail>(`/stock-transfers/${id}/receive`, cleanParams({ reason })),
};

/* ------------------------------------------------------------- dispensing ---- */

export interface DispensingInput {
  branchId: string;
  patientRef: string;
  prescriptionRef: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  lines: { productId: string; batchId: string; quantity: string; unitPrice?: string }[];
}

export const dispensingApi = {
  list: (query: DocumentListQuery = {}) =>
    apiGetList<DocumentSummary>('/dispensing', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/dispensing/${id}`),
  create: (body: DispensingInput) => apiPost<DocumentDetail>('/dispensing', body),
};

/* -------------------------------------------------------------- inventory ---- */

export interface StockQuery {
  branchId?: string;
  productId?: string;
  batchId?: string;
  stockStatus?: StockStatus;
}

export interface LedgerQuery extends StockQuery, ListQuery {
  transactionType?: InventoryTransactionType;
  fromDate?: string;
  toDate?: string;
}

export const inventoryApi = {
  stock: (query: StockQuery = {}) =>
    apiGet<StockRow[]>('/inventory', { params: cleanParams({ ...query }) }),
  ledger: (query: LedgerQuery = {}) =>
    apiGetList<LedgerRow>('/inventory/ledger', { params: cleanParams({ ...query }) }),
};

/* -------------------------------------------------------------- documents ---- */

export const documentApi = {
  list: (query: DocumentRegisterQuery = {}) =>
    apiGetList<DocumentSummary>('/documents', { params: cleanParams({ ...query }) }),
  get: (id: string) => apiGet<DocumentDetail>(`/documents/${id}`),
  history: (id: string) => apiGet<DocumentHistoryResponse>(`/documents/${id}/history`),
};

/* ---------------------------------------------------------- notifications ---- */

export interface NotificationListQuery extends ListQuery {
  unreadOnly?: boolean;
  type?: NotificationType;
  fromDate?: string;
  toDate?: string;
}

/**
 * The recipient is never a parameter. Every one of these calls resolves to the
 * authenticated user on the server, which is what makes another user's inbox
 * unreachable rather than merely un-requested.
 */
export const notificationApi = {
  list: async (query: NotificationListQuery = {}): Promise<NotificationPage> => {
    const response = await apiGetList<AppNotification>('/notifications', {
      params: cleanParams({ ...query }),
    });
    return { data: response.data, meta: response.meta as NotificationPageMeta };
  },
  unreadCount: () => apiGet<{ unread: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    apiPatch<{ notification: AppNotification; unread: number }>(`/notifications/${id}/read`),
  markAllRead: () =>
    apiPatch<{ updated: number; unread: number }>('/notifications/read-all'),
};

/** Convenience for dashboard tiles: only the total matters, so one row is fetched. */
export async function countDocuments(
  documentType: DocumentType,
  statuses: DocumentStatus[]
): Promise<number> {
  const result: Paginated<DocumentSummary> = await documentApi.list({
    documentType,
    status: statuses.join(','),
    limit: 1,
  });
  return result.meta.total;
}
