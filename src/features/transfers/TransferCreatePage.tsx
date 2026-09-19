import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Button,
  Grid,
  IconButton,
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
import { stockTransferApi } from '@/api/endpoints';
import { useBranches, useStock, useTransferDestinations } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatQuantity } from '@/utils/decimal';
import { daysFromNowInput, formatDate } from '@/utils/format';

const schema = z
  .object({
    sourceBranchId: z.string().uuid('Select the source branch'),
    destinationBranchId: z.string().uuid('Select the destination branch'),
    expectedDate: z.string().optional(),
    notes: z.string().max(500).optional(),
    lines: z
      .array(
        z.object({
          /** "productId:batchId" - one usable stock bucket at the source branch. */
          stockKey: z.string().min(1, 'Select stock to transfer'),
          quantity: z
            .string()
            .min(1, 'Quantity is required')
            .refine((value) => dec(value).greaterThan(0), 'Quantity must be greater than 0'),
        })
      )
      .min(1, 'Add at least one line'),
  })
  .refine((values) => values.sourceBranchId !== values.destinationBranchId, {
    path: ['destinationBranchId'],
    message: 'Source and destination branches must be different',
  });

type FormValues = z.infer<typeof schema>;

export function TransferCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: branches, isLoading: branchesLoading } = useBranches();
  const { data: destinations } = useTransferDestinations();

  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceBranchId: '',
      destinationBranchId: '',
      expectedDate: daysFromNowInput(2),
      notes: '',
      lines: [{ stockKey: '', quantity: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const sourceBranchId = watch('sourceBranchId');
  const lines = watch('lines');

  // Only usable stock can leave a branch; damaged stock is never offered.
  const stock = useStock(
    { branchId: sourceBranchId, stockStatus: 'USABLE' },
    Boolean(sourceBranchId)
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
          label: `${row.product!.name} • batch ${row.batch!.batchNumber} • exp ${formatDate(
            row.batch!.expiryDate
          )} • available ${formatQuantity(row.quantity)}`,
        })),
    [stock.data]
  );

  const optionByKey = useMemo(
    () => new Map(stockOptions.map((option) => [option.key, option])),
    [stockOptions]
  );

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      stockTransferApi.create({
        sourceBranchId: values.sourceBranchId,
        destinationBranchId: values.destinationBranchId,
        ...(values.expectedDate
          ? { expectedDate: new Date(values.expectedDate).toISOString() }
          : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        lines: values.lines.map((line) => {
          const option = optionByKey.get(line.stockKey)!;
          return {
            productId: option.productId,
            batchId: option.batchId,
            quantity: line.quantity,
          };
        }),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Transfer ${document.documentNumber} created`);
      navigate(`/stock-transfers/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to create this transfer'),
  });

  if (branchesLoading) {
    return <LoadingState label="Loading branches…" />;
  }

  const label = (branch: { name: string; type: string }) =>
    `${branch.name} (${branch.type === 'CENTRAL_WAREHOUSE' ? 'Central warehouse' : 'Branch'})`;

  // Stock can only leave a branch the user may operate in, but it may be sent to
  // any branch in the company; the receiving branch authorises the receipt itself.
  const sourceOptions = (branches ?? []).map((branch) => ({
    value: branch.id,
    label: label(branch),
  }));
  const destinationOptions = (destinations ?? branches ?? []).map((branch) => ({
    value: branch.id,
    label: label(branch),
  }));

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Stock Transfer"
        subtitle="Creating the transfer does not move stock. Dispatch takes stock out of the source branch; receipt brings it into the destination."
        actions={
          <>
            <Button size="small" onClick={() => navigate('/stock-transfers')}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create transfer'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Transfer details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <SelectInput
              control={control}
              name="sourceBranchId"
              label="Source branch"
              required
              placeholder="Select the dispatching branch"
              options={sourceOptions}
              helperText="Stock is taken from this branch on dispatch"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <SelectInput
              control={control}
              name="destinationBranchId"
              label="Destination branch"
              required
              placeholder="Select the receiving branch"
              options={destinationOptions}
              helperText="Stock arrives here only when the transfer is received"
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextInput
              control={control}
              name="expectedDate"
              label="Expected date"
              type="date"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextInput control={control} name="notes" label="Notes" />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection
        title="Transferred stock"
        description="Only usable stock held at the source branch can be transferred"
        actions={
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={!sourceBranchId}
            onClick={() => append({ stockKey: '', quantity: '' })}
          >
            Add line
          </Button>
        }
      >
        {!sourceBranchId ? (
          <Alert severity="info">Select a source branch to list its usable stock.</Alert>
        ) : stock.isLoading ? (
          <LoadingState label="Loading available stock…" />
        ) : stockOptions.length === 0 ? (
          <Alert severity="warning">
            The selected source branch holds no usable stock, so nothing can be transferred from it.
          </Alert>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, minWidth: 320 }}>
                    Product / batch (usable stock) *
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 150 }}>Quantity *</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 140 }}>Available</TableCell>
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
                          ariaLabel={`Stock key, line ${index + 1}`}
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
                          helperText={exceeds ? 'More than the available usable stock' : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {option ? formatQuantity(option.available) : '—'}
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
        )}

        {formState.errors.destinationBranchId ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {formState.errors.destinationBranchId.message}
          </Alert>
        ) : null}
      </FormSection>
    </form>
  );
}
