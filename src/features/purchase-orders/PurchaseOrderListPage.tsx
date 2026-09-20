import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { purchaseOrderApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  branchColumn,
  createdByColumn,
  expectedDateColumn,
  numberColumn,
  statusColumn,
  subtotalColumn,
  supplierColumn,
  taxColumn,
  totalColumn,
} from '@/features/documents/documentColumns';

export function PurchaseOrderListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Purchase Orders"
      subtitle="Orders raised with suppliers against approved requisitions"
      queryKey="purchase-orders"
      fetcher={purchaseOrderApi.list}
      basePath="/purchase-orders"
      statuses={['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED']}
      emptyDescription="Approve a stock requisition first, then raise a purchase order against it."
      actions={
        can('PURCHASE_ORDER_CREATE') ? (
          <Button
            component={RouterLink}
            to="/purchase-orders/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Purchase Order
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        supplierColumn,
        { ...branchColumn, header: 'Delivery branch' },
        statusColumn,
        expectedDateColumn('Expected'),
        subtotalColumn,
        taxColumn,
        totalColumn,
        createdByColumn,
      ]}
    />
  );
}
