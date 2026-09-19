import { Box, Button, Grid, Paper, Skeleton, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import { ErrorState } from '@/components/states';
import { PageHeader } from '@/components/PageHeader';

/** Skeleton in the shape of the document workspace, so nothing jumps on arrival. */
export function DocumentSkeleton() {
  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
        <Skeleton width={180} height={16} />
        <Skeleton width={260} height={38} />
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {[0, 1, 2, 3].map((index) => (
            <Grid item xs={6} lg={3} key={index}>
              <Skeleton width="60%" height={13} />
              <Skeleton width="85%" height={19} />
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {[0, 1, 2].map((index) => (
          <Grid item xs={12} sm={4} key={index}>
            <Skeleton variant="rounded" height={92} />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8.5}>
          <Skeleton variant="rounded" height={340} />
        </Grid>
        <Grid item xs={12} lg={3.5}>
          <Skeleton variant="rounded" height={340} />
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * The frame around a document workspace: a way back to the list, and the loading
 * and error states, so each feature page only describes its own document.
 */
export function DocumentPageFrame({
  backTo,
  backLabel,
  isLoading,
  error,
  onRetry,
  children,
}: {
  backTo: string;
  backLabel: string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Stack direction="row" sx={{ mb: 0.75 }}>
        <Button
          component={RouterLink}
          to={backTo}
          startIcon={<ArrowBackIcon />}
          size="small"
          // Pulled back by the button's own inline padding so its label starts on
          // the same vertical as the breadcrumb above it.
          sx={{ ml: -1.4 }}
        >
          {backLabel}
        </Button>
      </Stack>
      {isLoading ? (
        <DocumentSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        children
      )}
    </>
  );
}

/**
 * Heading frame for detail pages that are not ERP documents - a payment, for
 * instance, which has its own record type rather than a Document row.
 */
export function DetailShell({
  title,
  subtitle,
  backTo,
  backLabel,
  isLoading,
  error,
  onRetry,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backTo: string;
  backLabel: string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button
              component={RouterLink}
              to={backTo}
              startIcon={<ArrowBackIcon />}
              size="small"
              variant="outlined"
            >
              {backLabel}
            </Button>
            {actions}
          </>
        }
      />
      {isLoading ? (
        <DocumentSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        children
      )}
    </>
  );
}
