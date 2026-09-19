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
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { purchaseOrderApi, supplierInvoiceApi } from '@/api/endpoints';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatMoney, money, sumDecimals } from '@/utils/decimal';
import { todayInput } from '@/utils/format';

const schema = z.object({
  purchaseOrderId: z.string().uuid('Select the purchase order being invoiced'),
  supplierRef: z.string().trim().min(1, 'Supplier invoice number is required').max(100),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().optional(),
  notes: z.string().max(500).optional(),
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
    .min(1, 'Select a purchase order to load its lines'),
});

type FormValues = z.infer<typeof schema>;

export function SupplierInvoiceCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetPurchaseOrderId = searchParams.get('purchaseOrderId') ?? '';

  const orders = useQuery({
    queryKey: ['purchase-orders', 'invoiceable-options'],
    queryFn: () => purchaseOrderApi.list({ status: 'APPROVED', limit: 100 }),
    select: (result) => result.data,
  });

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      purchaseOrderId: presetPurchaseOrderId,
      supplierRef: '',
      invoiceDate: todayInput(),
      dueDate: '',
      notes: '',
      lines: [],
    },
  });

  const { fields, replace } = useFieldArray({ control, name: 'lines' });
  const purchaseOrderId = watch('purchaseOrderId');
  const lines = watch('lines');

  const orderDetail = useQuery({
    queryKey: ['purchase-orders', purchaseOrderId],
    queryFn: () => purchaseOrderApi.get(purchaseOrderId),
    enabled: Boolean(purchaseOrderId),
  });

  useEffect(() => {
    const detail = orderDetail.data;
    if (!detail) {
      return;
    }
    replace(
      detail.lineItems.map((line) => ({
        productId: line.product.id,
        productName: `${line.product?.name ?? ''} (${line.product?.code ?? ''})`,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
      }))
    );
  }, [orderDetail.data, replace]);

  // Not memoised (see RequirementCreatePage): `watch` hands back a reference into
  // react-hook-form's internal form values and those are mutated in place, so a `[lines]`
  // dependency stays referentially equal as the user edits. A memo would only refresh when
  // the array itself is replaced - i.e. when a line is added or removed.
  const perLine = (lines ?? []).map((line) => {
    const subtotal = money(dec(line.quantity || '0').times(dec(line.unitPrice || '0')));
    const tax = money(subtotal.times(dec(line.taxRate || '0')).dividedBy(100));
    return { subtotal, tax, total: money(subtotal.plus(tax)) };
  });
  const totals = {
    perLine,
    subtotal: money(sumDecimals(perLine.map((line) => line.subtotal))),
    tax: money(sumDecimals(perLine.map((line) => line.tax))),
    total: money(sumDecimals(perLine.map((line) => line.total))),
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      supplierInvoiceApi.create({
        purchaseOrderId: values.purchaseOrderId,
        supplierRef: values.supplierRef,
        invoiceDate: new Date(values.invoiceDate).toISOString(),
        ...(values.dueDate ? { dueDate: new Date(values.dueDate).toISOString() } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        lines: values.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          ...(line.unitPrice ? { unitPrice: line.unitPrice } : {}),
          ...(line.taxRate ? { taxRate: line.taxRate } : {}),
        })),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Supplier invoice ${document.documentNumber} recorded`);
      navigate(`/supplier-invoices/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to record this invoice'),
  });

  if (orders.isLoading) {
    return <LoadingState label="Loading purchase orders…" />;
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Supplier Invoice"
        subtitle="Book the invoice exactly as the supplier claims it - the backend derives the payable and disputed amounts from the stock actually accepted"
        actions={
          <>
            <Button size="small" onClick={() => navigate('/supplier-invoices')}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Record invoice'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Invoice details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <SelectInput
              control={control}
              name="purchaseOrderId"
              label="Purchase order"
              required
              placeholder="Select a purchase order"
              options={(orders.data ?? []).map((order) => ({
                value: order.id,
                label: `${order.documentNumber} • ${order.supplier?.name ?? ''} • ${formatMoney(order.totalAmount)}`,
              }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="supplierRef"
              label="Supplier invoice number"
              required
              placeholder="e.g. INV-MS-77120"
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextInput
              control={control}
              name="invoiceDate"
              label="Invoice date"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextInput
              control={control}
              name="dueDate"
              label="Due date"
              type="date"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextInput control={control} name="notes" label="Notes" />
          </Grid>
        </Grid>
      </FormSection>

      {fields.length === 0 ? (
        <Alert severity="info">Select a purchase order to load the invoiced lines.</Alert>
      ) : (
        <FormSection
          title="Invoiced lines"
          description="Enter the quantity and price the supplier is billing, even where it exceeds what was accepted"
        >
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, minWidth: 220 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 140 }}>Billed quantity *</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 140 }}>Unit price</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 110 }}>Tax %</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Line total
                  </TableCell>
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
                    <TableCell align="right">
                      {formatMoney(totals.perLine[index]?.total ?? '0')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="flex-end">
            <Box sx={{ minWidth: 260 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Subtotal
                </Typography>
                <Typography variant="body2">{formatMoney(totals.subtotal)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Tax
                </Typography>
                <Typography variant="body2">{formatMoney(totals.tax)}</Typography>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">Invoice total</Typography>
                <Typography variant="subtitle2">{formatMoney(totals.total)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                The payable and disputed split is computed by the backend from the accepted stock.
              </Typography>
            </Box>
          </Stack>
        </FormSection>
      )}
    </form>
  );
}
