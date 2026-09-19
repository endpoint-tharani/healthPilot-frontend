import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { statusTone, type ColorMode, type StatusTone } from '@/app/theme';

/**
 * A single "100 → 70" change, drawn as two values and an arrow: the old figure
 * struck through, the new one carried in the tone of what it means. Used
 * wherever a correction restates a quantity a document already posted.
 */
export function BeforeAfterValue({
  label,
  before,
  after,
  tone = 'primary',
  caption,
}: {
  label: string;
  before: React.ReactNode;
  after: React.ReactNode;
  tone?: StatusTone;
  caption?: string;
}) {
  const theme = useTheme();
  const mode = theme.palette.mode as ColorMode;
  const colours = statusTone(mode, tone);
  const unchanged = String(before) === String(after);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}
      >
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            textDecoration: unchanged ? 'none' : 'line-through',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {before}
        </Typography>
        {unchanged ? null : (
          <>
            <ArrowForwardIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1.5,
                border: `1px solid ${colours.border}`,
                bgcolor: colours.bg,
                color: colours.fg,
                fontWeight: 800,
                fontSize: 13.5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {after}
            </Box>
          </>
        )}
        {unchanged ? (
          <Typography variant="caption" color="text.disabled">
            unchanged
          </Typography>
        ) : null}
      </Stack>
      {caption ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {caption}
        </Typography>
      ) : null}
    </Paper>
  );
}
