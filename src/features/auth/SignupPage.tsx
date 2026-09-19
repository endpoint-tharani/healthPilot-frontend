import { useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError, describeFieldErrors } from '@/api/errors';
import { AuthShell } from './AuthShell';

/**
 * Mirrors the backend signup contract (`POST /api/auth/signup`). The server
 * re-validates all of it; this copy exists so the wizard can reject a step
 * before the user reaches the end of it.
 */
const entityCode = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(40, 'Use at most 40 characters')
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only');

const entityName = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(160, 'Use at most 160 characters');

const branchSchema = z.object({
  code: entityCode,
  name: entityName,
  type: z.enum(['CENTRAL_WAREHOUSE', 'BRANCH']),
  address: z.string().trim().max(255, 'Use at most 255 characters'),
});

const schema = z
  .object({
    adminName: entityName,
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Use at most 128 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string().min(1, 'Confirm the password'),
    companyName: entityName,
    companyCode: entityCode,
    branches: z.array(branchSchema).min(1).max(20),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }

    const codes = values.branches.map((b) => b.code.trim().toUpperCase());
    codes.forEach((code, index) => {
      if (code && codes.indexOf(code) !== index) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['branches', index, 'code'],
          message: 'Branch codes must be unique',
        });
      }
    });
  });

type SignupValues = z.infer<typeof schema>;

const HIGHLIGHTS = [
  'One tenant per company: branches, stock and documents stay isolated',
  'You start as the company admin, with access to every branch',
  'Add products, suppliers and users as soon as you are in',
];

const STEPS = ['Your account', 'Your company', 'Your branches'] as const;

/** Fields validated before each step will let the user move on. */
const STEP_FIELDS: Path<SignupValues>[][] = [
  ['adminName', 'email', 'password', 'confirmPassword'],
  ['companyName', 'companyCode'],
  ['branches'],
];

/** Mirrors the backend derivation, so the suggested code is the one it would pick. */
function companyCodeFromName(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug ? `COMP-${slug}` : '';
}

/** Maps a backend body path such as `admin.email` onto the flat form field. */
const SERVER_FIELD_MAP: Record<string, Path<SignupValues>> = {
  'admin.email': 'email',
  'admin.name': 'adminName',
  'admin.password': 'password',
  'company.name': 'companyName',
  'company.code': 'companyCode',
  branches: 'branches',
};

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  /** Once the code is edited by hand, the company name stops overwriting it. */
  const codeEdited = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    trigger,
    setValue,
    setError,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      adminName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      companyCode: '',
      branches: [
        {
          code: 'BR-CENTRAL',
          name: 'Central Pharmacy Warehouse',
          type: 'CENTRAL_WAREHOUSE',
          address: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'branches' });
  const branchValues = watch('branches');

  const summary = useMemo(
    () => ({
      branchCount: branchValues.length,
      dispensingBranches: branchValues.filter((b) => b.type === 'BRANCH').length,
    }),
    [branchValues]
  );

  async function handleNext() {
    setFormError(null);
    const valid = await trigger(STEP_FIELDS[activeStep], { shouldFocus: true });
    if (valid) {
      setActiveStep((step) => step + 1);
    }
  }

  function handleBack() {
    setFormError(null);
    setActiveStep((step) => Math.max(0, step - 1));
  }

  /** Keeps the suggested company code in step with the name until it is edited. */
  function handleCompanyNameChange(value: string) {
    if (!codeEdited.current) {
      setValue('companyCode', companyCodeFromName(value), { shouldValidate: false });
    }
  }

  /** Steps are validated on the way through, but a later edit can invalidate an
   *  earlier one, so a failed submit returns the user to the step at fault. */
  function focusFirstInvalidStep(fieldErrors: Record<string, unknown>) {
    const step = STEP_FIELDS.findIndex((group) =>
      group.some((field) => field in fieldErrors)
    );
    if (step >= 0) {
      setActiveStep(step);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signup({
        company: { name: values.companyName, code: values.companyCode },
        admin: { name: values.adminName, email: values.email, password: values.password },
        branches: values.branches.map((branch) => ({
          code: branch.code,
          name: branch.name,
          type: branch.type,
          ...(branch.address ? { address: branch.address } : {}),
        })),
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError('Unable to create the account. Please try again.');
        return;
      }

      // Surface server-side field errors on the field that produced them, and
      // send the user back to the step that owns it.
      let firstStep: number | null = null;
      for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
        const field = SERVER_FIELD_MAP[path];
        if (!field) {
          continue;
        }
        setError(field, { type: 'server', message: messages.join(', ') });
        const step = STEP_FIELDS.findIndex((group) => group.includes(field));
        if (step >= 0 && (firstStep === null || step < firstStep)) {
          firstStep = step;
        }
      }

      // A duplicate email or company code comes back as a 409 with no field map.
      if (firstStep === null && error.isConflict) {
        const conflictField: Path<SignupValues> = /email|account/i.test(error.message)
          ? 'email'
          : 'companyCode';
        setError(conflictField, { type: 'server', message: error.message });
        firstStep = STEP_FIELDS.findIndex((group) => group.includes(conflictField));
      }

      if (firstStep !== null && firstStep >= 0) {
        setActiveStep(firstStep);
      }
      setFormError(describeFieldErrors(error) ?? error.message);
    }
  }, (fieldErrors) => {
    focusFirstInvalidStep(fieldErrors as Record<string, unknown>);
    setFormError('Some details still need attention. Please review the highlighted fields.');
  });

  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <AuthShell
      headline="Set your pharmacy network up in three steps."
      highlights={HIGHLIGHTS}
      cardMaxWidth={560}
    >
      <Typography variant="h5" fontWeight={800}>
        Create your company
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        This sets up the company, its branches and your admin account in one go.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/*
        One form across all three steps: the hidden steps stay mounted so their
        values survive navigation and the final submit sends the whole payload.
      */}
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}

          <Box hidden={activeStep !== 0}>
            <Stack spacing={2}>
              <TextField
                label="Your name"
                required
                autoComplete="name"
                fullWidth
                error={Boolean(errors.adminName)}
                helperText={errors.adminName?.message}
                {...register('adminName')}
              />
              <TextField
                label="Work email"
                type="email"
                required
                autoComplete="username"
                fullWidth
                error={Boolean(errors.email)}
                helperText={errors.email?.message ?? 'You will sign in with this address.'}
                {...register('email')}
              />
              <TextField
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                fullWidth
                error={Boolean(errors.password)}
                helperText={
                  errors.password?.message ??
                  'At least 8 characters, with an uppercase letter, a lowercase letter and a number.'
                }
                {...register('password')}
              />
              <TextField
                label="Confirm password"
                type="password"
                required
                autoComplete="new-password"
                fullWidth
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </Stack>
          </Box>

          <Box hidden={activeStep !== 1}>
            <Stack spacing={2}>
              <TextField
                label="Company name"
                required
                fullWidth
                error={Boolean(errors.companyName)}
                helperText={errors.companyName?.message}
                {...register('companyName', {
                  onChange: (event) => handleCompanyNameChange(event.target.value),
                })}
              />
              <TextField
                label="Company code"
                required
                fullWidth
                error={Boolean(errors.companyCode)}
                helperText={
                  errors.companyCode?.message ??
                  'Suggested from the company name. It must be unique and cannot be changed later.'
                }
                {...register('companyCode', {
                  onChange: () => {
                    codeEdited.current = true;
                  },
                })}
              />
              <Alert severity="info">
                You will be the company admin, with access to every branch and permission to
                invite the rest of your team.
              </Alert>
            </Stack>
          </Box>

          <Box hidden={activeStep !== 2}>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Goods are received into the central pharmacy warehouse and transferred out to the
                branches that dispense them. You can add more branches later.
              </Typography>

              {fields.map((field, index) => {
                const isWarehouse = branchValues[index]?.type === 'CENTRAL_WAREHOUSE';
                const branchErrors = errors.branches?.[index];
                return (
                  <Box
                    key={field.id}
                    sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 1.5 }}
                    >
                      <Chip
                        size="small"
                        label={isWarehouse ? 'Central pharmacy warehouse' : 'Dispensing branch'}
                        color={isWarehouse ? 'primary' : 'default'}
                      />
                      {isWarehouse ? (
                        <Tooltip title="Every network needs exactly one central warehouse">
                          <Typography variant="caption" color="text.secondary">
                            Required
                          </Typography>
                        </Tooltip>
                      ) : (
                        <IconButton
                          size="small"
                          aria-label={`Remove branch ${index}`}
                          onClick={() => remove(index)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>

                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                          label="Branch code"
                          required
                          fullWidth
                          error={Boolean(branchErrors?.code)}
                          helperText={branchErrors?.code?.message}
                          {...register(`branches.${index}.code` as const)}
                        />
                        <TextField
                          label="Branch name"
                          required
                          fullWidth
                          error={Boolean(branchErrors?.name)}
                          helperText={branchErrors?.name?.message}
                          {...register(`branches.${index}.name` as const)}
                        />
                      </Stack>
                      <TextField
                        label="Address (optional)"
                        fullWidth
                        error={Boolean(branchErrors?.address)}
                        helperText={branchErrors?.address?.message}
                        {...register(`branches.${index}.address` as const)}
                      />
                      <input type="hidden" {...register(`branches.${index}.type` as const)} />
                    </Stack>
                  </Box>
                );
              })}

              {typeof errors.branches?.message === 'string' ? (
                <Alert severity="error">{errors.branches.message}</Alert>
              ) : null}

              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  append({
                    code: `BR-${String.fromCharCode(64 + fields.length)}`,
                    name: `Branch ${String.fromCharCode(64 + fields.length)}`,
                    type: 'BRANCH',
                    address: '',
                  })
                }
                disabled={fields.length >= 20}
              >
                Add branch
              </Button>

              <Divider />

              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  Ready to create
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getValues('companyName') || 'Your company'} · {summary.branchCount} branch
                  {summary.branchCount === 1 ? '' : 'es'} (1 warehouse,{' '}
                  {summary.dispensingBranches} dispensing) · admin{' '}
                  {getValues('email') || 'you'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
            <Button onClick={handleBack} disabled={activeStep === 0 || isSubmitting} fullWidth>
              Back
            </Button>
            {isLastStep ? (
              <Button type="submit" variant="contained" disabled={isSubmitting} fullWidth>
                {isSubmitting ? 'Creating…' : 'Create company'}
              </Button>
            ) : (
              <Button onClick={handleNext} variant="contained" fullWidth>
                Continue
              </Button>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" textAlign="center">
            Already have an account?{' '}
            <Box component={RouterLink} to="/login" sx={{ color: 'primary.main', fontWeight: 600 }}>
              Sign in
            </Box>
          </Typography>
        </Stack>
      </form>
    </AuthShell>
  );
}
