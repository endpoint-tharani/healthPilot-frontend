import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import { accountingApi } from '@/api/accounting';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, TableSkeleton } from '@/components/states';
import { formatDate } from '@/utils/format';
import type { MappingHealthRow } from '@/types/accounting';

/**
 * Whether this company can actually post, before anything asks it to.
 *
 * A chart of accounts can look complete and still be unpostable: a role nobody
 * mapped, a mapping pointing at a head that carries two ledgers and no default,
 * an account somebody deactivated. None of that surfaces during setup - it
 * surfaces when a pharmacist finalises a supplier invoice and the whole
 * transaction is refused, which is both the worst moment to find out and the
 * moment least likely to reach whoever can fix it.
 *
 * So the eight roles the posting paths resolve are listed here with the account
 * each one lands on, and a role with no mapping is shown as NOT CONFIGURED rather
 * than left out. Being absent from a list of what exists is exactly how a missing
 * mapping hides.
 */

const STATUS_PRESENTATION: Record<
  MappingHealthRow['status'],
  { label: string; color: 'success' | 'error' | 'default' | 'warning' }
> = {
  PASS: { label: 'PASS', color: 'success' },
  NOT_CONFIGURED: { label: 'NOT CONFIGURED', color: 'error' },
  ERROR: { label: 'ERROR', color: 'error' },
};

/** What each role is for, in the words of the posting that uses it. */
const ROLE_PURPOSE: Record<string, string> = {
  VENDOR: 'The payables control account every supplier invoice and payment runs through',
  CUSTOMER: 'Receivables, for a dispensing sale that has not been settled at the counter',
  INVENTORY: 'Stock on hand — debited by a supplier invoice, relieved by cost of sales',
  BANK: 'Where money arrives and leaves for card, UPI and transfer settlements',
  CASH: 'The till, for cash settlements',
  SALES: 'Revenue from dispensing, excluding the tax collected on it',
  DIRECT_COST: 'Cost of goods dispensed, at the batch cost the stock ledger recorded',
  TAX: 'The reporting format’s single tax account, used when input and output are not split',
  INPUT_TAX: 'Recoverable tax on purchases, when the deployment separates it from output tax',
  OUTPUT_TAX: 'Tax collected on sales and owed to the government',
};

export function AccountingSetupPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const health = useQuery({
    queryKey: ['accounting', 'mapping-health'],
    queryFn: () => accountingApi.mappingHealth(),
  });

  const chart = useQuery({
    queryKey: ['accounting', 'chart-of-accounts'],
    queryFn: () => accountingApi.chartOfAccounts(),
  });

  const initialize = useMutation({
    mutationFn: () => accountingApi.initialize(),
    onSuccess: (result) => {
      toast.success(
        result.alreadyInitialized
          ? 'Accounting was already initialised; nothing was duplicated'
          : `Chart of accounts created from ${result.templateKey}`
      );
      void queryClient.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (error) => toast.fromError(error, 'Could not initialise accounting'),
  });

  const initialized = health.data?.initialized ?? false;
  // Initialisation writes the chart of accounts and its mappings, so it belongs
  // with the permission that maintains them rather than the one that posts.
  const canManage = can('ACCOUNTING_MANAGE');

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Accounting Setup"
        subtitle="Whether this company's books are ready to receive postings, role by role."
        actions={
          initialized ? (
            <Chip
              size="small"
              color="success"
              icon={<CheckCircleOutlineIcon fontSize="small" />}
              label="Accounting Initialized"
              sx={{ fontWeight: 600 }}
            />
          ) : canManage ? (
            <Button
              variant="contained"
              startIcon={<PlayArrowOutlinedIcon />}
              onClick={() => initialize.mutate()}
              disabled={initialize.isPending}
            >
              {initialize.isPending ? 'Initialising…' : 'Initialize Accounting'}
            </Button>
          ) : null
        }
      />

      {health.data && !initialized ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Accounting has not been initialised</AlertTitle>
          This company has no chart of accounts, so business documents are being recorded with
          their accounting left pending. Initialising creates the Ind AS reporting hierarchy, the
          ledger accounts and the default mappings. It is safe to run more than once — nothing is
          duplicated.
        </Alert>
      ) : null}

      {health.data && initialized ? (
        health.data.postable ? (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
            <AlertTitle>Every posting role resolves</AlertTitle>
            All {health.data.rows.filter((r) => r.required).length} required roles map to an active
            account, so supplier invoices, payments and dispensing sales will book.
          </Alert>
        ) : (
          <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 2 }}>
            <AlertTitle>
              {health.data.failing} required {health.data.failing === 1 ? 'role does' : 'roles do'}{' '}
              not resolve
            </AlertTitle>
            Any business document that needs one of these will be refused when it is finalised —
            the document and its accounting are written in the same transaction, so neither is left
            behind. Fix the mapping below and the workflow resumes.
          </Alert>
        )
      ) : null}

      {chart.data?.templateKey ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip
            size="small"
            color="primary"
            label={`${chart.data.templateKey} ${chart.data.templateVersion ?? ''}`.trim()}
          />
          {chart.data.initializedAt ? (
            <Chip
              size="small"
              variant="outlined"
              label={`Initialised ${formatDate(chart.data.initializedAt)}`}
            />
          ) : null}
          <Chip size="small" variant="outlined" label={`${chart.data.counts.ledgers} ledgers`} />
          <Chip size="small" variant="outlined" label={`${chart.data.counts.mappings} mappings`} />
        </Stack>
      ) : null}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2.25, py: 1.5 }}>
          <Typography variant="subtitle2">Mapping health</Typography>
          <Typography variant="caption" color="text.secondary">
            Each posting role, the account it resolves to, and whether it can be posted to right now
          </Typography>
        </Box>

        {health.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorState error={health.error} onRetry={() => void health.refetch()} />
          </Box>
        ) : health.isLoading ? (
          <Box sx={{ p: 2 }}>
            <TableSkeleton columns={5} rows={8} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Code</TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Used for</TableCell>
                  <TableCell align="right">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(health.data?.rows ?? []).map((row) => {
                  const presentation = STATUS_PRESENTATION[row.status];
                  return (
                    <TableRow key={row.mappingType} hover>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography variant="body2" fontWeight={700}>
                            {row.mappingType}
                          </Typography>
                          {!row.required ? (
                            <Chip size="small" variant="outlined" label="optional" />
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {row.resolved ? (
                          <Typography variant="body2">{row.resolved.ledgerName}</Typography>
                        ) : (
                          <Typography variant="body2" color="error.main" fontWeight={600}>
                            {row.required ? 'Not configured' : 'Falls back to TAX'}
                          </Typography>
                        )}
                        {row.error ? (
                          <Typography variant="caption" color="error.main" display="block">
                            {row.error}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
                        >
                          {row.resolved?.ledgerCode ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        <Typography variant="caption" color="text.secondary">
                          {ROLE_PURPOSE[row.mappingType] ?? ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          color={row.required ? presentation.color : 'default'}
                          variant={row.status === 'PASS' ? 'filled' : 'outlined'}
                          label={
                            row.status === 'NOT_CONFIGURED' && !row.required
                              ? 'NOT SPLIT'
                              : presentation.label
                          }
                          sx={{ fontWeight: 700, letterSpacing: 0.3 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </>
  );
}
