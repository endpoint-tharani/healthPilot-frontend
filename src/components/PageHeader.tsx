import { Box, Stack, Typography } from '@mui/material';

/**
 * The heading every module page opens with: what this screen is, one sentence of
 * context, and the actions that belong to it. Kept to one shape so the eye lands
 * in the same place on every page.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small uppercase label above the title, e.g. the module a page belongs to. */
  eyebrow?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'flex-end' }}
      spacing={1.5}
      sx={{ mb: 2 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography
            variant="caption"
            color="primary.main"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10.5 }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, maxWidth: 780 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
          alignItems="center"
          sx={{ flexShrink: 0 }}
        >
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
