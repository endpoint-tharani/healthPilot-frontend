import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { goodsReceiptApi, purchaseOrderApi } from '@/api/endpoints';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatQuantity } from '@/utils/decimal';
import { daysFromNowInput, formatDate, todayInput } from '@/utils/format';

/**
 * Receiving model enforced here and re-enforced by the backend:
 *   accepted + damaged + missing = quantity claimed on the supplier document
 *   physically delivered          = accepted + damaged
 *   damaged stock is never usable, missing stock never arrives at all
 */
const lineSchema = z
  .object({
    purchaseOrderLineItemId: z.string().uuid(),
    productName: z.string(),
    include: z.boolean(),
    quantity: z.string(),
    acceptedQuantity: z.string(),
    damagedQuantity: z.string(),
    missingQuantity: z.string(),
    batchNumber: z.string(),
    expiryDate: z.string(),
    notes: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    if (!line.include) {
      return;
    }
    const claimed = dec(line.quantity);
    if (!claimed.greaterThan(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Claimed quantity must be greater than 0',
      });
      return;
    }
    const parts = [line.acceptedQuantity, line.damagedQuantity, line.missingQuantity];
    if (parts.some((value) => dec(value).isNegative())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['acceptedQuantity'],
        message: 'Quantities cannot be negative',
      });
      return;
    }
    const split = dec(line.acceptedQuantity)
      .plus(dec(line.damagedQuantity))
      .plus(dec(line.missingQuantity));
    if (!split.equals(claimed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['acceptedQuantity'],
        message: `Accepted + damaged + missing (${split.toFixed(2)}) must equal the claimed quantity ${claimed.toFixed(2)}`,
      });
    }
    if (!line.batchNumber.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['batchNumber'],
        message: 'Batch number is required',
      });
    }
    if (!line.expiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date is required',
      });
    }
  });

const schema = z
  .object({
    purchaseOrderId: z.string().uuid('Select an approved purchase order'),
    supplierRef: z.string().trim().min(1, 'Supplier document number is required').max(100),
    receiptDate: z.string().min(1, 'Receipt date is required'),
    notes: z.string().max(500).optional(),
    lines: z.array(lineSchema),
  })
  .refine((values) => values.lines.some((line) => line.include), {
    path: ['lines'],
    message: 'Select at least one line to receive',
  });

type FormValues = z.infer<typeof schema>;

function SplitSummary({
  accepted,
  damaged,
  missing,
  claimed,
}: {
  accepted: string;
  damaged: string;
  missing: string;
  claimed: string;
}) {
  const split = dec(accepted).plus(dec(damaged)).plus(dec(missing));
  const balanced = split.equals(dec(claimed)) && dec(claimed).greaterThan(0);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
      <Chip
        size="small"
        color="success"
        label={`Usable ${formatQuantity(accepted)}`}
        variant="filled"
      />
      <Chip size="small" color="error" label={`Damaged ${formatQuantity(damaged)}`} />
      <Chip size="small" variant="outlined" label={`Missing ${formatQuantity(missing)}`} />
      <Chip
        size="small"
        variant="outlined"
        label={`Physically received ${formatQuantity(dec(accepted).plus(dec(damaged)))}`}
      />
      <Chip
        size="small"
        color={balanced ? 'success' : 'warning'}
        variant="outlined"
        label={
          balanced
            ? `Balanced against claim of ${formatQuantity(claimed)}`
            : `Split ${formatQuantity(split)} ≠ claim ${formatQuantity(claimed)}`
        }
      />
    </Stack>
  );
}

export function GoodsReceiptCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetPurchaseOrderId = searchParams.get('purchaseOrderId') ?? '';

  const approvedOrders = useQuery({
    queryKey: ['purchase-orders', 'approved-options'],
    queryFn: () => purchaseOrderApi.list({ status: 'APPROVED', limit: 100 }),
    select: (result) => result.data,
  });

  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      purchaseOrderId: presetPurchaseOrderId,
      supplierRef: '',
      receiptDate: todayInput(),
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
        purchaseOrderLineItemId: line.id,
        productName: `${line.product?.name ?? ''} (${line.product?.code ?? ''})`,
        include: true,
        quantity: line.quantity,
        acceptedQuantity: line.quantity,
        damagedQuantity: '0',
        missingQuantity: '0',
        batchNumber: '',
        expiryDate: daysFromNowInput(365),
        notes: '',
      }))
    );
  }, [orderDetail.data, replace]);

  // Not memoised (see RequirementCreatePage): `watch` hands back a reference into
  // react-hook-form's internal form values and those are mutated in place, so a `[lines]`
  // dependency stays referentially equal as the user edits. A memo would only refresh when
  // the array itself is replaced - i.e. when a line is added or removed.
  const included = (lines ?? []).filter((line) => line.include);
  const totals = {
    accepted: included.reduce((acc, line) => acc.plus(dec(line.acceptedQuantity)), dec(0)),
    damaged: included.reduce((acc, line) => acc.plus(dec(line.damagedQuantity)), dec(0)),
    missing: included.reduce((acc, line) => acc.plus(dec(line.missingQuantity)), dec(0)),
    claimed: included.reduce((acc, line) => acc.plus(dec(line.quantity)), dec(0)),
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      goodsReceiptApi.create({
        purchaseOrderId: values.purchaseOrderId,
        supplierRef: values.supplierRef,
        receiptDate: new Date(values.receiptDate).toISOString(),
        ...(values.notes ? { notes: values.notes } : {}),
        lines: values.lines
          .filter((line) => line.include)
          .map((line) => ({
            purchaseOrderLineItemId: line.purchaseOrderLineItemId,
            quantity: line.quantity,
            acceptedQuantity: line.acceptedQuantity,
            damagedQuantity: line.damagedQuantity,
            missingQuantity: line.missingQuantity,
            batchNumber: line.batchNumber.trim(),
            expiryDate: new Date(line.expiryDate).toISOString(),
            ...(line.notes ? { notes: line.notes } : {}),
          })),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Goods receipt ${document.documentNumber} created as a draft`);
      navigate(`/goods-receipts/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to create this goods receipt'),
  });

  if (approvedOrders.isLoading) {
    return <LoadingState label="Loading approved purchase orders…" />;
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Goods Receipt"
        subtitle="Record what the supplier claimed and how it was actually received"
        actions={
          <>
            <Button size="small" onClick={() => navigate('/goods-receipts')}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create receipt (draft)'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />
      {formState.errors.lines?.message ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formState.errors.lines.message}
        </Alert>
      ) : null}

      <FormSection title="Receipt details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <SelectInput
              control={control}
              name="purchaseOrderId"
              label="Purchase order"
              required
              placeholder="Select an approved purchase order"
              options={(approvedOrders.data ?? []).map((order) => ({
                value: order.id,
                label: `${order.documentNumber} • ${order.supplier?.name ?? ''} • ${order.branch?.name ?? ''}`,
              }))}
              helperText="Goods can only be received against an APPROVED order"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="supplierRef"
              label="Supplier document number"
              required
              placeholder="e.g. DN-88412"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextInput
              control={control}
              name="receiptDate"
              label="Receipt date"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextInput control={control} name="notes" label="Notes" />
          </Grid>
        </Grid>
      </FormSection>

      {fields.length === 0 ? (
        <Alert severity="info">Select a purchase order to load its lines for receiving.</Alert>
      ) : (
        <FormSection
          title="Received lines"
          description="Accepted + damaged + missing must equal the quantity the supplier claims"
        >
          <Stack spacing={2}>
            {fields.map((field, index) => {
              const line = lines?.[index];
              const poLine = orderDetail.data?.lineItems.find(
                (item) => item.id === field.purchaseOrderLineItemId
              );
              return (
                <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ mb: 2 }}
                  >
                    <Box>
                      <Typography variant="subtitle2">{field.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Ordered {formatQuantity(poLine?.quantity ?? '0')}{' '}
                        {poLine?.unitOfMeasure ?? ''} • expected {formatDate(
                          orderDetail.data?.expectedDeliveryDate ?? null
                        )}
                      </Typography>
                    </Box>
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid item xs={6} md={2}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.quantity`}
                        label="Supplier claimed"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.acceptedQuantity`}
                        label="Accepted (usable)"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.damagedQuantity`}
                        label="Damaged"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.missingQuantity`}
                        label="Missing"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.batchNumber`}
                        label="Batch number"
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.expiryDate`}
                        label="Expiry date"
                        type="date"
                        required
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 2 }}>
                    <SplitSummary
                      accepted={line?.acceptedQuantity ?? '0'}
                      damaged={line?.damagedQuantity ?? '0'}
                      missing={line?.missingQuantity ?? '0'}
                      claimed={line?.quantity ?? '0'}
                    />
                  </Box>
                </Paper>
              );
            })}
          </Stack>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="flex-end">
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Receipt summary
              </Typography>
              <SplitSummary
                accepted={totals.accepted.toFixed(2)}
                damaged={totals.damaged.toFixed(2)}
                missing={totals.missing.toFixed(2)}
                claimed={totals.claimed.toFixed(2)}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Damaged stock is booked to the DAMAGED bucket and never becomes usable. Missing
                quantities create no stock at all.
              </Typography>
            </Box>
          </Stack>
        </FormSection>
      )}
    </form>
  );
}
