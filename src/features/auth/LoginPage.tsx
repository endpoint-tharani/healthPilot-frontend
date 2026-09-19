import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/api/errors';
import { AuthShell } from './AuthShell';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof schema>;

const HIGHLIGHTS = [
  'Requirements, orders, receipts and corrections in one document register',
  'Damaged and missing stock kept out of usable inventory, always',
  'Every posting traceable through an append-only stock ledger',
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
      headline="Multi-branch pharmacy operations, end to end."
      highlights={HIGHLIGHTS}
    >
      <Typography variant="h5" fontWeight={800}>
        Sign in
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Use your branch account to continue to the workspace.
      </Typography>

      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}

          <TextField
            label="Email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            fullWidth
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...register('email')}
          />

          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

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
