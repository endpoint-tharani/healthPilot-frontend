import { Box, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { statusTone, type ColorMode, type StatusTone } from '@/app/theme';

/**
 * Compact KPI tile. Values are always rendered from a backend figure the caller
 * passes in; the card itself never computes anything.
 */
export function StatCard({
  label,
  value,
  caption,
  tone = 'neutral',
  icon,
  loading,
  to,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  tone?: StatusTone;
  icon?: React.ReactNode;
  loading?: boolean;
  /** Turns the whole tile into a link to the list this figure came from. */
  to?: string;
}) {
  const theme = useTheme();
  const colours = statusTone(theme.palette.mode as ColorMode, tone);

  return (
    <Paper
      variant="outlined"
      {...(to ? { component: RouterLink, to } : {})}
      sx={{
        p: 1.75,
        height: '100%',
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        ...(to
          ? {
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
              '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
            }
          : {}),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}
          >
            {label}
          </Typography>
          {loading ? (
            <Skeleton width="60%" height={32} />
          ) : (
            <Typography
              variant="h5"
              component="div"
              sx={{
                mt: 0.25,
                fontVariantNumeric: 'tabular-nums',
                color: tone === 'neutral' ? 'text.primary' : colours.fg,
              }}
            >
              {value}
            </Typography>
          )}
          {caption ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
              {caption}
            </Typography>
          ) : null}
        </Box>
        {icon ? (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: colours.bg,
              color: colours.fg,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

/** The same tile under the name the rest of the design system uses for it. */
export const MetricCard = StatCard;
