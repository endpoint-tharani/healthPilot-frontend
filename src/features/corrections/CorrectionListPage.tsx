import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { correctionApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  branchColumn,
  createdByColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  supplierColumn,
} from '@/features/documents/documentColumns';

export function CorrectionListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Receipt Corrections"
      subtitle="Audited corrections to posted goods receipts - the original receipt is never edited"
      queryKey="receipt-corrections"
      fetcher={correctionApi.list}
      basePath="/receipt-corrections"
      statuses={['POSTED']}
      emptyDescription="Corrections appear here once a posted receipt has been corrected."
      actions={
        can('RECEIPT_CORRECTION_CREATE') ? (
          <Button
            component={RouterLink}
            to="/receipt-corrections/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Correction
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        { key: 'reason', header: 'Reason', render: (row) => row.notes ?? '—' },
        supplierColumn,
        branchColumn,
        statusColumn,
        dateColumn,
        createdByColumn,
      ]}
    />
  );
}
