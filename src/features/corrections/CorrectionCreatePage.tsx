import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
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
import { correctionApi, goodsReceiptApi } from '@/api/endpoints';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatQuantity } from '@/utils/decimal';
import { formatDateTime } from '@/utils/format';

const lineSchema = z
  .object({
    goodsReceiptLineItemId: z.string().uuid(),
    productName: z.string(),
    claimedQuantity: z.string(),
    originalAccepted: z.string(),
    originalDamaged: z.string(),
    originalMissing: z.string(),
    correctedAcceptedQuantity: z.string(),
    correctedDamagedQuantity: z.string(),
    correctedMissingQuantity: z.string(),
  })
  .superRefine((line, ctx) => {
    const parts = [
      line.correctedAcceptedQuantity,
      line.correctedDamagedQuantity,
      line.correctedMissingQuantity,
    ];
    if (parts.some((value) => dec(value).isNegative())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctedAcceptedQuantity'],
        message: 'Corrected quantities cannot be negative',
      });
      return;
    }
    const total = parts.reduce((acc, value) => acc.plus(dec(value)), dec(0));
    if (!total.equals(dec(line.claimedQuantity))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctedAcceptedQuantity'],
        message: `Corrected accepted + damaged + missing (${total.toFixed(2)}) must equal the received quantity ${dec(
          line.claimedQuantity
        ).toFixed(2)}`,
      });
    }
  });

const schema = z.object({
  goodsReceiptId: z.string().uuid('Select the receipt to correct'),
  reason: z.string().trim().min(3, 'A correction reason of at least 3 characters is required'),
  lines: z.array(lineSchema).min(1, 'Select a receipt to load its lines'),
});

type FormValues = z.infer<typeof schema>;

export function CorrectionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetReceiptId = searchParams.get('goodsReceiptId') ?? '';

  const correctableReceipts = useQuery({
    queryKey: ['goods-receipts', 'correctable-options'],
    queryFn: () => goodsReceiptApi.list({ status: 'POSTED,CORRECTED', limit: 100 }),
    select: (result) => result.data,
  });

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { goodsReceiptId: presetReceiptId, reason: '', lines: [] },
  });

  const { fields, replace } = useFieldArray({ control, name: 'lines' });
  const goodsReceiptId = watch('goodsReceiptId');
  const lines = watch('lines');

  const receiptDetail = useQuery({
    queryKey: ['goods-receipts', goodsReceiptId],
    queryFn: () => goodsReceiptApi.get(goodsReceiptId),
    enabled: Boolean(goodsReceiptId),
  });

  useEffect(() => {
    const detail = receiptDetail.data;
    if (!detail) {
      return;
    }
    replace(
      detail.lineItems.map((line) => ({
        goodsReceiptLineItemId: line.id,
        productName: `${line.product?.name ?? ''} (${line.product?.code ?? ''})`,
        claimedQuantity: line.quantity,
        originalAccepted: line.acceptedQuantity ?? '0',
        originalDamaged: line.damagedQuantity ?? '0',
        originalMissing: line.missingQuantity ?? '0',
        correctedAcceptedQuantity: line.acceptedQuantity ?? '0',
        correctedDamagedQuantity: line.damagedQuantity ?? '0',
        correctedMissingQuantity: line.missingQuantity ?? '0',
      }))
    );
  }, [receiptDetail.data, replace]);

  const changedLines = useMemo(
    () =>
      (lines ?? []).filter(
        (line) =>
          !dec(line.correctedAcceptedQuantity).equals(dec(line.originalAccepted)) ||
          !dec(line.correctedDamagedQuantity).equals(dec(line.originalDamaged)) ||
          !dec(line.correctedMissingQuantity).equals(dec(line.originalMissing))
      ),
    [lines]
  );

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      correctionApi.create({
        goodsReceiptId: values.goodsReceiptId,
        reason: values.reason,
        // Only lines that actually change are sent: the backend rejects a no-op line.
        lines: values.lines
          .filter(
            (line) =>
              !dec(line.correctedAcceptedQuantity).equals(dec(line.originalAccepted)) ||
              !dec(line.correctedDamagedQuantity).equals(dec(line.originalDamaged)) ||
              !dec(line.correctedMissingQuantity).equals(dec(line.originalMissing))
          )
          .map((line) => ({
            goodsReceiptLineItemId: line.goodsReceiptLineItemId,
            correctedAcceptedQuantity: line.correctedAcceptedQuantity,
            correctedDamagedQuantity: line.correctedDamagedQuantity,
            correctedMissingQuantity: line.correctedMissingQuantity,
          })),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['receipt-corrections'] });
      void queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Receipt correction ${document.documentNumber} posted`);
      navigate(`/receipt-corrections/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to post this correction'),
  });

  if (correctableReceipts.isLoading) {
    return <LoadingState label="Loading posted receipts…" />;
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Receipt Correction"
        subtitle="The posted receipt stays untouched; this document records the corrected position and the stock delta"
        actions={
          <>
            <Button size="small" onClick={() => navigate('/receipt-corrections')}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              variant="contained"
              color="warning"
              disabled={mutation.isPending || changedLines.length === 0}
            >
              {mutation.isPending ? 'Saving…' : 'Post correction'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      <FormSection title="Correction details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <SelectInput
              control={control}
              name="goodsReceiptId"
              label="Goods receipt to correct"
              required
              placeholder="Select a posted receipt"
              options={(correctableReceipts.data ?? []).map((receipt) => ({
                value: receipt.id,
                label: `${receipt.documentNumber} • ${receipt.supplierRef ?? ''} • ${receipt.branch?.name ?? ''}`,
              }))}
              helperText="Only POSTED or already-CORRECTED receipts can be corrected"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextInput
              control={control}
              name="reason"
              label="Correction reason"
              required
              placeholder="e.g. Receipt posted as 100 accepted; physical check found 70 usable, 20 damaged, 10 missing"
            />
          </Grid>
        </Grid>
      </FormSection>

      {receiptDetail.data ? (
        <FormSection
          title="Original receipt (unchanged)"
          description={`Posted by ${receiptDetail.data.createdBy?.name ?? '—'} on ${formatDateTime(
            receiptDetail.data.createdAt
          )}`}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Claimed
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Accepted
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Damaged
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Missing
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receiptDetail.data.lineItems.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.product?.name}</TableCell>
                  <TableCell align="right">{formatQuantity(line.quantity)}</TableCell>
                  <TableCell align="right">{formatQuantity(line.acceptedQuantity)}</TableCell>
                  <TableCell align="right">{formatQuantity(line.damagedQuantity)}</TableCell>
                  <TableCell align="right">{formatQuantity(line.missingQuantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </FormSection>
      ) : null}

      {fields.length === 0 ? (
        <Alert severity="info">Select a posted goods receipt to load its lines.</Alert>
      ) : (
        <FormSection
          title="Corrected position"
          description="Enter the true split. Accepted + damaged + missing must still equal the quantity received."
        >
          <Stack spacing={2}>
            {fields.map((field, index) => {
              const line = lines?.[index];
              const deltaAccepted = dec(line?.correctedAcceptedQuantity).minus(
                dec(line?.originalAccepted)
              );
              const deltaDamaged = dec(line?.correctedDamagedQuantity).minus(
                dec(line?.originalDamaged)
              );
              const deltaMissing = dec(line?.correctedMissingQuantity).minus(
                dec(line?.originalMissing)
              );

              return (
                <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                    {field.productName}
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}
                      • received {formatQuantity(field.claimedQuantity)}
                    </Typography>
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.correctedAcceptedQuantity`}
                        label="Corrected accepted (usable)"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                        helperText={`Originally ${formatQuantity(field.originalAccepted)}`}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.correctedDamagedQuantity`}
                        label="Corrected damaged"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                        helperText={`Originally ${formatQuantity(field.originalDamaged)}`}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextInput
                        control={control}
                        name={`lines.${index}.correctedMissingQuantity`}
                        label="Corrected missing"
                        required
                        inputProps={{ inputMode: 'decimal' }}
                        helperText={`Originally ${formatQuantity(field.originalMissing)}`}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Stock delta this correction will post:{' '}
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      usable {deltaAccepted.isNegative() ? '' : '+'}
                      {formatQuantity(deltaAccepted)} • damaged{' '}
                      {deltaDamaged.isNegative() ? '' : '+'}
                      {formatQuantity(deltaDamaged)} • missing{' '}
                      {deltaMissing.isNegative() ? '' : '+'}
                      {formatQuantity(deltaMissing)} (no stock movement)
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Stack>

          {changedLines.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Change at least one quantity: a correction that matches the current position is
              rejected by the backend.
            </Alert>
          ) : null}
        </FormSection>
      )}
    </form>
  );
}
