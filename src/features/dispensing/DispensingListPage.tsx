import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { dispensingApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { formatMoney } from '@/utils/decimal';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  branchColumn,
  createdByColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  totalColumn,
} from '@/features/documents/documentColumns';

export function DispensingListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Dispensing"
      subtitle="Medicines issued to patients, valued at selling price and paid at the counter"
      queryKey="dispensing"
      fetcher={dispensingApi.list}
      basePath="/dispensing"
      statuses={['COMPLETED', 'CANCELLED']}
      emptyDescription="Dispense medicine from branch stock to record a sale."
      actions={
        can('DISPENSING_CREATE') ? (
          <Button
            component={RouterLink}
            to="/dispensing/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Dispensing
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        branchColumn,
        { key: 'patientRef', header: 'Patient', render: (row) => row.patientRef ?? '—' },
        {
          key: 'prescriptionRef',
          header: 'Prescription',
          render: (row) => row.prescriptionRef ?? '—',
          hideOnSmall: true,
        },
        statusColumn,
        dateColumn,
        {
          key: 'tax',
          header: 'Tax',
          align: 'right',
          render: (row) => formatMoney(row.taxAmount),
          hideOnSmall: true,
        },
        totalColumn,
        createdByColumn,
      ]}
    />
  );
}
