import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Switch,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productApi, type ProductInput } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filters';
import { SubmitError, TextInput } from '@/components/FormFields';
import { useToast } from '@/components/Toast';
import { formatMoney, formatQuantity } from '@/utils/decimal';
import type { Product } from '@/types/api';

const decimalField = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(/^\d+(\.\d{1,2})?$/, `${label} must be a number with up to 2 decimals`);

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only'),
  name: z.string().trim().min(2, 'Name is required'),
  unit: z.string().trim().min(1, 'Unit is required'),
  purchasePrice: decimalField('Purchase price'),
  sellingPrice: decimalField('Selling price'),
  taxRate: decimalField('Tax rate'),
  minTemp: z.string().optional(),
  maxTemp: z.string().optional(),
  trackInventory: z.boolean(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function ProductDialog({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      code: product?.code ?? '',
      name: product?.name ?? '',
      unit: product?.unit ?? '',
      purchasePrice: product?.purchasePrice ?? '',
      sellingPrice: product?.sellingPrice ?? '',
      taxRate: product?.taxRate ?? '',
      minTemp: product?.minTemp ?? '',
      maxTemp: product?.maxTemp ?? '',
      trackInventory: product?.trackInventory ?? true,
      isActive: product?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: ProductInput = {
        code: values.code,
        name: values.name,
        unit: values.unit,
        purchasePrice: values.purchasePrice,
        sellingPrice: values.sellingPrice,
        taxRate: values.taxRate,
        trackInventory: values.trackInventory,
        isActive: values.isActive,
        minTemp: values.minTemp ? values.minTemp : null,
        maxTemp: values.maxTemp ? values.maxTemp : null,
      };
      return product ? productApi.update(product.id, payload) : productApi.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Product ${product ? 'updated' : 'created'} successfully`);
      onClose();
    },
    onError: (error) => toast.fromError(error, 'Unable to save this product'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <DialogTitle>{product ? `Edit ${product.name}` : 'New product'}</DialogTitle>
        <DialogContent>
          <SubmitError error={mutation.error} />
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={4}>
              <TextInput control={control} name="code" label="Code" required />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextInput control={control} name="name" label="Name" required />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextInput
                control={control}
                name="unit"
                label="Unit"
                required
                placeholder="e.g. Vial"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextInput control={control} name="purchasePrice" label="Purchase price" required />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextInput control={control} name="sellingPrice" label="Selling price" required />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextInput control={control} name="taxRate" label="Tax rate %" required />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextInput
                control={control}
                name="minTemp"
                label="Min storage °C"
                placeholder="e.g. 2"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextInput
                control={control}
                name="maxTemp"
                label="Max storage °C"
                placeholder="e.g. 8"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={watch('trackInventory')}
                    onChange={(event) => setValue('trackInventory', event.target.checked)}
                  />
                }
                label="Track inventory"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={watch('isActive')}
                    onChange={(event) => setValue('isActive', event.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save product'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function ProductsPage() {
  const { can } = useAuth();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: ['products', params],
    queryFn: () =>
      productApi.list({
        ...params,
        isActive: params.isActive === undefined ? undefined : params.isActive === 'true',
      }),
    placeholderData: (previous) => previous,
  });

  const openDialog = (product: Product | null) => {
    setEditing(product);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Product master: pricing, tax and storage conditions"
        actions={
          can('PRODUCT_MANAGE') ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openDialog(null)}
            >
              New Product
            </Button>
          ) : null
        }
      />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Search name or code"
          />
        }
      >
        <SelectFilter
          label="Status"
          value={params.isActive}
          onChange={(value) => setFilter('isActive', value)}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          width={160}
        />
      </FilterBar>

      <DataTable
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        emptyDescription="No products match the current filters."
        columns={[
          { key: 'code', header: 'Code', render: (row) => row.code },
          {
            key: 'name',
            header: 'Name',
            render: (row) => (
              <Typography variant="body2" fontWeight={500}>
                {row.name}
              </Typography>
            ),
          },
          { key: 'unit', header: 'Unit', render: (row) => row.unit },
          {
            key: 'storage',
            header: 'Storage',
            render: (row) =>
              row.minTemp || row.maxTemp
                ? `${formatQuantity(row.minTemp)}°C – ${formatQuantity(row.maxTemp)}°C`
                : '—',
            hideOnSmall: true,
          },
          {
            key: 'purchasePrice',
            header: 'Purchase',
            align: 'right',
            render: (row) => formatMoney(row.purchasePrice),
          },
          {
            key: 'sellingPrice',
            header: 'Selling',
            align: 'right',
            render: (row) => formatMoney(row.sellingPrice),
          },
          {
            key: 'taxRate',
            header: 'Tax',
            align: 'right',
            render: (row) => `${formatQuantity(row.taxRate)}%`,
          },
          {
            key: 'trackInventory',
            header: 'Inventory',
            render: (row) => (
              <Chip
                size="small"
                variant="outlined"
                label={row.trackInventory ? 'Tracked' : 'Not tracked'}
              />
            ),
            hideOnSmall: true,
          },
          {
            key: 'isActive',
            header: 'Status',
            render: (row) => (
              <Chip
                size="small"
                color={row.isActive ? 'success' : 'default'}
                variant={row.isActive ? 'filled' : 'outlined'}
                label={row.isActive ? 'Active' : 'Inactive'}
              />
            ),
          },
          ...(can('PRODUCT_MANAGE')
            ? [
                {
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  render: (row: Product) => (
                    <Button
                      size="small"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => openDialog(row)}
                    >
                      Edit
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      <ProductDialog
        product={editing}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
