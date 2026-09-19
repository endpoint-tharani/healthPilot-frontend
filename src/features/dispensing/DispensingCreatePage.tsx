import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dispensingApi } from '@/api/endpoints';
import { useBranches, useProducts, useStock } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatMoney, formatQuantity, money, sumDecimals } from '@/utils/decimal';
import { PAYMENT_METHODS, formatDate, humanise } from '@/utils/format';
import type { PaymentMethod } from '@/types/api';

const schema = z.object({
  branchId: z.string().uuid('Select the dispensing branch'),
  patientRef: z.string().trim().min(1, 'Patient reference is required').max(100),
  prescriptionRef: z.string().trim().min(1, 'Prescription reference is required').max(100),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER']),
  notes: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        stockKey: z.string().min(1, 'Select the batch to dispense from'),
        quantity: z
          .string()
          .min(1, 'Quantity is required')
          .refine((value) => dec(value).greaterThan(0), 'Quantity must be greater than 0'),
        unitPrice: z.string().optional(),
      })
    )
    .min(1, 'Add at least one line'),
});

type FormValues = z.infer<typeof schema>;

export function DispensingCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: branches, isLoading: branchesLoading } = useBranches();
  const { data: products } = useProducts();

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchId: '',
      patientRef: '',
      prescriptionRef: '',
      paymentMethod: 'CARD',
      notes: '',
      lines: [{ stockKey: '', quantity: '', unitPrice: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const branchId = watch('branchId');
  const lines = watch('lines');

  // Dispensing consumes usable stock only; damaged stock is never offered.
  const stock = useStock({ branchId, stockStatus: 'USABLE' }, Boolean(branchId));

  const productById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products]
  );

  const stockOptions = useMemo(
    () =>
      (stock.data ?? [])
        .filter((row) => row.product && row.batch && dec(row.quantity).greaterThan(0))
        .map((row) => ({
          key: `${row.product!.id}:${row.batch!.id}`,
          productId: row.product!.id,
          batchId: row.batch!.id,
          available: row.quantity,
          sellingPrice: productById.get(row.product!.id)?.sellingPrice ?? '0',
          taxRate: productById.get(row.product!.id)?.taxRate ?? '0',
          label: `${row.product!.name} • batch ${row.batch!.batchNumber} • exp ${formatDate(
            row.batch!.expiryDate
          )} • available ${formatQuantity(row.quantity)}`,
        })),
    [stock.data, productById]
  );

  const optionByKey = useMemo(
    () => new Map(stockOptions.map((option) => [option.key, option])),
    [stockOptions]
  );

  /** Preview only - the posted document is valued by the backend. */
  const totals = useMemo(() => {
    const perLine = (lines ?? []).map((line) => {
      const option = optionByKey.get(line.stockKey);
      if (!option) {
        return { subtotal: dec(0), tax: dec(0), total: dec(0), cost: dec(0) };
      }
      const price = line.unitPrice || option.sellingPrice;
      const subtotal = money(dec(line.quantity || '0').times(dec(price)));
      const tax = money(subtotal.times(dec(option.taxRate)).dividedBy(100));
      const cost = money(
        dec(line.quantity || '0').times(dec(productById.get(option.productId)?.purchasePrice ?? '0'))
      );
      return { subtotal, tax, total: money(subtotal.plus(tax)), cost };
    });
    const subtotal = money(sumDecimals(perLine.map((line) => line.subtotal)));
    const tax = money(sumDecimals(perLine.map((line) => line.tax)));
    return {
      perLine,
      subtotal,
      tax,
      total: money(subtotal.plus(tax)),
      cost: money(sumDecimals(perLine.map((line) => line.cost))),
    };
  }, [lines, optionByKey, productById]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      dispensingApi.create({
        branchId: values.branchId,
        patientRef: values.patientRef,
        prescriptionRef: values.prescriptionRef,
        paymentMethod: values.paymentMethod as PaymentMethod,
        ...(values.notes ? { notes: values.notes } : {}),
        lines: values.lines.map((line) => {
          const option = optionByKey.get(line.stockKey)!;
          return {
            productId: option.productId,
            batchId: option.batchId,
            quantity: line.quantity,
            ...(line.unitPrice ? { unitPrice: line.unitPrice } : {}),
          };
        }),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['dispensing'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(`Dispensing ${document.documentNumber} recorded`);
      navigate(`/dispensing/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to record this dispensing'),
  });

  if (branchesLoading) {
    return <LoadingState label="Loading branches…" />;
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Dispensing"
        subtitle="Issues stock from a specific branch, product and batch, and records the counter payment"
        actions={
          <>
            <Button size="small" onClick={() => navigate('/dispensing')}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Dispensing…' : 'Dispense and take payment'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Dispensing details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <SelectInput
              control={control}
              name="branchId"
              label="Branch"
              required
              placeholder="Select a branch"
              options={(branches ?? []).map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="patientRef"
              label="Patient reference"
              required
              placeholder="e.g. PT-10293"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="prescriptionRef"
              label="Prescription reference"
              required
              placeholder="e.g. RX-55871"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SelectInput
              control={control}
              name="paymentMethod"
              label="Payment method"
              required
              options={PAYMENT_METHODS.map((method) => ({
                value: method,
                label: humanise(method),
              }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextInput control={control} name="notes" label="Notes" />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection
        title="Dispensed items"
        description="Stock is issued from the exact branch, product and batch selected"
        actions={
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={!branchId}
            onClick={() => append({ stockKey: '', quantity: '', unitPrice: '' })}
          >
            Add line
          </Button>
        }
      >
        {!branchId ? (
          <Alert severity="info">Select a branch to list the usable stock it holds.</Alert>
        ) : stock.isLoading ? (
          <LoadingState label="Loading available stock…" />
        ) : stockOptions.length === 0 ? (
          <Alert severity="warning">
            This branch holds no usable stock. Receive a transfer before dispensing.
          </Alert>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, minWidth: 320 }}>
                      Product / batch (usable stock) *
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 120 }}>Quantity *</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 140 }}>Selling price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, width: 120 }}>
                      Line total
                    </TableCell>
                    <TableCell align="right" sx={{ width: 60 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field, index) => {
                    const option = optionByKey.get(lines?.[index]?.stockKey ?? '');
                    const quantity = dec(lines?.[index]?.quantity ?? '0');
                    const exceeds = option ? quantity.greaterThan(dec(option.available)) : false;
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <SelectInput
                            control={control}
                            name={`lines.${index}.stockKey`}
                            label=""
                            ariaLabel={`Product and batch, line ${index + 1}`}
                            placeholder="Select stock"
                            options={stockOptions.map((item) => ({
                              value: item.key,
                              label: item.label,
                            }))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextInput
                            control={control}
                            name={`lines.${index}.quantity`}
                            label=""
                            ariaLabel={`Quantity, line ${index + 1}`}
                            inputProps={{ inputMode: 'decimal' }}
                            error={exceeds}
                            helperText={exceeds ? 'More than the usable stock held' : undefined}
                          />
                        </TableCell>
                        <TableCell>
                          <TextInput
                            control={control}
                            name={`lines.${index}.unitPrice`}
                            label=""
                            ariaLabel={`Unit price, line ${index + 1}`}
                            placeholder={option?.sellingPrice}
                            inputProps={{ inputMode: 'decimal' }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatMoney(totals.perLine[index]?.total ?? '0')}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            disabled={fields.length === 1}
                            onClick={() => remove(index)}
                            aria-label="Remove line"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="flex-end">
              <Box sx={{ minWidth: 280 }}>
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
                  <Typography variant="subtitle2">Total payable</Typography>
                  <Typography variant="subtitle2">{formatMoney(totals.total)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Stock issued at cost
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatMoney(totals.cost)}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </>
        )}
      </FormSection>
    </form>
  );
}
