import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/api/errors';
import { AuthCardHeading, AuthField, AuthShell, AuthSubmitButton } from './AuthShell';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof schema>;

const EYEBROW = ['Multi-branch', 'Audit-ready', 'Role-based access'];

const BULLETS = [
  'Requirements, orders, receipts and corrections in one document register',
  'Damaged and missing stock kept out of usable inventory, always',
  'Every posting traceable through an append-only stock ledger',
];

const FACTS = [
  { value: 'Central warehouse', label: 'to every dispensing branch' },
  { value: 'Batch & expiry', label: 'tracked end to end' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.'
      );
    }
  });

  return (
    <AuthShell
      eyebrow={EYEBROW}
      headline="The pharmacy ERP that keeps your"
      headlineAccent="branches stocked"
      subline="One workspace for requirements, purchase orders, goods receipts, transfers, dispensing and corrections — with the stock ledger balancing behind every one of them."
      bullets={BULLETS}
      facts={FACTS}
      altCaption="New to HealthPilot?"
      altLabel="Create account"
      altTo="/signup"
      footnote="Built for multi-branch hospital pharmacy operations"
    >
      <AuthCardHeading
        title="Sign in"
        subtitle="Use your branch account to continue to the workspace."
      />

      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}

          <AuthField
            label="Work email"
            placeholder="you@hospital.com"
            type="email"
            required
            autoComplete="username"
            autoFocus
            errorText={errors.email?.message}
            {...register('email')}
          />

          <AuthField
            label="Password"
            placeholder="Your password"
            type="password"
            revealable
            required
            autoComplete="current-password"
            errorText={errors.password?.message}
            {...register('password')}
          />

          <AuthSubmitButton disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </AuthSubmitButton>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            Your session is tied to this browser and expires when you sign out.
          </Typography>

          <Typography variant="body2" color="text.secondary" textAlign="center">
            New to HealthPilot?{' '}
            <Box
              component={RouterLink}
              to="/signup"
              sx={{ color: 'primary.main', fontWeight: 600 }}
            >
              Create a company account
            </Box>
          </Typography>
        </Stack>
      </form>
    </AuthShell>
  );
}
