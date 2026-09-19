import {
  Alert,
  Box,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { ApiError, describeFieldErrors } from '@/api/errors';

type BaseProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
} & Omit<TextFieldProps, 'name' | 'label' | 'control'>;

export function TextInput<T extends FieldValues>({
  control,
  name,
  label,
  startIcon,
  ariaLabel,
  ...rest
}: BaseProps<T> & { startIcon?: React.ReactNode; ariaLabel?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          label={label}
          fullWidth
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? rest.helperText}
          {...rest}
          InputProps={{
            ...(startIcon
              ? {
                  startAdornment: <InputAdornment position="start">{startIcon}</InputAdornment>,
                }
              : {}),
            ...rest.InputProps,
          }}
          // Inputs inside a line-items table take their name from the column
          // header, which a screen reader cannot associate on its own.
          inputProps={{ ...(ariaLabel ? { 'aria-label': ariaLabel } : {}), ...rest.inputProps }}
        />
      )}
    />
  );
}

export function SelectInput<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  ariaLabel,
  ...rest
}: BaseProps<T> & {
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          select
          label={label}
          fullWidth
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? rest.helperText}
          {...rest}
          SelectProps={{
            ...(ariaLabel ? { inputProps: { 'aria-label': ariaLabel } } : {}),
            ...rest.SelectProps,
          }}
        >
          {placeholder ? (
            <MenuItem value="">
              <em>{placeholder}</em>
            </MenuItem>
          ) : null}
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

/**
 * One group of fields in a form: a heading, a sentence saying what the group is
 * for, and the fields. Forms are built from these rather than one long column,
 * so a purchase order and a dispensing note are filled in the same rhythm.
 */
export function FormSection({
  title,
  description,
  children,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ mb: 2.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ px: 2.25, py: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle2">{title}</Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Box>
        {actions ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      <Divider />
      <Box sx={{ p: 2.25 }}>{children}</Box>
    </Paper>
  );
}

/** Surfaces the backend message, plus any per-field validation detail it returned. */
export function SubmitError({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }
  const apiError = error instanceof ApiError ? error : null;
  const detail = apiError ? describeFieldErrors(apiError) : null;

  return (
    <Alert severity="error" sx={{ mb: 2, alignItems: 'flex-start' }}>
      {apiError?.message ?? (error instanceof Error ? error.message : 'Unexpected error')}
      {detail ? <div style={{ marginTop: 4, fontSize: 12 }}>{detail}</div> : null}
    </Alert>
  );
}
