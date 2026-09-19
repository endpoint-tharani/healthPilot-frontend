import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentApi, supplierInvoiceApi } from '@/api/endpoints';
import { useBranches, useSuppliers } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatMoney, money, sumDecimals } from '@/utils/decimal';
import { PAYMENT_METHODS, formatDate, humanise, todayInput } from '@/utils/format';
import type { PaymentMethod } from '@/types/api';

const schema = z.object({
  supplierId: z.string().uuid('Select a supplier'),
  branchId: z.string().uuid('Select the paying branch'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => dec(value).greaterThan(0), 'Amount must be greater than 0'),
  method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']),
  paymentDate: z.string().min(1, 'Payment date is required'),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  allocations: z.record(z.string(), z.string()),
});

type FormValues = z.infer<typeof schema>;

export function PaymentCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetInvoiceId = searchParams.get('invoiceId') ?? '';

  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: branches } = useBranches();

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierId: '',
      branchId: '',
      amount: '',
      method: 'BANK_TRANSFER',
      paymentDate: todayInput(),
      reference: '',
      notes: '',
      allocations: {},
    },
  });

  const supplierId = watch('supplierId');
  const allocations = watch('allocations');
  const amount = watch('amount');

  const presetInvoice = useQuery({
    queryKey: ['supplier-invoices', presetInvoiceId],
    queryFn: () => supplierInvoiceApi.get(presetInvoiceId),
    enabled: Boolean(presetInvoiceId),
  });

  // Arriving from an invoice: preselect its supplier, branch and allocatable amount.
  useEffect(() => {
    const invoice = presetInvoice.data;
    if (!invoice) {
      return;
    }
    if (invoice.supplierId) {
      setValue('supplierId', invoice.supplierId);
    }
    if (invoice.branchId) {
      setValue('branchId', invoice.branchId);
    }
    setValue('amount', invoice.financials.allocatableAmount);
    setValue('allocations', { [invoice.id]: invoice.financials.allocatableAmount });
  }, [presetInvoice.data, setValue]);

  const openInvoices = useQuery({
    queryKey: ['supplier-invoices', 'payable-options', supplierId],
    queryFn: () =>
      supplierInvoiceApi.list({ supplierId, status: 'POSTED,DISCREPANT', limit: 50 }),
    select: (result) => result.data,
    enabled: Boolean(supplierId),
  });

  // The allocatable amount is a backend calculation, so each candidate invoice is
  // read in full rather than inferred from the list row.
  const invoiceDetails = useQueries({
    queries: (openInvoices.data ?? []).map((invoice) => ({
      queryKey: ['supplier-invoices', invoice.id],
      queryFn: () => supplierInvoiceApi.get(invoice.id),
      retry: false,
    })),
  });

  const payableInvoices = invoiceDetails
    .map((result) => result.data)
    .filter(
      (invoice): invoice is NonNullable<typeof invoice> =>
        Boolean(invoice) && dec(invoice!.financials.allocatableAmount).greaterThan(0)
    );

  const allocatedTotal = useMemo(
    () => money(sumDecimals(Object.values(allocations ?? {}))),
    [allocations]
  );
  const unallocated = money(dec(amount || '0').minus(allocatedTotal));

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const allocationEntries = Object.entries(values.allocations ?? {})
        .filter(([, value]) => dec(value).greaterThan(0))
        .map(([documentId, value]) => ({ documentId, amount: value }));

      return paymentApi.create({
        supplierId: values.supplierId,
        branchId: values.branchId,
        amount: values.amount,
        method: values.method as PaymentMethod,
        paymentDate: new Date(values.paymentDate).toISOString(),
        ...(values.reference ? { reference: values.reference } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        ...(allocationEntries.length > 0 ? { allocations: allocationEntries } : {}),
      });
    },
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Payment ${payment.paymentNumber} recorded`);
      navigate(`/payments/${payment.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to record this payment'),
  });

  if (suppliersLoading) {
    return <LoadingState label="Loading suppliers…" />;
  }

  const toggleAllocation = (invoiceId: string, allocatable: string, checked: boolean) => {
    const next = { ...(allocations ?? {}) };
    if (checked) {
      next[invoiceId] = allocatable;
    } else {
      delete next[invoiceId];
    }
    setValue('allocations', next, { shouldValidate: false });
  };

  const setAllocationAmount = (invoiceId: string, value: string) => {
    setValue('allocations', { ...(allocations ?? {}), [invoiceId]: value }, { shouldValidate: false });
  };

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Payment"
        subtitle="Record a supplier payment and allocate it against open invoices"
        actions={
          <>
            <Button size="small" onClick={() => navigate('/payments')}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Record payment'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Payment details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <SelectInput
              control={control}
              name="supplierId"
              label="Supplier"
              required
              placeholder="Select a supplier"
              options={(suppliers ?? []).map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <SelectInput
              control={control}
              name="branchId"
              label="Paying branch"
              required
              placeholder="Select a branch"
              options={(branches ?? []).map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextInput
              control={control}
              name="amount"
              label="Amount"
              required
              inputProps={{ inputMode: 'decimal' }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <SelectInput
              control={control}
              name="method"
              label="Method"
              required
              options={PAYMENT_METHODS.map((method) => ({
                value: method,
                label: humanise(method),
              }))}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextInput
              control={control}
              name="paymentDate"
              label="Payment date"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextInput
              control={control}
              name="reference"
              label="Reference"
              placeholder="e.g. NEFT-88231"
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextInput control={control} name="notes" label="Notes" />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection
        title="Allocate to invoices"
        description="Only the undisputed, uncredited balance of an invoice can be settled"
      >
        {!supplierId ? (
          <Alert severity="info">Select a supplier to list its open invoices.</Alert>
        ) : openInvoices.isLoading || invoiceDetails.some((result) => result.isLoading) ? (
          <LoadingState label="Loading open invoices…" />
        ) : payableInvoices.length === 0 ? (
          <Alert severity="info">
            This supplier has no invoice with an allocatable balance. Disputed value must be cleared
            by a credit note before it can be paid.
          </Alert>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell sx={{ fontWeight: 600 }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Invoice total
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Credited
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Allocatable
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, width: 160 }}>
                    Allocate
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payableInvoices.map((invoice) => {
                  const allocatable = invoice.financials.allocatableAmount;
                  const selected = allocations?.[invoice.id] !== undefined;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selected}
                          onChange={(event) =>
                            toggleAllocation(invoice.id, allocatable, event.target.checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {invoice.documentNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {invoice.supplierRef}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(invoice.documentDate)}</TableCell>
                      <TableCell align="right">
                        {formatMoney(invoice.financials.invoiceTotal)}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(invoice.financials.creditedAmount)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatMoney(allocatable)}
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          disabled={!selected}
                          value={allocations?.[invoice.id] ?? ''}
                          onChange={(event) =>
                            setAllocationAmount(invoice.id, event.target.value)
                          }
                          inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="flex-end">
              <Box sx={{ minWidth: 260 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Payment amount
                  </Typography>
                  <Typography variant="body2">{formatMoney(amount || '0')}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Allocated
                  </Typography>
                  <Typography variant="body2">{formatMoney(allocatedTotal)}</Typography>
                </Stack>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle2">Unallocated</Typography>
                  <Typography
                    variant="subtitle2"
                    color={unallocated.isNegative() ? 'error.main' : 'text.primary'}
                  >
                    {formatMoney(unallocated)}
                  </Typography>
                </Stack>
                {unallocated.isNegative() ? (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    Allocations exceed the payment amount.
                  </Alert>
                ) : null}
              </Box>
            </Stack>
          </>
        )}
      </FormSection>
    </form>
  );
}
