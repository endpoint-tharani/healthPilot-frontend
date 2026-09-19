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
import { supplierApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filters';
import { SubmitError, TextInput } from '@/components/FormFields';
import { useToast } from '@/components/Toast';
import type { Supplier } from '@/types/api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only'),
  name: z.string().trim().min(2, 'Name is required'),
  contactInfo: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function SupplierDialog({
  supplier,
  open,
  onClose,
}: {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      code: supplier?.code ?? '',
      name: supplier?.name ?? '',
      contactInfo: supplier?.contactInfo ?? '',
      address: supplier?.address ?? '',
      isActive: supplier?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        code: values.code,
        name: values.name,
        isActive: values.isActive,
        ...(values.contactInfo ? { contactInfo: values.contactInfo } : {}),
        ...(values.address ? { address: values.address } : {}),
      };
      return supplier ? supplierApi.update(supplier.id, payload) : supplierApi.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(`Supplier ${supplier ? 'updated' : 'created'} successfully`);
      onClose();
    },
    onError: (error) => toast.fromError(error, 'Unable to save this supplier'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <DialogTitle>{supplier ? `Edit ${supplier.name}` : 'New supplier'}</DialogTitle>
        <DialogContent>
          <SubmitError error={mutation.error} />
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={4}>
              <TextInput control={control} name="code" label="Code" required />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextInput control={control} name="name" label="Name" required />
            </Grid>
            <Grid item xs={12}>
              <TextInput
                control={control}
                name="contactInfo"
                label="Contact details"
                placeholder="email, phone"
              />
            </Grid>
            <Grid item xs={12}>
              <TextInput control={control} name="address" label="Address" />
            </Grid>
            <Grid item xs={12}>
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
            {mutation.isPending ? 'Saving…' : 'Save supplier'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function SuppliersPage() {
  const { can } = useAuth();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: ['suppliers', params],
    queryFn: () =>
      supplierApi.list({
        ...params,
        isActive: params.isActive === undefined ? undefined : params.isActive === 'true',
      }),
    placeholderData: (previous) => previous,
  });

  const openDialog = (supplier: Supplier | null) => {
    setEditing(supplier);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Supplier master used by purchase orders, invoices, credit notes and payments"
        actions={
          can('SUPPLIER_MANAGE') ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openDialog(null)}
            >
              New Supplier
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
        emptyDescription="No suppliers match the current filters."
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
          {
            key: 'contactInfo',
            header: 'Contact',
            render: (row) => row.contactInfo ?? '—',
            hideOnSmall: true,
          },
          {
            key: 'address',
            header: 'Address',
            render: (row) => row.address ?? '—',
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
          ...(can('SUPPLIER_MANAGE')
            ? [
                {
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  render: (row: Supplier) => (
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

      <SupplierDialog
        supplier={editing}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
