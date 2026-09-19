import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import type { PageMeta } from '@/types/api';
import { EmptyState, ErrorState, TableSkeleton } from './states';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Hidden below the md breakpoint so tables stay usable on a tablet. */
  hideOnSmall?: boolean;
  /** Renders the figures with tabular numerals so columns line up. */
  numeric?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  /** Marks the row the surrounding page is currently showing. */
  isRowSelected?: (row: T) => boolean;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (limit: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  dense?: boolean;
}

/**
 * The single list surface used by every module: server-driven pagination plus the
 * four states a reviewer will look for (loading, error, empty, data). The loading
 * state is a skeleton in the shape of the table, never an empty-looking table.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  onRowClick,
  isRowSelected,
  meta,
  onPageChange,
  onRowsPerPageChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  dense = true,
}: DataTableProps<T>) {
  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <ErrorState error={error} onRetry={onRetry} />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size={dense ? 'small' : 'medium'} stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align ?? (column.numeric ? 'right' : 'left')}
                  sx={{
                    width: column.width,
                    ...(column.hideOnSmall ? { display: { xs: 'none', md: 'table-cell' } } : {}),
                  }}
                >
                  {column.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ border: 0, p: 0 }}>
                  <TableSkeleton columns={Math.min(columns.length, 6)} />
                </TableCell>
              </TableRow>
            ) : !rows || rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ border: 0 }}>
                  <EmptyState
                    title={emptyTitle ?? 'No records found'}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const selected = isRowSelected?.(row) ?? false;
                return (
                  <TableRow
                    key={rowKey(row)}
                    hover={Boolean(onRowClick)}
                    selected={selected}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    sx={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        align={column.align ?? (column.numeric ? 'right' : 'left')}
                        sx={{
                          ...(column.numeric ? { fontVariantNumeric: 'tabular-nums' } : {}),
                          ...(column.hideOnSmall
                            ? { display: { xs: 'none', md: 'table-cell' } }
                            : {}),
                        }}
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {meta && onPageChange ? (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <TablePagination
            component="div"
            count={meta.total}
            page={meta.total === 0 ? 0 : meta.page - 1}
            rowsPerPage={meta.limit}
            rowsPerPageOptions={[10, 20, 50, 100]}
            onPageChange={(_event, page) => onPageChange(page + 1)}
            onRowsPerPageChange={
              onRowsPerPageChange
                ? (event) => onRowsPerPageChange(Number(event.target.value))
                : undefined
            }
          />
        </Box>
      ) : null}
    </Paper>
  );
}
