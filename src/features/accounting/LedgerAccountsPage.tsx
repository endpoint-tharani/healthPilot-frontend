import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { Chip, Link as MuiLink, Stack, Tooltip, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { accountingApi } from '@/api/accounting';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filters';
import { NatureChip } from './reportShell';

const NATURES = [
  { value: 'AS', label: 'Asset' },
  { value: 'LI', label: 'Liability' },
  { value: 'EQ', label: 'Equity' },
  { value: 'IN', label: 'Income' },
  { value: 'EX', label: 'Expense' },
];

/**
 * Every postable account, flat. The chart page shows where an account sits; this
 * one is for finding it and opening its general ledger.
 */
export function LedgerAccountsPage() {
  const [search, setSearch] = useState<string | undefined>();
  const [natureCode, setNatureCode] = useState<string | undefined>();

  const query = useQuery({
    queryKey: ['accounting', 'ledgers', { search, natureCode }],
    queryFn: () => accountingApi.ledgers({ search, natureCode }),
    placeholderData: (previous) => previous,
  });

  const activeFilterCount = natureCode ? 1 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Ledger Accounts"
        subtitle="The accounts a journal line can be posted to. Open one to see every movement on it."
      />

      <FilterBar
        search={
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search code or name…"
          />
        }
        onReset={() => setNatureCode(undefined)}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
      >
        <SelectFilter
          label="Nature"
          value={natureCode}
          onChange={setNatureCode}
          options={NATURES}
        />
      </FilterBar>

      <DataTable
        rows={query.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyDescription="No ledger accounts match the current filters."
        columns={[
          {
            key: 'code',
            header: 'Code',
            render: (row) => (
              <MuiLink
                component={RouterLink}
                to={`/accounting/general-ledger?ledgerId=${row.id}`}
                underline="hover"
                sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontWeight: 700,
                  fontSize: 12.5,
                }}
              >
                {row.code}
              </MuiLink>
            ),
          },
          {
            key: 'name',
            header: 'Account',
            render: (row) => (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="body2" fontWeight={600}>
                  {row.name}
                </Typography>
                {row.isDefault ? (
                  <Tooltip title="The account a head-level mapping resolves to">
                    <Chip
                      size="small"
                      label="default"
                      color="warning"
                      variant="outlined"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  </Tooltip>
                ) : null}
              </Stack>
            ),
          },
          {
            key: 'nature',
            header: 'Nature',
            render: (row) => <NatureChip code={row.nature.code} />,
          },
          {
            key: 'natureType',
            header: 'Nature type',
            render: (row) => (
              <Typography variant="caption" color="text.secondary">
                {row.natureType.name}
              </Typography>
            ),
            hideOnSmall: true,
          },
          {
            key: 'head',
            header: 'Head',
            render: (row) => (
              <Typography variant="body2">
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontFamily: 'ui-monospace, monospace', mr: 0.75 }}
                >
                  {row.head.code}
                </Typography>
                {row.head.name}
              </Typography>
            ),
          },
          {
            key: 'group',
            header: 'Group / sub group',
            render: (row) => row.subGroup?.name ?? row.group?.name ?? '—',
            hideOnSmall: true,
          },
          {
            key: 'balanceType',
            header: 'Balance',
            render: (row) => (
              <Chip
                size="small"
                variant="outlined"
                label={row.openingBalanceType}
                sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
              />
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <Chip
                size="small"
                variant="outlined"
                color={row.isActive ? 'success' : 'default'}
                label={row.isActive ? 'Active' : 'Inactive'}
                sx={{ height: 20, fontSize: 10.5 }}
              />
            ),
          },
          {
            key: 'locked',
            header: 'Locked',
            align: 'center',
            render: (row) =>
              row.isLocked ? (
                <Tooltip title="Locked by the reporting format — cannot be renamed or deleted">
                  <LockOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </Tooltip>
              ) : (
                <Typography variant="caption" color="text.disabled">
                  —
                </Typography>
              ),
          },
        ]}
      />
    </>
  );
}
