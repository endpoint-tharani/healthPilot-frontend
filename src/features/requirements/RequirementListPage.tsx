import { Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';
import { requirementApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { DocumentListPage } from '@/features/documents/DocumentListPage';
import {
  branchColumn,
  createdByColumn,
  expectedDateColumn,
  numberColumn,
  statusColumn,
  totalColumn,
} from '@/features/documents/documentColumns';

export function RequirementListPage() {
  const { can } = useAuth();

  return (
    <DocumentListPage
      title="Stock Requirements"
      subtitle="Branch demand raised against central procurement"
      queryKey="stock-requirements"
      fetcher={requirementApi.list}
      basePath="/requirements"
      statuses={[
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'PARTIALLY_FULFILLED',
        'FULFILLED',
        'CANCELLED',
      ]}
      emptyDescription="Raise a requirement to start the procurement cycle."
      actions={
        can('STOCK_REQUIREMENT_CREATE') ? (
          <Button
            component={RouterLink}
            to="/requirements/new"
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
          >
            New Requirement
          </Button>
        ) : null
      }
      columns={[
        numberColumn,
        branchColumn,
        statusColumn,
        {
          key: 'lines',
          header: 'Items',
          align: 'right',
          render: (row) => (
            <Typography variant="body2">
              {row._count?.lineItems ?? '—'}
              {row._count?.lineItems ? ' line(s)' : ''}
            </Typography>
          ),
          hideOnSmall: true,
        },
        expectedDateColumn('Required by'),
        { ...totalColumn, header: 'Indicative value', hideOnSmall: true },
        createdByColumn,
      ]}
    />
  );
}
