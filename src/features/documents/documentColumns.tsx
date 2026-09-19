import { Link as MuiLink, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { DocumentSummary } from '@/types/api';
import type { Column } from '@/components/DataTable';
import { DocumentStatusChip, DocumentTypeChip } from '@/components/StatusChip';
import { formatMoney } from '@/utils/decimal';
import { documentPath, formatDate, formatDateTime } from '@/utils/format';

/**
 * The document number is the row's identity, so it is a real link: the row click
 * is a convenience, but the number can also be opened in a new tab or copied.
 */
export const numberColumn: Column<DocumentSummary> = {
  key: 'documentNumber',
  header: 'Document',
  render: (row) => (
    <MuiLink
      component={RouterLink}
      to={documentPath(row.documentType, row.id)}
      variant="body2"
      fontWeight={700}
      onClick={(event) => event.stopPropagation()}
    >
      {row.documentNumber}
    </MuiLink>
  ),
};

export const typeColumn: Column<DocumentSummary> = {
  key: 'documentType',
  header: 'Type',
  render: (row) => <DocumentTypeChip documentType={row.documentType} />,
};

export const statusColumn: Column<DocumentSummary> = {
  key: 'status',
  header: 'Status',
  render: (row) => <DocumentStatusChip status={row.status} />,
};

export const branchColumn: Column<DocumentSummary> = {
  key: 'branch',
  header: 'Branch',
  render: (row) => row.branch?.name ?? '—',
};

export const supplierColumn: Column<DocumentSummary> = {
  key: 'supplier',
  header: 'Supplier',
  render: (row) => row.supplier?.name ?? '—',
  hideOnSmall: true,
};

export const dateColumn: Column<DocumentSummary> = {
  key: 'documentDate',
  header: 'Date',
  render: (row) => formatDate(row.documentDate),
  hideOnSmall: true,
};

export const createdByColumn: Column<DocumentSummary> = {
  key: 'createdBy',
  header: 'Created by',
  render: (row) => (
    <>
      <Typography variant="body2">{row.createdBy?.name ?? '—'}</Typography>
      <Typography variant="caption" color="text.secondary">
        {formatDateTime(row.createdAt)}
      </Typography>
    </>
  ),
  hideOnSmall: true,
};

export const totalColumn: Column<DocumentSummary> = {
  key: 'totalAmount',
  numeric: true,
  header: 'Total',
  render: (row) => (
    <Typography variant="body2" fontWeight={600}>
      {formatMoney(row.totalAmount)}
    </Typography>
  ),
};

export const subtotalColumn: Column<DocumentSummary> = {
  key: 'subtotal',
  numeric: true,
  header: 'Subtotal',
  render: (row) => formatMoney(row.subtotal),
  hideOnSmall: true,
};

export const taxColumn: Column<DocumentSummary> = {
  key: 'taxAmount',
  numeric: true,
  header: 'Tax',
  render: (row) => formatMoney(row.taxAmount),
  hideOnSmall: true,
};

export const expectedDateColumn = (header: string): Column<DocumentSummary> => ({
  key: 'expectedDeliveryDate',
  header,
  render: (row) => formatDate(row.expectedDeliveryDate),
  hideOnSmall: true,
});

export const transferBranchesColumn: Column<DocumentSummary> = {
  key: 'transferBranches',
  header: 'Route',
  render: (row) => (
    <Typography variant="body2">
      {row.sourceBranch?.name ?? '—'} → {row.destinationBranch?.name ?? '—'}
    </Typography>
  ),
};
