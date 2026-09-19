import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { stockTransferApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { formatMoney } from '@/utils/decimal';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  createdByColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  transferBranchesColumn,
} from '@/features/documents/documentColumns';

export function TransferListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Stock Transfers"
      subtitle="Usable stock moved between branches: dispatch takes it out, receipt brings it in"
      queryKey="stock-transfers"
      fetcher={stockTransferApi.list}
      basePath="/stock-transfers"
      statuses={['DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED']}
      emptyDescription="Create a transfer to move usable stock from the central warehouse to a branch."
      actions={
        can('STOCK_TRANSFER_CREATE') ? (
          <Button
            component={RouterLink}
            to="/stock-transfers/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Stock Transfer
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        transferBranchesColumn,
        statusColumn,
        {
          key: 'lines',
          header: 'Lines',
          align: 'right',
          render: (row) => row._count?.lineItems ?? '—',
          hideOnSmall: true,
        },
        {
          key: 'value',
          header: 'Stock value',
          align: 'right',
          render: (row) => formatMoney(row.totalAmount),
          hideOnSmall: true,
        },
        dateColumn,
        createdByColumn,
      ]}
    />
  );
}
