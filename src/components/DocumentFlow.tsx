import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Link as RouterLink } from 'react-router-dom';
import type { DocumentStatus } from '@/types/api';
import { DocumentStatusChip } from './StatusChip';
import { EmptyState } from './states';
import { paletteTokens, type ColorMode } from '@/app/theme';

/**
 * One step of the chain. A step is "reached" only when the backend actually
 * produced a record for it - a document number, or a ledger movement for the
 * steps that are not documents - and `to` is an existing route, so the flow
 * never invents a destination.
 */
export interface FlowNode {
  /** Step caption, e.g. "Goods Receipt". */
  label: string;
  /** Document or payment number once the step exists. */
  number?: string;
  status?: DocumentStatus;
  /** Existing route for this record, when there is one. */
  to?: string;
  /** Marks the record the user is currently looking at. */
  current?: boolean;
  /** For steps that are not documents: whether the event has happened. */
  done?: boolean;
  /** Sentence shown under a reached step that has no document number. */
  caption?: string;
  /** Replaces the default "Not raised yet" wording. */
  hint?: string;
  /** e.g. "+2 more" when the chain holds several documents of this kind. */
  extra?: string;
}

function FlowCard({ node }: { node: FlowNode }) {
  const theme = useTheme();
  const t = paletteTokens(theme.palette.mode as ColorMode);
  const reached = Boolean(node.number) || Boolean(node.done);

  const body = (
    <Paper
      variant="outlined"
      sx={{
        px: 1.75,
        py: 1.25,
        minWidth: 168,
        maxWidth: 220,
        height: '100%',
        borderColor: node.current ? 'primary.main' : 'divider',
        borderWidth: node.current ? 2 : 1,
        bgcolor: node.current ? t.accentSoft : 'background.paper',
        opacity: reached ? 1 : 0.6,
        borderStyle: reached ? 'solid' : 'dashed',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        ...(reached && !node.current && node.to
          ? { '&:hover': { borderColor: 'primary.main', boxShadow: 1 } }
          : {}),
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}
          noWrap
        >
          {node.label}
        </Typography>
        {reached ? (
          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', ml: 'auto' }} />
        ) : null}
      </Stack>

      {node.number ? (
        <>
          <Typography variant="body2" fontWeight={700} noWrap sx={{ mb: node.status ? 0.75 : 0 }}>
            {node.number}
          </Typography>
          {node.status ? <DocumentStatusChip status={node.status} /> : null}
        </>
      ) : node.done ? (
        <Typography variant="caption" color="success.main" fontWeight={700}>
          {node.caption ?? 'Done'}
        </Typography>
      ) : (
        <Typography variant="caption" color="text.disabled">
          {node.hint ?? 'Not raised yet'}
        </Typography>
      )}

      {node.extra ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {node.extra}
        </Typography>
      ) : null}
    </Paper>
  );

  if (!node.to || node.current) {
    return body;
  }

  return (
    <Box
      component={RouterLink}
      to={node.to}
      sx={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      {body}
    </Box>
  );
}

/**
 * The chain as the backend actually recorded it. Every reached card is a real
 * DocumentLink target, payment allocation or ledger movement - nothing is
 * inferred - and each one navigates to that record's existing detail page.
 */
export function DocumentFlow({ nodes }: { nodes: FlowNode[] }) {
  if (nodes.length === 0 || nodes.every((node) => !node.number && !node.done)) {
    return (
      <EmptyState
        dense
        title="No related documents"
        description="This document has no linked ERP documents yet."
      />
    );
  }

  return (
    <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
      <Stack direction="row" alignItems="stretch" sx={{ minWidth: 'max-content', py: 0.5 }}>
        {nodes.map((node, index) => (
          <Stack key={`${node.label}-${index}`} direction="row" alignItems="center">
            <FlowCard node={node} />
            {index < nodes.length - 1 ? (
              <ChevronRightIcon
                sx={{ fontSize: 20, color: 'text.disabled', mx: 0.75, flexShrink: 0 }}
              />
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
