import { Button, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
      <Typography variant="h6">Page not found</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        The page you requested does not exist in this workspace.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained" size="small">
        Back to dashboard
      </Button>
    </Paper>
  );
}
