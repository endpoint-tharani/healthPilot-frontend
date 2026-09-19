import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Divider, Grid, Skeleton, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useParams } from 'react-router-dom';
import { correctionApi, documentApi } from '@/api/endpoints';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { BeforeAfterValue } from '@/components/BeforeAfter';
import { DocumentRefLink } from '@/components/DocumentChain';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/states';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { dec, formatQuantity, sumDecimals, type DecimalInput } from '@/utils/decimal';
import { formatDateTime } from '@/utils/format';
import type { DocumentDetail, DocumentLineItem } from '@/types/api';

/** The receipt this correction restates, from the recorded CORRECTS link. */
function correctedReceiptRef(correction: DocumentDetail) {
  return [...correction.links.outgoing, ...correction.links.incoming].find(
    (link) => link.linkType === 'CORRECTS'
  )?.document;
}

function signed(value: DecimalInput): string {
  const quantity = dec(value);
  return `${quantity.isNegative() ? '' : '+'}${formatQuantity(quantity)}`;
}

/**
 * The correction as a before/after statement. The original receipt is fetched so
 * the posted figures can be shown beside the corrected ones; the delta between
 * them is the quantity this correction actually wrote to the ledger. Nothing is
 * recomputed - original + delta is exactly what the backend posted.
 */
function BeforeAfterPanel({ correction }: { correction: DocumentDetail }) {
  const receiptRef = correctedReceiptRef(correction);

  const original = useQuery({
    queryKey: ['documents', receiptRef?.id],
    queryFn: () => documentApi.get(receiptRef!.id),
    enabled: Boolean(receiptRef?.id),
  });

  if (!receiptRef) {
    return null;
  }

  const originalLineById = new Map((original.data?.lineItems ?? []).map((line) => [line.id, line]));

  const pair = (line: DocumentLineItem) =>
    line.referenceLineItemId ? originalLineById.get(line.referenceLineItemId) : undefined;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle2">What changed</Typography>
          <Typography variant="caption" color="text.secondary">
            {original.data
              ? `Against receipt ${original.data.documentNumber}, posted by ${original.data.createdBy?.name ?? '—'} on ${formatDateTime(original.data.createdAt)}`
              : 'Against the receipt this correction was raised for'}
          </Typography>
        </Box>
        <DocumentRefLink document={receiptRef} />
      </Stack>

      {original.isError ? (
        <Alert severity="info">
          The original receipt is outside your branch scope, so only the delta recorded on this
          correction is shown.
        </Alert>
      ) : null}

      {original.isLoading ? (
        <Skeleton variant="rounded" height={140} />
      ) : (
        correction.lineItems.map((line, index) => {
          const before = pair(line);
          const product = line.product?.name ?? line.product.id;

          return (
            <Box key={line.id} sx={{ mt: index === 0 ? 0 : 2.5 }}>
              {index === 0 ? null : <Divider sx={{ mb: 2 }} />}
              <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1.25 }}>
                <Typography variant="body2" fontWeight={700}>
                  {product}
                </Typography>
                {line.product?.code ? (
                  <Typography variant="caption" color="text.secondary">
                    {line.product.code}
                  </Typography>
                ) : null}
                {line.batch ? (
                  <Typography variant="caption" color="text.secondary">
                    Batch {line.batch.batchNumber}
                  </Typography>
                ) : null}
              </Stack>

              {before ? (
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <BeforeAfterValue
                      label="Accepted"
                      tone="success"
                      before={formatQuantity(before.acceptedQuantity)}
                      after={formatQuantity(
                        dec(before.acceptedQuantity).plus(dec(line.acceptedQuantity))
                      )}
                      caption={`Ledger delta ${signed(line.acceptedQuantity)} usable`}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <BeforeAfterValue
                      label="Damaged"
                      tone="danger"
                      before={formatQuantity(before.damagedQuantity)}
                      after={formatQuantity(
                        dec(before.damagedQuantity).plus(dec(line.damagedQuantity))
                      )}
                      caption={`Ledger delta ${signed(line.damagedQuantity)} damaged`}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <BeforeAfterValue
                      label="Missing"
                      tone="warning"
                      before={formatQuantity(before.missingQuantity)}
                      after={formatQuantity(
                        dec(before.missingQuantity).plus(dec(line.missingQuantity))
                      )}
                      caption="Missing creates no stock"
                    />
                  </Grid>
                </Grid>
              ) : (
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <StatCard
                      label="Δ Accepted"
                      value={signed(line.acceptedQuantity)}
                      tone="success"
                      caption="Posted to usable stock"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <StatCard
                      label="Δ Damaged"
                      value={signed(line.damagedQuantity)}
                      tone="danger"
                      caption="Posted to damaged stock"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <StatCard
                      label="Δ Missing"
                      value={signed(line.missingQuantity)}
                      caption="No stock created"
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          );
        })
      )}

      {correction.lineItems.length === 0 ? (
        <EmptyState dense title="No corrected lines" />
      ) : null}
    </Box>
  );
}

export function CorrectionDetailPage() {
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['receipt-corrections', id],
    queryFn: () => correctionApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);

  const deltas = detail
    ? {
        accepted: sumDecimals(detail.lineItems.map((line) => line.acceptedQuantity)),
        damaged: sumDecimals(detail.lineItems.map((line) => line.damagedQuantity)),
        missing: sumDecimals(detail.lineItems.map((line) => line.missingQuantity)),
      }
    : null;

  return (
    <DocumentPageFrame
      backTo="/receipt-corrections"
      backLabel="All corrections"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail && deltas ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          noteLabel="Correction reason"
          quantityLabel="Net delta"
          overview={<BeforeAfterPanel correction={detail} />}
          facts={[
            {
              icon: <StorefrontOutlinedIcon fontSize="small" />,
              label: 'Branch',
              value: detail.branch?.name ?? '—',
            },
            {
              icon: <EditNoteIcon fontSize="small" />,
              label: 'Corrects',
              value: correctedReceiptRef(detail)?.documentNumber ?? '—',
            },
            {
              icon: <PersonOutlineIcon fontSize="small" />,
              label: 'Corrected by',
              value: detail.createdBy?.name ?? '—',
            },
            {
              icon: <ScheduleOutlinedIcon fontSize="small" />,
              label: 'Corrected at',
              value: formatDateTime(detail.createdAt),
            },
          ]}
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={12} sm={4}>
                <StatCard
                  label="Usable stock delta"
                  value={signed(deltas.accepted.toFixed(2))}
                  caption="Written to the ledger by this correction"
                  tone={deltas.accepted.isNegative() ? 'danger' : 'success'}
                  icon={<CheckCircleOutlineIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <StatCard
                  label="Damaged delta"
                  value={signed(deltas.damaged.toFixed(2))}
                  caption="Held separately, never dispensable"
                  tone={deltas.damaged.greaterThan(0) ? 'danger' : 'neutral'}
                  icon={<ReportProblemOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <StatCard
                  label="Missing delta"
                  value={signed(deltas.missing.toFixed(2))}
                  caption="Creates no stock at all"
                  tone={deltas.missing.greaterThan(0) ? 'warning' : 'neutral'}
                  icon={<HelpOutlineIcon fontSize="small" />}
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
