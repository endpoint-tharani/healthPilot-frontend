import { useEffect, useMemo, useRef } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { purchaseOrderApi, requirementApi } from '@/api/endpoints';
import { useBranches, useProducts, useSuppliers } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import { FormSection, SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { LoadingState } from '@/components/states';
import { dec, formatMoney, money, sumDecimals, type Decimal } from '@/utils/decimal';
import { daysFromNowInput, formatDate } from '@/utils/format';
import { useAuthoritativeFulfilment } from '@/features/requirements/useRequirementFulfilment';
import {
  SourcingContextPanel,
  opportunityFromAvailability,
} from '@/features/requirements/SourcingOpportunity';

const schema = z.object({
  requirementId: z.string().uuid('Select a requirement'),
  supplierId: z.string().uuid('Select a supplier'),
  deliveryBranchId: z.string().uuid('Select the delivery branch'),
  expectedDeliveryDate: z.string().min(1, 'Expected delivery date is required'),
  notes: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid('Select a product'),
        quantity: z
          .string()
          .min(1, 'Quantity is required')
          .refine((value) => dec(value).greaterThan(0), 'Quantity must be greater than 0'),
        unitPrice: z.string().optional(),
        taxRate: z.string().optional(),
      })
    )
    .min(1, 'At least one line is required'),
});

type FormValues = z.infer<typeof schema>;

export function PurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetRequirementId = searchParams.get('requirementId') ?? '';

  const { data: branches } = useBranches();
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();

  // APPROVED requirements plus PARTIALLY_FULFILLED ones, which may still be
  // ordered against for whatever a receipt correction left short. The backend
  // enforces both the status and the remaining quantity.
  const approvedRequirements = useQuery({
    queryKey: ['stock-requirements', 'orderable-options'],
    queryFn: () => requirementApi.list({ status: 'APPROVED,PARTIALLY_FULFILLED', limit: 100 }),
    select: (result) => result.data,
  });

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      requirementId: presetRequirementId,
      supplierId: '',
      deliveryBranchId: '',
      expectedDeliveryDate: daysFromNowInput(7),
      notes: '',
      lines: [{ productId: '', quantity: '', unitPrice: '', taxRate: '' }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lines' });
  const requirementId = watch('requirementId');
  const lines = watch('lines');

  const requirementDetail = useQuery({
    queryKey: ['stock-requirements', requirementId],
    queryFn: () => requirementApi.get(requirementId),
    enabled: Boolean(requirementId),
  });

  const fulfilment = useAuthoritativeFulfilment(requirementDetail.data);

  /**
   * The quantity genuinely left for a supplier, straight from the backend: what
   * is requested, less everything received, less what open orders and in-flight
   * transfers are already bringing, less what another branch could spare today.
   *
   * That last term is the procurement guardrail. A requirement 10 short with 6
   * spare at Branch B opens this form at 4, not 10, so the default answer is the
   * one that does not buy stock the company already owns. It is only a default:
   * every quantity stays editable up to the backend cap, which is still the full
   * outstanding 10, and the backend is what enforces it.
   */
  const procurementByProduct = useMemo(() => {
    const map = new Map<string, Decimal>();
    for (const line of fulfilment.availability?.lines ?? []) {
      map.set(line.product.id, dec(line.suggestedProcurementQty));
    }
    return map;
  }, [fulfilment.availability]);

  // Seed the order from the requirement: same products, the quantity still
  // outstanding rather than the full request, delivery defaulting to the
  // requesting branch. Everything stays editable, and the backend is what
  // actually caps the quantity. Seeding waits for both queries and happens once
  // per requirement, so a late query cannot wipe the user's edits.
  const seededRequirementId = useRef<string | null>(null);
  useEffect(() => {
    const detail = requirementDetail.data;
    if (!detail || fulfilment.isLoading || seededRequirementId.current === detail.id) {
      return;
    }
    seededRequirementId.current = detail.id;
    replace(
      detail.lineItems.map((line) => {
        // The availability endpoint is the authority. The chain-derived figure is
        // only a fallback for a caller who could not read it, and it knows
        // nothing about open orders, transfers in transit or internal surplus.
        const toProcure =
          procurementByProduct.get(line.product.id) ??
          dec(line.quantity).minus(fulfilment.fulfilledByProduct.get(line.product.id) ?? dec(0));
        return {
          productId: line.product.id,
          quantity: (toProcure.greaterThan(0) ? toProcure : dec(0)).toFixed(2),
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
        };
      })
    );
    if (detail.branchId) {
      setValue('deliveryBranchId', detail.branchId);
    }
  }, [
    requirementDetail.data,
    fulfilment.isLoading,
    fulfilment.fulfilledByProduct,
    procurementByProduct,
    replace,
    setValue,
  ]);

  const productById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products]
  );

  // Not memoised (see RequirementCreatePage): `watch` hands back a reference into
  // react-hook-form's internal form values and those are mutated in place, so a `[lines]`
  // dependency stays referentially equal as the user edits. A memo would only refresh when
  // the array itself is replaced - i.e. when a line is added or removed.
  const perLine = (lines ?? []).map((line) => {
    const product = productById.get(line.productId);
    const unitPrice = line.unitPrice || product?.purchasePrice || '0';
    const taxRate = line.taxRate || product?.taxRate || '0';
    const subtotal = money(dec(line.quantity || '0').times(dec(unitPrice)));
    const tax = money(subtotal.times(dec(taxRate)).dividedBy(100));
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
      purchaseOrderApi.create({
        requirementId: values.requirementId,
        supplierId: values.supplierId,
        deliveryBranchId: values.deliveryBranchId,
        expectedDeliveryDate: new Date(values.expectedDeliveryDate).toISOString(),
        ...(values.notes ? { notes: values.notes } : {}),
        lines: values.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          ...(line.unitPrice ? { unitPrice: line.unitPrice } : {}),
          ...(line.taxRate ? { taxRate: line.taxRate } : {}),
        })),
      }),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-requirements'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`Purchase order ${document.documentNumber} created`);
      navigate(`/purchase-orders/${document.id}`, { replace: true });
    },
    onError: (error) => toast.fromError(error, 'Unable to create this purchase order'),
  });

  /**
   * Shown only while something is still owed. A requirement with nothing
   * outstanding has no sourcing decision left in it, and a panel saying so would
   * be noise on a form that cannot be submitted against it anyway.
   */
  const sourcing =
    fulfilment.availability && dec(fulfilment.availability.totals.outstanding).greaterThan(0)
      ? opportunityFromAvailability(fulfilment.availability)
      : null;

  if (approvedRequirements.isLoading) {
    return <LoadingState label="Loading approved requirements…" />;
  }

  const requirementOptions = (approvedRequirements.data ?? []).map((requirement) => ({
    value: requirement.id,
    label: `${requirement.documentNumber} • ${requirement.branch?.name ?? ''} • required ${formatDate(
      requirement.expectedDeliveryDate
    )}`,
  }));

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <PageHeader
        title="New Purchase Order"
        subtitle="Raised against an approved stock requirement"
        actions={
          <>
            <Button size="small" onClick={() => navigate('/purchase-orders')}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create purchase order'}
            </Button>
          </>
        }
      />

      <SubmitError error={mutation.error} />

      {/* The procurement guardrail. It is context beside the form, never a gate in
          front of it: the order can be raised whatever it says. */}
      {sourcing && requirementDetail.data ? (
        <SourcingContextPanel
          opportunity={sourcing}
          requirementNumber={requirementDetail.data.documentNumber}
          reviewHref={`/requirements/${requirementDetail.data.id}?tab=internal-sourcing`}
        />
      ) : null}

      {requirementOptions.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No orderable requirements are available. A purchase order can only be raised against a
          requirement that is APPROVED, or PARTIALLY_FULFILLED with a quantity still outstanding.
        </Alert>
      ) : null}

      <FormSection title="Order details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <SelectInput
              control={control}
              name="requirementId"
              label="Requirement"
              required
              placeholder="Select a requirement"
              options={requirementOptions}
              helperText="APPROVED requirements, and PARTIALLY_FULFILLED ones for the quantity still outstanding"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <SelectInput
              control={control}
              name="supplierId"
              label="Supplier"
              required
              placeholder="Select a supplier"
              options={(suppliers ?? []).map((supplier) => ({
                value: supplier.id,
                label: `${supplier.name} (${supplier.code})`,
              }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <SelectInput
              control={control}
              name="deliveryBranchId"
              label="Delivery branch"
              required
              placeholder="Select the receiving branch"
              options={(branches ?? []).map((branch) => ({
                value: branch.id,
                label: `${branch.name} (${branch.code})`,
              }))}
              helperText="Goods are received at this branch"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextInput
              control={control}
              name="expectedDeliveryDate"
              label="Expected delivery"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextInput control={control} name="notes" label="Notes" />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection
        title="Order lines"
        description="Prices default to the product master; the backend recalculates every total"
        actions={
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => append({ productId: '', quantity: '', unitPrice: '', taxRate: '' })}
          >
            Add line
          </Button>
        }
      >
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 220 }}>Product *</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 120 }}>Quantity *</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 130 }}>Unit price</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 110 }}>Tax %</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, width: 120 }}>
                  Line total
                </TableCell>
                <TableCell align="right" sx={{ width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <SelectInput
                      control={control}
                      name={`lines.${index}.productId`}
                      label=""
                      ariaLabel={`Product, line ${index + 1}`}
                      placeholder="Select a product"
                      options={(products ?? []).map((product) => ({
                        value: product.id,
                        label: `${product.name} (${product.code})`,
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
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      control={control}
                      name={`lines.${index}.unitPrice`}
                      label=""
                      ariaLabel={`Unit price, line ${index + 1}`}
                      placeholder={productById.get(lines?.[index]?.productId ?? '')?.purchasePrice}
                      inputProps={{ inputMode: 'decimal' }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      control={control}
                      name={`lines.${index}.taxRate`}
                      label=""
                      ariaLabel={`Tax rate, line ${index + 1}`}
                      placeholder={productById.get(lines?.[index]?.productId ?? '')?.taxRate}
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="flex-end">
          <Box sx={{ minWidth: 240 }}>
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
              <Typography variant="subtitle2">Total</Typography>
              <Typography variant="subtitle2">{formatMoney(totals.total)}</Typography>
            </Stack>
          </Box>
        </Stack>
      </FormSection>
    </form>
  );
}
