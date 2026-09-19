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
import WarehouseIcon from '@mui/icons-material/Warehouse';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filters';
import { SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { useToast } from '@/components/Toast';
import type { Branch, BranchType } from '@/types/api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only'),
  name: z.string().trim().min(2, 'Name is required'),
  type: z.enum(['CENTRAL_WAREHOUSE', 'BRANCH']),
  address: z.string().max(255).optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function BranchDialog({
  branch,
  open,
  onClose,
}: {
  branch: Branch | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      type: branch?.type ?? 'BRANCH',
      address: branch?.address ?? '',
      isActive: branch?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        code: values.code,
        name: values.name,
        type: values.type as BranchType,
        isActive: values.isActive,
        ...(values.address ? { address: values.address } : {}),
      };
      return branch ? branchApi.update(branch.id, payload) : branchApi.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(`Branch ${branch ? 'updated' : 'created'} successfully`);
      onClose();
    },
    onError: (error) => toast.fromError(error, 'Unable to save this branch'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <DialogTitle>{branch ? `Edit ${branch.name}` : 'New branch'}</DialogTitle>
        <DialogContent>
          <SubmitError error={mutation.error} />
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={4}>
              <TextInput control={control} name="code" label="Code" required />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextInput control={control} name="name" label="Name" required />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SelectInput
                control={control}
                name="type"
                label="Branch type"
                required
                options={[
                  { value: 'CENTRAL_WAREHOUSE', label: 'Central warehouse' },
                  { value: 'BRANCH', label: 'Branch' },
                ]}
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
            {mutation.isPending ? 'Saving…' : 'Save branch'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function BranchesPage() {
  const { can, hasAllBranches } = useAuth();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: ['branches', params],
    queryFn: () =>
      branchApi.list({
        ...params,
        type: params.type as BranchType | undefined,
        isActive: params.isActive === undefined ? undefined : params.isActive === 'true',
      }),
    placeholderData: (previous) => previous,
  });

  const openDialog = (branch: Branch | null) => {
    setEditing(branch);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Branches"
        subtitle={
          hasAllBranches
            ? 'Central Pharmacy Warehouse and hospital branches'
            : 'Branches within your access scope'
        }
        actions={
          can('BRANCH_MANAGE') ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openDialog(null)}
            >
              New Branch
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
          label="Type"
          value={params.type}
          onChange={(value) => setFilter('type', value)}
          options={[
            { value: 'CENTRAL_WAREHOUSE', label: 'Central warehouse' },
            { value: 'BRANCH', label: 'Branch' },
          ]}
        />
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
        emptyDescription="No branches match the current filters."
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
            key: 'type',
            header: 'Type',
            render: (row) => (
              <Chip
                size="small"
                variant="outlined"
                icon={
                  row.type === 'CENTRAL_WAREHOUSE' ? (
                    <WarehouseIcon fontSize="small" />
                  ) : (
                    <StorefrontIcon fontSize="small" />
                  )
                }
                label={row.type === 'CENTRAL_WAREHOUSE' ? 'Central warehouse' : 'Branch'}
              />
            ),
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
          ...(can('BRANCH_MANAGE')
            ? [
                {
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  render: (row: Branch) => (
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

      <BranchDialog
        branch={editing}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
