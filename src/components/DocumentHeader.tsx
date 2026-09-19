import { Box, Divider, Paper, Stack, Typography, useTheme } from '@mui/material';
import type { DocumentStatus } from '@/types/api';
import { DocumentStatusChip } from './StatusChip';
import { paletteTokens, type ColorMode } from '@/app/theme';

export interface DocumentFact {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function Fact({ icon, label, value }: DocumentFact) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
      {icon ? <Box sx={{ color: 'primary.main', display: 'flex', mt: '2px' }}>{icon}</Box> : null}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}
        >
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }} component="div">
          {value ?? '—'}
        </Typography>
      </Box>
    </Stack>
  );
}

/**
 * The identity block every ERP document opens with: what kind of document this
 * is, its number, the status the backend holds for it, the handful of facts that
 * identify it, and the workflow actions available on it. One shape for all eight
 * document types, so a user reads the same header wherever they are.
 */
export function DocumentHeader({
  documentTypeLabel,
  documentNumber,
  status,
  statusChip,
  facts,
  actions,
  note,
  noteLabel = 'Notes',
}: {
  documentTypeLabel: string;
  documentNumber: string;
  /** Document status, for records that have one. */
  status?: DocumentStatus;
  /** Replaces the status chip for records with a state of their own, e.g. a payment. */
  statusChip?: React.ReactNode;
  facts: DocumentFact[];
  actions?: React.ReactNode;
  note?: string | null;
  noteLabel?: string;
}) {
  const theme = useTheme();
  const t = paletteTokens(theme.palette.mode as ColorMode);

  return (
    <Paper variant="outlined" sx={{ mb: 2.5, overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, bgcolor: t.accentSoft }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="primary.dark"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}
            >
              {documentTypeLabel}
            </Typography>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 0.25 }}
            >
              <Typography variant="h5" component="h1" sx={{ letterSpacing: '-0.01em' }}>
                {documentNumber}
              </Typography>
              {statusChip ?? (status ? <DocumentStatusChip status={status} size="medium" /> : null)}
            </Stack>
          </Box>
          {actions ? (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            >
              {actions}
            </Stack>
          ) : null}
        </Stack>
      </Box>

      <Divider />

      <Box
        sx={{
          px: { xs: 2, md: 2.5 },
          py: 2,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: `repeat(${Math.min(facts.length, 4)}, minmax(0, 1fr))`,
          },
        }}
      >
        {facts.map((fact) => (
          <Fact key={fact.label} {...fact} />
        ))}
      </Box>

      {note ? (
        <>
          <Divider />
          <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.75 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}
            >
              {noteLabel}
            </Typography>
            <Typography variant="body2">{note}</Typography>
          </Box>
        </>
      ) : null}
    </Paper>
  );
}
