import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import { accountingApi } from '@/api/accounting';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, TableSkeleton } from '@/components/states';
import { SearchFilter } from '@/components/filters';
import { NatureChip, PrintStyles } from './reportShell';
import type { ChartNode } from '@/types/accounting';

/** Indent per level, so the hierarchy reads down the left edge of the Code column. */
const INDENT = 18;

const LEVEL_LABEL: Record<ChartNode['level'], string> = {
  NATURE: 'Nature',
  NATURE_TYPE: 'Nature Type',
  HEAD: 'Head',
  GROUP: 'Group',
  SUB_GROUP: 'Sub Group',
  LEDGER: 'Ledger',
};

interface FlatRow {
  node: ChartNode;
  depth: number;
  hasChildren: boolean;
}

/**
 * Walks the tree into the rows currently visible, honouring which branches the
 * user has collapsed.
 *
 * A search matches a node by code or name and keeps its ancestors, so a hit deep
 * in the chart is shown where it actually sits rather than as a detached row -
 * "4101 Sales" is only meaningful under Income / Revenue from Operations.
 */
function flatten(
  nodes: ChartNode[],
  collapsed: Set<string>,
  term: string,
  depth = 0
): FlatRow[] {
  const rows: FlatRow[] = [];

  for (const node of nodes) {
    const selfMatches =
      term === '' ||
      node.code.toLowerCase().includes(term) ||
      node.name.toLowerCase().includes(term);

    // A node that matches brings its whole subtree with it, so searching for a
    // head shows the accounts under it rather than the caption on its own.
    const childTerm = selfMatches ? '' : term;
    const childRows = flatten(node.children, collapsed, childTerm, depth + 1);

    if (!selfMatches && childRows.length === 0) {
      continue;
    }

    rows.push({ node, depth, hasChildren: node.children.length > 0 });

    // While searching, a matching branch opens regardless of collapse state: a hit
    // hidden inside a branch the user closed earlier would look like no result.
    if (term !== '' || !collapsed.has(node.code)) {
      rows.push(...childRows);
    }
  }

  return rows;
}

/**
 * The company's chart of accounts as the reporting format defines it:
 * Nature to Nature Type to Head to Group to Sub Group to Ledger.
 *
 * Read-only. Locked masters are marked and carry no edit affordance at all,
 * rather than offering one that fails: the reporting format owns those codes, and
 * a report that resolves captions by code changes meaning if one is renamed.
 */
export function ChartOfAccountsPage() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string | undefined>();

  const query = useQuery({
    queryKey: ['accounting', 'chart-of-accounts'],
    queryFn: () => accountingApi.chartOfAccounts(),
  });

  const rows = useMemo(
    () => flatten(query.data?.tree ?? [], collapsed, (search ?? '').trim().toLowerCase()),
    [query.data, collapsed, search]
  );

  const toggle = (code: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const counts = query.data?.counts;

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Accounting"
        title="Chart of Accounts"
        subtitle="The reporting hierarchy every posting is classified under, exactly as the reporting format defines it."
      />

      {query.data && !query.data.templateKey ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Accounting has not been initialised for this company yet, so there is no chart to show.
        </Alert>
      ) : null}

      {query.data?.templateKey ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip
            size="small"
            color="primary"
            label={`${query.data.templateKey} ${query.data.templateVersion ?? ''}`.trim()}
          />
          {counts ? (
            <>
              <Chip size="small" variant="outlined" label={`${counts.natures} natures`} />
              <Chip size="small" variant="outlined" label={`${counts.natureTypes} nature types`} />
              <Chip size="small" variant="outlined" label={`${counts.heads} heads`} />
              <Chip size="small" variant="outlined" label={`${counts.groups} groups`} />
              <Chip size="small" variant="outlined" label={`${counts.subGroups} sub groups`} />
              <Chip size="small" variant="outlined" label={`${counts.ledgers} ledgers`} />
            </>
          ) : null}
        </Stack>
      ) : null}

      <Box sx={{ mb: 1.5, maxWidth: 340 }} className="no-print">
        <SearchFilter
          value={search}
          onChange={setSearch}
          placeholder="Find a code or account name…"
        />
      </Box>

      {query.error ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto', maxHeight: '70vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 300 }}>Code</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Parent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Locked</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ border: 0, p: 0 }}>
                      <TableSkeleton columns={6} rows={12} />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {search
                          ? `Nothing in the chart matches “${search}”.`
                          : 'The chart of accounts is empty.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ node, depth, hasChildren }) => {
                    const isLedger = node.level === 'LEDGER';
                    const isOpen = !collapsed.has(node.code);
                    return (
                      <TableRow key={node.level + ':' + node.code} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" alignItems="center" spacing={0.25}>
                            <Box sx={{ width: depth * INDENT, flexShrink: 0 }} />
                            {hasChildren ? (
                              <IconButton
                                size="small"
                                onClick={() => toggle(node.code)}
                                aria-label={isOpen ? 'Collapse' : 'Expand'}
                                sx={{ p: 0.25 }}
                              >
                                {isOpen ? (
                                  <ExpandMoreIcon sx={{ fontSize: 17 }} />
                                ) : (
                                  <ChevronRightIcon sx={{ fontSize: 17 }} />
                                )}
                              </IconButton>
                            ) : (
                              <Box sx={{ width: 22, flexShrink: 0 }} />
                            )}
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                fontWeight: isLedger ? 600 : 500,
                                fontSize: 12.5,
                              }}
                            >
                              {node.code}
                            </Typography>
                            {node.isDefault ? (
                              <Tooltip title="The account a head-level mapping resolves to">
                                <StarRateRoundedIcon
                                  sx={{ fontSize: 15, color: 'warning.main', ml: 0.25 }}
                                />
                              </Tooltip>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={isLedger ? 600 : 400}>
                            {node.name}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {node.level === 'NATURE' ? (
                            <NatureChip code={node.code} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {LEVEL_LABEL[node.level]}
                              {isLedger && node.openingBalanceType
                                ? ` · ${node.openingBalanceType}`
                                : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            display: { xs: 'none', md: 'table-cell' },
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: 12,
                            color: 'text.secondary',
                          }}
                        >
                          {node.parentCode ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={node.isActive ? 'success' : 'default'}
                            label={node.isActive ? 'Active' : 'Inactive'}
                            sx={{ height: 20, fontSize: 10.5 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {node.isLocked ? (
                            <Tooltip title="Locked by the reporting format — cannot be renamed or deleted">
                              <LockOutlinedIcon
                                sx={{ fontSize: 16, color: 'text.secondary', verticalAlign: 'middle' }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Locked accounts belong to the reporting format. Reports resolve captions by code, so
        renaming one would change what an already-published statement means.
      </Typography>
    </>
  );
}
