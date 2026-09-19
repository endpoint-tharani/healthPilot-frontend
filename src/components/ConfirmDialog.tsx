import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { ApiError } from '@/api/errors';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  /** Adds a reason field; `required` blocks confirmation until it is filled. */
  reason?: 'none' | 'optional' | 'required';
  reasonLabel?: string;
  busy?: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

/**
 * Every state-changing ERP action (approve, reject, post, correct, dispatch,
 * receive, pay) is confirmed here, and captures the reason the audit trail keeps.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmColor = 'primary',
  reason = 'none',
  reasonLabel = 'Reason',
  busy = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [reasonValue, setReasonValue] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReasonValue('');
      setTouched(false);
    }
  }, [open]);

  const reasonMissing = reason === 'required' && reasonValue.trim().length < 3;
  const apiError = error instanceof ApiError ? error : null;

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {description ? (
          <DialogContentText component="div" sx={{ mb: reason === 'none' ? 0 : 2 }}>
            {description}
          </DialogContentText>
        ) : null}

        {reason !== 'none' ? (
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label={reasonLabel}
            required={reason === 'required'}
            value={reasonValue}
            onChange={(event) => setReasonValue(event.target.value)}
            onBlur={() => setTouched(true)}
            error={touched && reasonMissing}
            helperText={
              touched && reasonMissing
                ? 'A reason of at least 3 characters is required'
                : reason === 'optional'
                  ? 'Optional - stored on the document history'
                  : 'Stored on the document history'
            }
            disabled={busy}
          />
        ) : null}

        {apiError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {apiError.message}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          disabled={busy || reasonMissing}
          onClick={() => onConfirm(reasonValue.trim() ? reasonValue.trim() : undefined)}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
