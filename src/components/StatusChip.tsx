import { Chip, useTheme, type ChipProps } from '@mui/material';
import type { DocumentStatus, DocumentType, StockStatus } from '@/types/api';
import { statusTone, type ColorMode, type StatusTone } from '@/app/theme';
import { DOCUMENT_TYPE_LABELS, humanise } from '@/utils/format';

/**
 * One tone per meaning, shared by every surface:
 *
 *   neutral  not started / ended without effect   DRAFT, CANCELLED
 *   info     in flight, waiting on somebody       SUBMITTED, DISPATCHED
 *   primary  agreed, not yet delivered            APPROVED
 *   success  landed and settled                   POSTED, RECEIVED, FULFILLED, PAID, COMPLETED
 *   warning  landed but needs attention           CORRECTED, PARTIALLY_FULFILLED
 *   danger   refused or in dispute                REJECTED, DISCREPANT
 */
const DOCUMENT_STATUS_TONES: Record<DocumentStatus, StatusTone> = {
  DRAFT: 'neutral',
  CANCELLED: 'neutral',
  SUBMITTED: 'info',
  DISPATCHED: 'info',
  APPROVED: 'primary',
  POSTED: 'success',
  RECEIVED: 'success',
  FULFILLED: 'success',
  COMPLETED: 'success',
  PAID: 'success',
  CORRECTED: 'warning',
  PARTIALLY_FULFILLED: 'warning',
  REJECTED: 'danger',
  DISCREPANT: 'danger',
};

const STOCK_STATUS_TONES: Record<StockStatus, StatusTone> = {
  USABLE: 'success',
  DAMAGED: 'danger',
  QUARANTINED: 'warning',
  EXPIRED: 'neutral',
};

export function documentStatusTone(status: DocumentStatus): StatusTone {
  return DOCUMENT_STATUS_TONES[status] ?? 'neutral';
}

/** Soft tinted chip: a wash of the tone plus its readable foreground. */
export function ToneChip({
  tone,
  label,
  size = 'small',
  icon,
  sx,
}: {
  tone: StatusTone;
  label: string;
  size?: ChipProps['size'];
  icon?: ChipProps['icon'];
  sx?: ChipProps['sx'];
}) {
  const theme = useTheme();
  const colours = statusTone(theme.palette.mode as ColorMode, tone);

  return (
    <Chip
      label={label}
      size={size}
      icon={icon}
      sx={{
        bgcolor: colours.bg,
        color: colours.fg,
        border: `1px solid ${colours.border}`,
        fontWeight: 600,
        letterSpacing: '0.01em',
        '& .MuiChip-icon': { color: 'inherit', marginLeft: '6px' },
        ...sx,
      }}
    />
  );
}

export function DocumentStatusChip({
  status,
  size = 'small',
}: {
  status: DocumentStatus;
  size?: ChipProps['size'];
}) {
  return <ToneChip tone={documentStatusTone(status)} label={humanise(status)} size={size} />;
}

export function StockStatusChip({ status }: { status: StockStatus }) {
  return <ToneChip tone={STOCK_STATUS_TONES[status] ?? 'neutral'} label={humanise(status)} />;
}

export function DocumentTypeChip({ documentType }: { documentType: DocumentType }) {
  return <Chip label={DOCUMENT_TYPE_LABELS[documentType]} size="small" variant="outlined" />;
}
