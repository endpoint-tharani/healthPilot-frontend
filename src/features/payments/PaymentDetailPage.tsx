import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { paymentApi, supplierInvoiceApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/components/Toast';
import { DocumentHeader } from '@/components/DocumentHeader';
import { DocumentRefLink } from '@/components/DocumentChain';
import { FinancialSummary } from '@/components/FinancialSummary';
import { StatCard } from '@/components/StatCard';
import { ToneChip } from '@/components/StatusChip';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { EmptyState } from '@/components/states';
import { SubmitError } from '@/components/FormFields';
import { dec, formatMoney, money, sumDecimals } from '@/utils/decimal';
import { formatDate, formatDateTime, humanise } from '@/utils/format';

/** Allocates the unallocated remainder of an existing payment to open invoices. */
function AllocateDialog({
  paymentId,
  supplierId,
  unallocated,
  open,
  onClose,
}: {
  paymentId: string;
  supplierId: string;
  unallocated: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const openInvoices = useQuery({
    queryKey: ['supplier-invoices', 'payable-options', supplierId],
    queryFn: () => supplierInvoiceApi.list({ supplierId, status: 'POSTED,DISCREPANT', limit: 50 }),
    select: (result) => result.data,
    enabled: open && Boolean(supplierId),
  });

  const details = useQueries({
    queries: (openInvoices.data ?? []).map((invoice) => ({
      queryKey: ['supplier-invoices', invoice.id],
      queryFn: () => supplierInvoiceApi.get(invoice.id),
      retry: false,
    })),
  });

  const payable = details
    .map((result) => result.data)
    .filter(
      (invoice): invoice is NonNullable<typeof invoice> =>
        Boolean(invoice) && dec(invoice!.financials.allocatableAmount).greaterThan(0)
    );

  const allocated = money(sumDecimals(Object.values(amounts)));
  const remaining = money(dec(unallocated).minus(allocated));

  const mutation = useMutation({
    mutationFn: () =>
      paymentApi.allocate(
        paymentId,
        Object.entries(amounts)
          .filter(([, value]) => dec(value).greaterThan(0))
          .map(([documentId, amount]) => ({ documentId, amount }))
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`${formatMoney(allocated)} allocated`);
      setAmounts({});
      onClose();
    },
    onError: (error) => toast.fromError(error, 'Unable to allocate this payment'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Allocate payment</DialogTitle>
      <DialogContent>
        <SubmitError error={mutation.error} />
        {payable.length === 0 ? (
          <Alert severity="info">
            No invoice for this supplier has an allocatable balance. Disputed value needs a credit
            note before it can be settled.
          </Alert>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Invoice</TableCell>
                  <TableCell align="right">Allocatable</TableCell>
                  <TableCell align="right" sx={{ width: 160 }}>
                    Allocate
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payable.map((invoice) => {
                  const selected = amounts[invoice.id] !== undefined;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selected}
                          inputProps={{ 'aria-label': `Allocate to ${invoice.documentNumber}` }}
                          onChange={(event) => {
                            const next = { ...amounts };
                            if (event.target.checked) {
                              next[invoice.id] = invoice.financials.allocatableAmount;
                            } else {
                              delete next[invoice.id];
                            }
                            setAmounts(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {invoice.documentNumber}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {invoice.supplierRef}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(invoice.financials.allocatableAmount)}
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          disabled={!selected}
                          label="Amount"
                          value={amounts[invoice.id] ?? ''}
                          onChange={(event) =>
                            setAmounts({ ...amounts, [invoice.id]: event.target.value })
                          }
                          inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }} spacing={3}>
              <Typography variant="body2" color="text.secondary">
                Unallocated on payment: {formatMoney(unallocated)}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                Remaining after this allocation: {formatMoney(remaining)}
              </Typography>
            </Stack>
            {remaining.isNegative() ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                The allocation exceeds the unallocated balance of this payment.
              </Alert>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={mutation.isPending || Object.keys(amounts).length === 0 || remaining.isNegative()}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Allocating…' : 'Allocate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PaymentDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [allocateOpen, setAllocateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['payments', id],
    queryFn: () => paymentApi.get(id),
    enabled: Boolean(id),
  });

  const payment = query.data;
  const hasUnallocated = useMemo(
    () => (payment ? dec(payment.unallocatedAmount).greaterThan(0) : false),
    [payment]
  );
  const fullyAllocated = payment ? !hasUnallocated : false;

  return (
    <DocumentPageFrame
      backTo="/payments"
      backLabel="All payments"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {payment ? (
        <>
          <DocumentHeader
            documentTypeLabel="Payment"
            documentNumber={payment.paymentNumber}
            statusChip={
              <ToneChip
                tone={fullyAllocated ? 'success' : 'warning'}
                size="medium"
                label={fullyAllocated ? 'Fully allocated' : 'Partly allocated'}
              />
            }
            note={payment.notes}
            actions={
              can('PAYMENT_ALLOCATE') && payment.supplierId && hasUnallocated ? (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PaymentsOutlinedIcon />}
                  onClick={() => setAllocateOpen(true)}
                >
                  Allocate to invoices
                </Button>
              ) : null
            }
            facts={[
              {
                icon: <StorefrontOutlinedIcon fontSize="small" />,
                label: 'Paid to',
                value: payment.supplier?.name ?? 'Patient / counter sale',
              },
              {
                icon: <CreditCardOutlinedIcon fontSize="small" />,
                label: 'Method',
                value: humanise(payment.method),
              },
              {
                icon: <ScheduleOutlinedIcon fontSize="small" />,
                label: 'Payment date',
                value: formatDateTime(payment.paymentDate),
              },
              {
                icon: <TagOutlinedIcon fontSize="small" />,
                label: 'Reference',
                value: payment.reference ?? '—',
              },
            ]}
          />

          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Payment amount"
                value={formatMoney(payment.amount)}
                caption={payment.branch?.name ?? 'Company level'}
                icon={<PaymentsOutlinedIcon fontSize="small" />}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <StatCard
                label="Allocated"
                value={formatMoney(payment.allocatedAmount)}
                caption={`Across ${payment.allocations.length} document(s)`}
                tone="success"
                icon={<ReceiptLongOutlinedIcon fontSize="small" />}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <StatCard
                label="Unallocated"
                value={formatMoney(payment.unallocatedAmount)}
                caption={hasUnallocated ? 'Still to be applied' : 'Nothing left over'}
                tone={hasUnallocated ? 'warning' : 'success'}
                icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} alignItems="flex-start">
            <Grid item xs={12} lg={8}>
              <Paper variant="outlined">
                <Box sx={{ px: 2.25, py: 1.5 }}>
                  <Typography variant="subtitle2">Allocations</Typography>
                  <Typography variant="caption" color="text.secondary">
                    The documents this payment settles, and how much of it each one took
                  </Typography>
                </Box>
                {payment.allocations.length === 0 ? (
                  <EmptyState
                    dense
                    title="Not allocated"
                    description="This payment has not been applied to any invoice yet."
                  />
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Document</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Allocated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payment.allocations.map((allocation) => (
                        <TableRow key={allocation.id} hover>
                          <TableCell>
                            {allocation.document ? (
                              <DocumentRefLink document={allocation.document} />
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>{humanise(allocation.document?.documentType)}</TableCell>
                          <TableCell>{humanise(allocation.document?.status)}</TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatMoney(allocation.allocatedAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Paper variant="outlined" sx={{ p: 2.25 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
                  Payment summary
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Recorded {formatDate(payment.paymentDate)} by{' '}
                  {payment.createdBy?.name ?? 'the system'}
                </Typography>
                <Box sx={{ mt: 1.5 }}>
                  <FinancialSummary
                    lines={[
                      { label: 'Amount paid', value: payment.amount },
                      { label: 'Allocated to invoices', value: payment.allocatedAmount },
                      {
                        label: 'Unallocated',
                        value: payment.unallocatedAmount,
                        emphasis: true,
                        ruleAbove: true,
                      },
                    ]}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {payment.supplierId ? (
            <AllocateDialog
              paymentId={payment.id}
              supplierId={payment.supplierId}
              unallocated={payment.unallocatedAmount}
              open={allocateOpen}
              onClose={() => setAllocateOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </DocumentPageFrame>
  );
}
