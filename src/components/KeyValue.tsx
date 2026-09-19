import { Box, Grid, Typography } from '@mui/material';

/** A labelled fact: the smallest unit the document surfaces are built from. */
export function KeyValue({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={emphasis ? 700 : 500}
        component="div"
        sx={{ wordBreak: 'break-word' }}
      >
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

export function KeyValueGrid({
  items,
  columns = 4,
}: {
  items: { label: string; value: React.ReactNode; emphasis?: boolean }[];
  columns?: 2 | 3 | 4;
}) {
  const span = 12 / columns;
  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={6} sm={4} md={span} key={item.label}>
          <KeyValue label={item.label} value={item.value} emphasis={item.emphasis} />
        </Grid>
      ))}
    </Grid>
  );
}
