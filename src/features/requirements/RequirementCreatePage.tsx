import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
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
import { requirementApi } from '@/api/endpoints';
import { useBranches, useProducts } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatMoney, formatQuantity, money, sumDecimals } from '@/utils/decimal';
import { daysFromNowInput } from '@/utils/format';

const schema = z.object({
  branchId: z.string().uuid('Select the requesting branch'),
  requiredDate: z.string().min(1, 'Required date is mandatory'),
  reason: z.string().trim().min(3, 'Give a reason of at least 3 characters').max(500),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid('Select a product'),
        quantity: z
          .string()
          .min(1, 'Quantity is required')
          .refine((value) => dec(value).greaterThan(0), 'Quantity must be greater than 0'),
        notes: z.string().max(255).optional(),
      })
    )
    .min(1, 'At least one line is required'),
});

type FormValues = z.infer<typeof schema>;

export function RequirementCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: branches, isLoading: branchesLoading } = useBranches();
  const { data: products, isLoading: productsLoading } = useProducts();

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchId: '',
      requiredDate: daysFromNowInput(14),
      reason: '',
      lines: [{ productId: '', quantity: '', notes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');

  const productById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products]
  );

  // Indicative only: the backend recalculates every amount from the product master.
  // Deliberately not memoised: `watch` hands back a reference into react-hook-form's
  // internal form values and those are mutated in place, so a `[lines]` dependency stays
  // referentially equal as the user edits. A memo would only refresh when the array itself
  // is replaced - i.e. when a line is added or removed - leaving every row a step behind.
  const perLine = (lines ?? []).map((line) => {
    const product = productById.get(line.productId);
    const unitPrice = product?.purchasePrice ?? '0';
    const taxRate = product?.taxRate ?? '0';
    const subtotal = money(dec(line.quantity || '0').times(dec(unitPrice)));
    const tax = money(subtotal.times(dec(taxRate)).dividedBy(100));
    return { unitPrice, taxRate, subtotal, tax, total: money(subtotal.plus(tax)) };
  });
  const totals = {
    perLine,
    subtotal: money(sumDecimals(perLine.map((line) => line.subtotal))),
    tax: money(sumDecimals(perLine.map((line) => line.tax))),
    total: money(sumDecimals(perLine.map((line) => line.total))),
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      requirementApi.create({
        branchId: values.branchId,
        requiredDate: new Date(values.requiredDate).toISOString(),
        reason: values.reason,
        lines: values.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          ...(line.notes ? { notes: line.notes } : {}),
        })),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['stock-requirements'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Requisition ${document.documentNumber} created`);
      navigate(`/requirements/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to create this requisition'),
  });

  if (branchesLoading || productsLoading) {
    return <LoadingState label="Loading branches and products…" />;
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Stock Requisition"
        subtitle="Raise branch demand. It becomes actionable once submitted and approved."
        actions={
          <>
            <Button size="small" onClick={() => navigate('/requirements')}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              variant="contained"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Create requisition'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Requisition details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <SelectInput
              control={control}
              name="branchId"
              label="Requesting branch"
              required
              placeholder="Select a branch"
              options={(branches ?? []).map((branch) => ({
                value: branch.id,
                label: `${branch.name} (${branch.code})`,
              }))}
              helperText="Only branches in your access scope are listed"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="requiredDate"
              label="Required date"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextInput
              control={control}
              name="reason"
              label="Reason"
              required
              placeholder="e.g. Monthly insulin replenishment for Branch A"
            />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection
        title="Items"
        description="Quantities are requested in the product's own unit of measure"
        actions={
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => append({ productId: '', quantity: '', notes: '' })}
          >
            Add line
          </Button>
        }
      >
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ '& .MuiTableCell-root': { px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Product *</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 64 }}>Unit</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 104, whiteSpace: 'nowrap' }}>
                  Quantity *
                </TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 150 }}>Notes</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 104 }}>
                  Unit price
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 120 }}>
                  Subtotal
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 104 }}>
                  Tax
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 120 }}>
                  Total
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field, index) => {
                const product = productById.get(lines?.[index]?.productId ?? '');
                const amounts = totals.perLine[index];
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <SelectInput
                        control={control}
                        name={`lines.${index}.productId`}
                        label=""
                        ariaLabel={`Product, line ${index + 1}`}
                        placeholder="Select a product"
                        options={(products ?? []).map((item) => ({
                          value: item.id,
                          label: `${item.name} (${item.code})`,
                        }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {product?.unit ?? '—'}
                      </Typography>
                    </TableCell>
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
                      <TextInput control={control} name={`lines.${index}.notes`} label="" ariaLabel={`Notes, line ${index + 1}`} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">
                        {product ? formatMoney(amounts?.unitPrice) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">
                        {product ? formatMoney(amounts?.subtotal) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {product ? (
                        <>
                          <Typography variant="body2">{formatMoney(amounts?.tax)}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {formatQuantity(amounts?.taxRate)}%
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {product ? formatMoney(amounts?.total) : '—'}
                      </Typography>
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
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Tax
              </Typography>
              <Typography variant="body2">{formatMoney(totals.tax)}</Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle2">Total</Typography>
              <Typography variant="subtitle2">{formatMoney(totals.total)}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Indicative value at purchase price (backend recalculates on save)
            </Typography>
          </Box>
        </Stack>
      </FormSection>
    </form>
  );
}
