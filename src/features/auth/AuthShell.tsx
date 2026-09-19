import { forwardRef, useId, useState } from 'react';
import {
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useColorMode } from '@/app/ColorModeContext';
import { BRAND } from '@/app/theme';

/**
 * The marketing-style hero layout shared by sign-in and sign-up: a floating top
 * bar, the product pitch on the left and the form card on the right, so the two
 * entry points to the product cannot drift apart visually.
 *
 * On phones the card comes first — a returning user should not have to scroll
 * past the pitch to sign in.
 */

interface Fact {
  value: string;
  label: string;
}

interface AuthShellProps {
  /** Small capitalised tags above the headline, joined with a middle dot. */
  eyebrow: string[];
  headline: string;
  /** Trailing words of the headline, in blue over the ECG underline. */
  headlineAccent: string;
  subline: string;
  bullets: string[];
  facts: Fact[];
  /** The other entry point, offered in the top bar. */
  altCaption: string;
  altLabel: string;
  altTo: string;
  footnote: string;
  cardMaxWidth?: number;
  children: React.ReactNode;
}

export function AuthShell({
  eyebrow,
  headline,
  headlineAccent,
  subline,
  bullets,
  facts,
  altCaption,
  altLabel,
  altTo,
  footnote,
  cardMaxWidth = 460,
  children,
}: AuthShellProps) {
  const { mode, toggle } = useColorMode();

  return (
    <Box
      sx={(theme) => ({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background:
          theme.palette.mode === 'light'
            ? `linear-gradient(180deg, #FFFFFF 0%, ${BRAND.blueSoft} 45%, #F4F7FC 100%)`
            : `linear-gradient(180deg, #0C1626 0%, ${BRAND.blueSoftDark} 45%, #0A1220 100%)`,
      })}
    >
      {/* Floating top bar */}
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        <Paper
          variant="outlined"
          sx={(theme) => ({
            px: { xs: 2, md: 3 },
            py: 1.5,
            borderRadius: 3,
            boxShadow:
              theme.palette.mode === 'light'
                ? '0 10px 30px rgba(14,31,51,0.07)'
                : '0 10px 30px rgba(0,0,0,0.5)',
          })}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  flexShrink: 0,
                }}
              >
                <LocalPharmacyIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15}>
                  HealthPilot
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', sm: 'block' } }}
                >
                  Multi-branch pharmacy ERP
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={{ xs: 1, md: 2 }} alignItems="center">
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: { xs: 'none', md: 'block' } }}
              >
                {altCaption}
              </Typography>
              <Tooltip title={mode === 'light' ? 'Switch to dark' : 'Switch to light'}>
                <IconButton size="small" onClick={toggle} aria-label="Toggle colour mode">
                  {mode === 'light' ? (
                    <DarkModeOutlinedIcon fontSize="small" />
                  ) : (
                    <LightModeOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Button
                component={RouterLink}
                to={altTo}
                variant="contained"
                sx={{ borderRadius: 999, px: { xs: 2, md: 3 }, minHeight: 40 }}
              >
                {altLabel}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>

      {/* Hero: pitch on the left, form card on the right */}
      <Container maxWidth="lg" sx={{ flex: 1, py: { xs: 4, md: 7 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1.05fr 0.95fr' },
            gap: { xs: 5, md: 6 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ order: { xs: 2, md: 1 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ width: 26, height: 2, bgcolor: 'primary.main', borderRadius: 1 }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'primary.main',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow.join(' · ')}
              </Typography>
            </Stack>

            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2.1rem', sm: '2.6rem', lg: '3.05rem' },
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.12,
                color: 'text.primary',
              }}
            >
              {headline}{' '}
              <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
                <Box component="span" sx={{ color: 'primary.main' }}>
                  {headlineAccent}
                </Box>
                <EcgUnderline />
              </Box>
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mt: 2.5, maxWidth: 480, fontSize: '1rem', lineHeight: 1.65 }}
            >
              {subline}
            </Typography>

            <Stack spacing={1.5} sx={{ mt: 3.5 }}>
              {bullets.map((line) => (
                <Stack key={line} direction="row" spacing={1.5} alignItems="flex-start">
                  <CheckIcon
                    fontSize="small"
                    sx={{ color: 'primary.main', mt: '1px', flexShrink: 0 }}
                  />
                  <Typography variant="body2" sx={{ fontSize: '0.92rem', maxWidth: 440 }}>
                    {line}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Stack
              direction="row"
              flexWrap="wrap"
              alignItems="center"
              sx={{ mt: 4, rowGap: 1, columnGap: 2 }}
            >
              {facts.map((fact, index) => (
                <Stack key={fact.value} direction="row" spacing={2} alignItems="center">
                  {index > 0 ? (
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: 'text.disabled',
                        display: { xs: 'none', sm: 'block' },
                      }}
                    />
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>
                      {fact.value}
                    </Box>{' '}
                    {fact.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              order: { xs: 1, md: 2 },
              width: '100%',
              maxWidth: cardMaxWidth,
              justifySelf: { md: 'end' },
              mx: { xs: 'auto', md: 0 },
            }}
          >
            <Paper
              variant="outlined"
              sx={(theme) => ({
                p: { xs: 2.5, md: 4 },
                borderRadius: 4,
                boxShadow:
                  theme.palette.mode === 'light'
                    ? '0 18px 50px rgba(14,31,51,0.10)'
                    : '0 18px 50px rgba(0,0,0,0.55)',
              })}
            >
              {children}
            </Paper>
          </Box>
        </Box>
      </Container>

      <Box sx={{ borderTop: 1, borderColor: 'divider', py: 2 }}>
        <Container maxWidth="lg">
          <Typography
            variant="caption"
            align="center"
            component="p"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {footnote}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

/**
 * The heartbeat rule under the accent words. Drawn in a wide viewBox and
 * stretched, so at real headline widths the horizontal scale stays near 1 and
 * the spikes keep their shape.
 */
function EcgUnderline() {
  return (
    <Box
      component="svg"
      viewBox="0 0 400 26"
      preserveAspectRatio="none"
      aria-hidden
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -6,
        width: '100%',
        height: 14,
        color: 'primary.main',
      }}
    >
      <path
        d="M0 9 H128 L146 21 L164 9 L182 21 L200 9 H400"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}

/** Heading block at the top of a form card. */
export function AuthCardHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" fontWeight={800} sx={{ fontSize: '1.45rem' }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

/** Two fields side by side on anything wider than a phone. */
export function AuthFieldRow({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
      {children}
    </Box>
  );
}

type AuthFieldProps = Omit<TextFieldProps, 'label' | 'helperText' | 'error' | 'variant'> & {
  label: string;
  /** Validation message; when present the field renders in its error state. */
  errorText?: string;
  /** Shown under the field while there is no error. */
  hint?: string;
  /** Adds the eye toggle and flips the input between password and text. */
  revealable?: boolean;
};

/**
 * Label above the input, placeholder inside it — the form pattern this screen is
 * built around. The ref is forwarded so `register()` from react-hook-form can be
 * spread straight onto it.
 */
export const AuthField = forwardRef<HTMLDivElement, AuthFieldProps>(function AuthField(
  { label, errorText, hint, revealable, required, type, InputProps, sx, id, ...rest },
  ref
) {
  const generatedId = useId();
  const fieldId = id ?? `${generatedId}field`;
  const [revealed, setRevealed] = useState(false);

  return (
    <Box>
      <Typography
        component="label"
        htmlFor={fieldId}
        sx={{
          display: 'block',
          mb: 0.75,
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'text.primary',
        }}
      >
        {label}
        {required ? (
          <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
            *
          </Box>
        ) : null}
      </Typography>
      <TextField
        {...rest}
        id={fieldId}
        ref={ref}
        required={required}
        type={revealable && revealed ? 'text' : type}
        fullWidth
        error={Boolean(errorText)}
        helperText={errorText ?? hint}
        InputProps={{
          ...InputProps,
          ...(revealable
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={() => setRevealed((shown) => !shown)}
                      aria-label={revealed ? 'Hide password' : 'Show password'}
                    >
                      {revealed ? (
                        <VisibilityOffOutlinedIcon fontSize="small" />
                      ) : (
                        <VisibilityOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }
            : null),
        }}
        sx={[
          {
            '& .MuiOutlinedInput-root': { borderRadius: 2.5, minHeight: 46 },
            '& .MuiOutlinedInput-input': { py: 1.4, fontSize: '0.9rem' },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    </Box>
  );
});

/** The full-width primary action at the foot of a form card. */
export function AuthSubmitButton({ children, sx, ...rest }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="submit"
      variant="contained"
      fullWidth
      {...rest}
      sx={[
        { borderRadius: 2.5, minHeight: 50, fontSize: '0.95rem', fontWeight: 700 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Button>
  );
}
