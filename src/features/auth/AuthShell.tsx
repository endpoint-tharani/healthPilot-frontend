import { Box, Paper, Stack, Typography } from '@mui/material';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { BRAND } from '@/app/theme';

/**
 * The split brand/form layout shared by sign-in and sign-up, so the two entry
 * points to the product cannot drift apart visually.
 */
export function AuthShell({
  headline,
  highlights,
  cardMaxWidth = 420,
  children,
}: {
  headline: string;
  highlights: string[];
  cardMaxWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        bgcolor: 'background.default',
      }}
    >
      {/* Brand panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          color: '#fff',
          // Flat brand blue: the product language is blue on white, and a login
          // screen is the first place that promise is either kept or broken.
          bgcolor: BRAND.blueDark,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,0.16)',
            }}
          >
            <LocalPharmacyIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
              HealthPilot
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Pharmacy ERP
            </Typography>
          </Box>
        </Stack>

        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ maxWidth: 460, lineHeight: 1.2 }}>
            {headline}
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 4 }}>
            {highlights.map((line) => (
              <Stack key={line} direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    mt: '7px',
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ opacity: 0.92, maxWidth: 420 }}>
                  {line}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Central warehouse and branch pharmacies on one document trail
        </Typography>
      </Box>

      {/* Form panel */}
      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 3, md: 6 } }}>
        <Paper
          variant="outlined"
          sx={{ width: '100%', maxWidth: cardMaxWidth, p: { xs: 3, md: 4 }, my: { md: 4 } }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ display: { md: 'none' }, mb: 2 }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <LocalPharmacyIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle1" fontWeight={800}>
              HealthPilot Pharmacy ERP
            </Typography>
          </Stack>

          {children}
        </Paper>
      </Box>
    </Box>
  );
}
