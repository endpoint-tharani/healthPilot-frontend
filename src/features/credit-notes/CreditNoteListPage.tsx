import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { creditNoteApi } from '@/api/endpoints';
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

export function CreditNoteListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Credit Notes"
      subtitle="Financial credits that clear disputed invoice value - they never restore stock"
      queryKey="credit-notes"
      fetcher={creditNoteApi.list}
      basePath="/credit-notes"
      statuses={['POSTED', 'CANCELLED']}
      emptyDescription="Raise a credit note against a discrepant supplier invoice."
      actions={
        can('CREDIT_NOTE_CREATE') ? (
          <Button
            component={RouterLink}
            to="/credit-notes/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Credit Note
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        supplierColumn,
        { key: 'reason', header: 'Reason', render: (row) => row.notes ?? '—' },
        branchColumn,
        statusColumn,
        dateColumn,
        { ...totalColumn, header: 'Credit amount' },
        createdByColumn,
      ]}
    />
  );
}
