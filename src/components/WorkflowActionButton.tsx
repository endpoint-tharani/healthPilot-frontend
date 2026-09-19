import { useState } from 'react';
import { Button, type ButtonProps } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './ConfirmDialog';

export interface WorkflowActionButtonProps {
  label: string;
  /** Hidden entirely when the user lacks the permission for this transition. */
  permitted: boolean;
  /** Shown but disabled when the document status does not allow the transition. */
  enabled?: boolean;
  disabledHint?: string;
  color?: ButtonProps['color'];
  variant?: ButtonProps['variant'];
  icon?: React.ReactNode;
  confirmTitle: string;
  confirmDescription?: React.ReactNode;
  confirmLabel?: string;
  reason?: 'none' | 'optional' | 'required';
  reasonLabel?: string;
  action: (reason?: string) => Promise<unknown>;
  /** Query keys to invalidate on success, so lists and stock views stay accurate. */
  invalidateKeys?: unknown[][];
  onSuccess?: (result: unknown) => void;
}

/**
 * One button + confirmation + mutation + cache invalidation for every workflow
 * transition (submit, approve, reject, post, dispatch, receive, cancel).
 */
export function WorkflowActionButton({
  label,
  permitted,
  enabled = true,
  disabledHint,
  color = 'primary',
  variant = 'contained',
  icon,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  reason = 'none',
  reasonLabel,
  action,
  invalidateKeys = [],
  onSuccess,
}: WorkflowActionButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (value?: string) => action(value),
    onSuccess: (result) => {
      setOpen(false);
      for (const key of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      onSuccess?.(result);
    },
  });

  if (!permitted) {
    return null;
  }

  return (
    <>
      <Button
        size="small"
        variant={variant}
        color={color}
        startIcon={icon}
        disabled={!enabled}
        title={!enabled ? disabledHint : undefined}
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel ?? label}
        confirmColor={color === 'inherit' ? 'primary' : (color as 'primary')}
        reason={reason}
        reasonLabel={reasonLabel}
        busy={mutation.isPending}
        error={mutation.error}
        onCancel={() => setOpen(false)}
        onConfirm={(value) => mutation.mutate(value)}
      />
    </>
  );
}
