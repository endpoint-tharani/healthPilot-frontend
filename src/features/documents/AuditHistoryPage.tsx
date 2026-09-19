import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Divider, Grid, Paper, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { documentApi } from '@/api/endpoints';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import {
  BranchFilter,
  DateFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from '@/components/filters';
import { DocumentStatusChip, DocumentTypeChip } from '@/components/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, documentPath, formatDateTime } from '@/utils/format';
import type { DocumentSummary, DocumentType } from '@/types/api';

/**
 * Audit browser over the document register: pick a document, read the append-only
 * DocumentLog for it from `/api/documents/:id/history`. Nothing is aggregated or
 * cached client-side - each history is fetched from the backend on demand, and
 * rendered as the same human-readable timeline used on the document itself.
 */
export function AuditHistoryPage() {
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams({
    limit: 10,
  });
  const [selected, setSelected] = useState<DocumentSummary | null>(null);

  const documents = useQuery({
    queryKey: ['documents', 'audit', params],
    queryFn: () =>
      documentApi.list({
        ...params,
        documentType: params.documentType as DocumentType | undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    placeholderData: (previous) => previous,
  });

  const history = useQuery({
    queryKey: ['documents', selected?.id, 'history'],
    queryFn: () => documentApi.history(selected!.id),
    enabled: Boolean(selected?.id),
  });

  return (
    <>
      <PageHeader
        title="Audit / History"
        subtitle="Who changed what, when, and why — straight from the append-only document log"
      />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Search document number"
          />
        }
      >
        <SelectFilter
          label="Document type"
          value={params.documentType}
          onChange={(value) => setFilter('documentType', value)}
          options={DOCUMENT_TYPES.map((type) => ({
            value: type,
            label: DOCUMENT_TYPE_LABELS[type],
          }))}
          width={200}
        />
        <BranchFilter value={params.branchId} onChange={(value) => setFilter('branchId', value)} />
        <DateFilter
          label="From"
          value={params.fromDate}
          onChange={(value) => setFilter('fromDate', value)}
        />
        <DateFilter
          label="To"
          value={params.toDate}
          onChange={(value) => setFilter('toDate', value)}
        />
      </FilterBar>

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} lg={5}>
          <DataTable
            rows={documents.data?.data}
            rowKey={(row) => row.id}
            isLoading={documents.isLoading}
            error={documents.error}
            onRetry={() => void documents.refetch()}
            onRowClick={(row) => setSelected(row)}
            isRowSelected={(row) => selected?.id === row.id}
            meta={documents.data?.meta}
            onPageChange={setPage}
            onRowsPerPageChange={setLimit}
            emptyDescription="No documents match the current filters."
            columns={[
              {
                key: 'documentNumber',
                header: 'Document',
                render: (row) => (
                  <Stack spacing={0.25}>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      color={selected?.id === row.id ? 'primary.main' : 'text.primary'}
                    >
                      {row.documentNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(row.createdAt)}
                    </Typography>
                  </Stack>
                ),
              },
              {
                key: 'documentType',
                header: 'Type',
                render: (row) => <DocumentTypeChip documentType={row.documentType} />,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <DocumentStatusChip status={row.status} />,
              },
            ]}
          />
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper variant="outlined" sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
              sx={{ px: 2.25, py: 1.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <HistoryOutlinedIcon fontSize="small" color="primary" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {selected ? `History of ${selected.documentNumber}` : 'History'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selected
                      ? 'Action, user, timestamp, before/after values and the reason given'
                      : 'Select a document to read its audit trail'}
                  </Typography>
                </Box>
              </Stack>
              {selected ? (
                <Button
                  component={RouterLink}
                  to={documentPath(selected.documentType, selected.id)}
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  sx={{ flexShrink: 0 }}
                >
                  Open
                </Button>
              ) : null}
            </Stack>
            <Divider />

            <Box sx={{ p: 2.25 }}>
              {!selected ? (
                <EmptyState
                  title="No document selected"
                  description="Pick a document on the left to see every recorded action, with the original payload one click away."
                />
              ) : history.isLoading ? (
                <LoadingState label="Loading history…" rows={5} />
              ) : history.isError ? (
                <ErrorState error={history.error} onRetry={() => void history.refetch()} />
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    The audit log is append-only: posted documents are never edited, they are
                    corrected or credited by a new document.
                  </Alert>
                  <ActivityTimeline entries={history.data?.history} />
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}
