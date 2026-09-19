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
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useBranches } from '@/hooks/useReferenceData';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { EnumFilter, FilterBar, SearchFilter, SelectFilter } from '@/components/filters';
import { SelectInput, SubmitError, TextInput } from '@/components/FormFields';
import { useToast } from '@/components/Toast';
import { USER_ROLES, humanise } from '@/utils/format';
import type { BranchScopeType, CompanyUser, UserRole } from '@/types/api';

const schema = z
  .object({
    email: z.string().trim().email('Enter a valid email address'),
    name: z.string().trim().min(2, 'Name is required'),
    password: z.string().optional(),
    role: z.enum([
      'SUPER_ADMIN',
      'COMPANY_ADMIN',
      'CENTRAL_PHARMACY',
      'BRANCH_MANAGER',
      'PHARMACIST',
      'STAFF',
    ]),
    branchScope: z.enum(['ALL_BRANCHES', 'SPECIFIC_BRANCHES']),
    branchId: z.string().optional(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.branchScope === 'SPECIFIC_BRANCHES' && !values.branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['branchId'],
        message: 'A branch-scoped user must be assigned a branch',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function UserDialog({
  user,
  open,
  onClose,
}: {
  user: CompanyUser | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: branches } = useBranches();

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      email: user?.email ?? '',
      name: user?.name ?? '',
      password: '',
      role: user?.role ?? 'PHARMACIST',
      branchScope: user?.branchScope ?? 'SPECIFIC_BRANCHES',
      branchId: user?.branchId ?? '',
      isActive: user?.isActive ?? true,
    },
  });

  const branchScope = watch('branchScope');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const shared = {
        name: values.name,
        role: values.role as UserRole,
        branchScope: values.branchScope as BranchScopeType,
        branchId: values.branchScope === 'ALL_BRANCHES' ? null : (values.branchId ?? null),
        isActive: values.isActive,
      };

      if (user) {
        return userApi.update(user.id, {
          ...shared,
          ...(values.password ? { password: values.password } : {}),
        });
      }
      return userApi.create({
        ...shared,
        email: values.email,
        password: values.password ?? '',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`User ${user ? 'updated' : 'created'} successfully`);
      onClose();
    },
    onError: (error) => toast.fromError(error, 'Unable to save this user'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <DialogTitle>{user ? `Edit ${user.name}` : 'New user'}</DialogTitle>
        <DialogContent>
          <SubmitError error={mutation.error} />
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextInput
                control={control}
                name="email"
                label="Email"
                required
                disabled={Boolean(user)}
                helperText={user ? 'Email cannot be changed' : undefined}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextInput control={control} name="name" label="Full name" required />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextInput
                control={control}
                name="password"
                label={user ? 'New password' : 'Password'}
                type="password"
                required={!user}
                autoComplete="new-password"
                helperText={
                  user ? 'Leave blank to keep the current password' : 'At least 8 characters'
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SelectInput
                control={control}
                name="role"
                label="Role"
                required
                options={USER_ROLES.map((role) => ({ value: role, label: humanise(role) }))}
                helperText="The role determines the user's permissions"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SelectInput
                control={control}
                name="branchScope"
                label="Branch scope"
                required
                options={[
                  { value: 'ALL_BRANCHES', label: 'All branches' },
                  { value: 'SPECIFIC_BRANCHES', label: 'Specific branch' },
                ]}
              />
            </Grid>
            {branchScope === 'SPECIFIC_BRANCHES' ? (
              <Grid item xs={12} sm={6}>
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
            ) : null}
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
            {mutation.isPending ? 'Saving…' : 'Save user'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function UsersPage() {
  const { can } = useAuth();
  const { data: branches } = useBranches();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: ['users', params],
    queryFn: () =>
      userApi.list({
        ...params,
        role: params.role as UserRole | undefined,
        isActive: params.isActive === undefined ? undefined : params.isActive === 'true',
      }),
    placeholderData: (previous) => previous,
  });

  const openDialog = (user: CompanyUser | null) => {
    setEditing(user);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Roles decide permissions; branch scope decides which branches a user may act in"
        actions={
          can('USER_MANAGE') ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openDialog(null)}
            >
              New User
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
            placeholder="Search name or email"
          />
        }
      >
        <EnumFilter
          label="Role"
          value={params.role}
          values={USER_ROLES}
          onChange={(value) => setFilter('role', value)}
        />
        <SelectFilter
          label="Branch"
          value={params.branchId}
          onChange={(value) => setFilter('branchId', value)}
          options={(branches ?? []).map((branch) => ({ value: branch.id, label: branch.name }))}
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
        emptyDescription="No users match the current filters."
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (row) => (
              <>
                <Typography variant="body2" fontWeight={500}>
                  {row.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.email}
                </Typography>
              </>
            ),
          },
          { key: 'role', header: 'Role', render: (row) => humanise(row.role) },
          {
            key: 'scope',
            header: 'Branch scope',
            render: (row) => (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {row.branchScope === 'ALL_BRANCHES' ? (
                  <Chip size="small" color="primary" variant="outlined" label="All branches" />
                ) : (
                  <>
                    {row.branch ? (
                      <Chip size="small" variant="outlined" label={row.branch.name} />
                    ) : null}
                    {row.branches.map((branch) => (
                      <Chip key={branch.id} size="small" variant="outlined" label={branch.name} />
                    ))}
                  </>
                )}
              </Stack>
            ),
          },
          {
            key: 'permissions',
            header: 'Permissions',
            render: (row) => `${row.permissions.length} granted`,
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
          ...(can('USER_MANAGE')
            ? [
                {
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  render: (row: CompanyUser) => (
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

      <UserDialog
        user={editing}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
