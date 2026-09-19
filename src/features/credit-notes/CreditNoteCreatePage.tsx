import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { creditNoteApi, supplierInvoiceApi } from '@/api/endpoints';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { KeyValue } from '@/components/KeyValue';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatMoney, money, sumDecimals } from '@/utils/decimal';

const schema = z.object({
  supplierInvoiceId: z.string().uuid('Select the invoice being credited'),
  supplierRef: z.string().max(100).optional(),
  reason: z.string().trim().min(3, 'A credit reason of at least 3 characters is required'),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        productName: z.string(),
        quantity: z
          .string()
          .min(1, 'Quantity is required')
          .refine((value) => dec(value).greaterThan(0), 'Quantity must be greater than 0'),
        unitPrice: z.string().optional(),
        taxRate: z.string().optional(),
      })
    )
    .min(1, 'Select an invoice to load its lines'),
});

type FormValues = z.infer<typeof schema>;

export function CreditNoteCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetInvoiceId = searchParams.get('supplierInvoiceId') ?? '';

  const invoices = useQuery({
    queryKey: ['supplier-invoices', 'creditable-options'],
    queryFn: () => supplierInvoiceApi.list({ status: 'DISCREPANT,POSTED', limit: 100 }),
    select: (result) => result.data,
  });

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplierInvoiceId: presetInvoiceId,
      supplierRef: '',
      reason: '',
      lines: [],
    },
  });

  const { fields, replace } = useFieldArray({ control, name: 'lines' });
  const supplierInvoiceId = watch('supplierInvoiceId');
  const lines = watch('lines');

  const invoiceDetail = useQuery({
    queryKey: ['supplier-invoices', supplierInvoiceId],
    queryFn: () => supplierInvoiceApi.get(supplierInvoiceId),
    enabled: Boolean(supplierInvoiceId),
  });

  /**
   * Each invoice line already carries the accepted quantity the backend derived,
   * so the credit defaults to exactly the quantity that was not accepted -
   * the damaged and missing units.
   */
  useEffect(() => {
    const detail = invoiceDetail.data;
    if (!detail) {
      return;
    }
    replace(
      detail.lineItems.map((line) => {
        const notAccepted = dec(line.quantity).minus(dec(line.acceptedQuantity));
        return {
          productId: line.product.id,
          productName: `${line.product?.name ?? ''} (${line.product?.code ?? ''})`,
          quantity: notAccepted.greaterThan(0) ? notAccepted.toFixed(2) : '0',
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
        };
      })
    );
  }, [invoiceDetail.data, replace]);

  // Not memoised (see RequirementCreatePage): `watch` hands back a reference into
  // react-hook-form's internal form values and those are mutated in place, so a `[lines]`
  // dependency stays referentially equal as the user edits. A memo would only refresh when
  // the array itself is replaced - i.e. when a line is added or removed.
  const creditTotal = money(
    sumDecimals(
      (lines ?? []).map((line) => {
        const subtotal = money(dec(line.quantity || '0').times(dec(line.unitPrice || '0')));
        const tax = money(subtotal.times(dec(line.taxRate || '0')).dividedBy(100));
        return money(subtotal.plus(tax));
      })
    )
  );

  const financials = invoiceDetail.data?.financials;
  const eligible = financials
    ? dec(financials.disputedAmount).minus(dec(financials.creditedAmount))
    : dec(0);
  const exceedsEligible = creditTotal.greaterThan(eligible);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      creditNoteApi.create({
        supplierInvoiceId: values.supplierInvoiceId,
        ...(values.supplierRef ? { supplierRef: values.supplierRef } : {}),
        reason: values.reason,
        lines: values.lines
          .filter((line) => dec(line.quantity).greaterThan(0))
          .map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            ...(line.unitPrice ? { unitPrice: line.unitPrice } : {}),
            ...(line.taxRate ? { taxRate: line.taxRate } : {}),
          })),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Credit note ${document.documentNumber} posted`);
      navigate(`/credit-notes/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to post this credit note'),
  });

  if (invoices.isLoading) {
    return <LoadingState label="Loading supplier invoices…" />;
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Credit Note"
        subtitle="Clears disputed invoice value for damaged and missing goods. A credit note is not a payment."
        actions={
          <>
            <Button size="small" onClick={() => navigate('/credit-notes')}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              variant="contained"
              color="warning"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Post credit note'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Credit note details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <SelectInput
              control={control}
              name="supplierInvoiceId"
              label="Supplier invoice"
              required
              placeholder="Select an invoice"
              options={(invoices.data ?? []).map((invoice) => ({
                value: invoice.id,
                label: `${invoice.documentNumber} • ${invoice.supplier?.name ?? ''} • disputed ${formatMoney(invoice.disputedAmount)}`,
              }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="supplierRef"
              label="Supplier credit note number"
              placeholder="Defaults to the invoice reference"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextInput
              control={control}
              name="reason"
              label="Reason"
              required
              placeholder="e.g. 20 vials damaged in transit, 10 vials short-shipped"
            />
          </Grid>
        </Grid>
      </FormSection>

      {financials ? (
        <FormSection title="Invoice position" description="Calculated by the backend">
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <KeyValue label="Invoice total" value={formatMoney(financials.invoiceTotal)} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KeyValue label="Accepted payable" value={formatMoney(financials.acceptedPayable)} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KeyValue label="Disputed" value={formatMoney(financials.disputedAmount)} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KeyValue label="Eligible for credit" value={formatMoney(eligible)} emphasis />
            </Grid>
          </Grid>
        </FormSection>
      ) : null}

      {fields.length === 0 ? (
        <Alert severity="info">Select a supplier invoice to load its lines.</Alert>
      ) : (
        <FormSection
          title="Credited lines"
          description="Defaults to the quantity billed but not accepted (damaged plus missing)"
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 220 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 150 }}>Credited quantity</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }}>Unit price</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 110 }}>Tax %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>{field.productName}</TableCell>
                  <TableCell>
                    <TextInput
                      control={control}
                      name={`lines.${index}.quantity`}
                      label=""
                      ariaLabel={`Quantity, line ${index + 1}`}
                      inputProps={{ inputMode: 'decimal' }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      control={control}
                      name={`lines.${index}.unitPrice`}
                      label=""
                      ariaLabel={`Unit price, line ${index + 1}`}
                      inputProps={{ inputMode: 'decimal' }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      control={control}
                      name={`lines.${index}.taxRate`}
                      label=""
                      ariaLabel={`Tax rate, line ${index + 1}`}
                      inputProps={{ inputMode: 'decimal' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="flex-end">
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Credit total
              </Typography>
              <Typography variant="h6">{formatMoney(creditTotal)}</Typography>
              {exceedsEligible ? (
                <Alert severity="error" sx={{ mt: 1 }}>
                  The credit exceeds the eligible disputed amount of {formatMoney(eligible)} and
                  will be rejected by the backend.
                </Alert>
              ) : null}
            </Box>
          </Stack>
        </FormSection>
      )}
    </form>
  );
}
