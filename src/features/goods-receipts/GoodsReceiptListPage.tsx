import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { goodsReceiptApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  branchColumn,
  createdByColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  supplierColumn,
  totalColumn,
} from '@/features/documents/documentColumns';

export function GoodsReceiptListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Goods Receipts"
      subtitle="Supplier deliveries received against approved purchase orders"
      queryKey="goods-receipts"
      fetcher={goodsReceiptApi.list}
      basePath="/goods-receipts"
      statuses={['DRAFT', 'POSTED', 'CORRECTED', 'CANCELLED']}
      emptyDescription="Receive goods against an approved purchase order to create a receipt."
      actions={
        can('GOODS_RECEIPT_CREATE') ? (
          <Button
            component={RouterLink}
            to="/goods-receipts/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Goods Receipt
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        {
          key: 'supplierRef',
          header: 'Supplier document',
          render: (row) => row.supplierRef ?? '—',
        },
        supplierColumn,
        { ...branchColumn, header: 'Receiving branch' },
        statusColumn,
        dateColumn,
        totalColumn,
        createdByColumn,
      ]}
    />
  );
}
