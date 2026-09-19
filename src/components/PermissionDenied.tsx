import { Box, Paper, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export function PermissionDenied({
  message = 'You do not have permission to view this module.',
}: {
  message?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 6 }}>
      <Box sx={{ textAlign: 'center' }}>
        <LockOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        <Typography variant="h6" sx={{ mt: 1 }}>
          Access restricted
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {message}
        </Typography>
      </Box>
    </Paper>
  );
}
