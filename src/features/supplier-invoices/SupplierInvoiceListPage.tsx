import { Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { supplierInvoiceApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { formatMoney } from '@/utils/decimal';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  branchColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  supplierColumn,
  totalColumn,
} from '@/features/documents/documentColumns';

export function SupplierInvoiceListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Supplier Invoices"
      subtitle="Invoices booked at the value claimed, with the disputed portion made explicit"
      queryKey="supplier-invoices"
      fetcher={supplierInvoiceApi.list}
      basePath="/supplier-invoices"
      statuses={['POSTED', 'DISCREPANT', 'PAID', 'CANCELLED']}
      emptyDescription="Record a supplier invoice against a purchase order."
      actions={
        can('SUPPLIER_INVOICE_CREATE') ? (
          <Button
            component={RouterLink}
            to="/supplier-invoices/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Supplier Invoice
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        {
          key: 'supplierRef',
          header: 'Invoice number',
          render: (row) => row.supplierRef ?? '—',
        },
        supplierColumn,
        branchColumn,
        statusColumn,
        dateColumn,
        totalColumn,
        {
          key: 'disputedAmount',
          header: 'Disputed',
          align: 'right',
          render: (row) => (
            <Typography
              variant="body2"
              fontWeight={row.disputedAmount === '0.00' ? 400 : 700}
              color={row.disputedAmount === '0.00' ? 'text.secondary' : 'error.main'}
            >
              {formatMoney(row.disputedAmount)}
            </Typography>
          ),
        },
        {
          key: 'paidAmount',
          header: 'Paid',
          align: 'right',
          render: (row) => formatMoney(row.paidAmount),
          hideOnSmall: true,
        },
        {
          key: 'balanceAmount',
          header: 'Outstanding',
          align: 'right',
          render: (row) => (
            <Typography variant="body2" fontWeight={600}>
              {formatMoney(row.balanceAmount)}
            </Typography>
          ),
        },
      ]}
    />
  );
}
