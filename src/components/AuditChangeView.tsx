import { Box, Stack, Typography, useTheme } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { formatMoney, formatQuantity } from '@/utils/decimal';
import { humanise } from '@/utils/format';
import { paletteTokens, type ColorMode } from '@/app/theme';

/**
 * Turns a DocumentLog `changes` payload into before/after rows a pharmacist can
 * read. Nothing is invented: every value shown comes straight out of the stored
 * payload, only the field names and the layout are translated. Anything this
 * file cannot describe stays available verbatim behind "technical details".
 */

type Payload = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  accepted: 'Accepted quantity',
  damaged: 'Damaged quantity',
  missing: 'Missing quantity',
  acceptedQuantity: 'Accepted quantity',
  damagedQuantity: 'Damaged quantity',
  missingQuantity: 'Missing quantity',
  paidAmount: 'Paid amount',
  balanceAmount: 'Balance',
  disputedAmount: 'Disputed amount',
  totalAmount: 'Total',
  invoiceTotal: 'Invoice total',
  acceptedPayable: 'Payable (accepted)',
  creditAmount: 'Credit amount',
  allocatedAmount: 'Allocated amount',
  documentNumber: 'Document',
  correctionDocument: 'Correction document',
  creditNote: 'Credit note',
  payment: 'Payment',
  purchaseOrder: 'Purchase order',
  requirement: 'Requisition',
  corrects: 'Corrects',
  creditFor: 'Credit for',
  supplierRef: 'Supplier reference',
  paymentMethod: 'Payment method',
  patientRef: 'Patient reference',
  prescriptionRef: 'Prescription reference',
  sourceBranchId: 'Source branch',
  destinationBranchId: 'Destination branch',
  sourceBranch: 'Source branch',
  transfer: 'Stock transfer',
  lineNumber: 'Line',
};

/** Keys that are money rather than a plain quantity or label. */
const MONEY_KEYS = new Set([
  'paidAmount',
  'balanceAmount',
  'disputedAmount',
  'totalAmount',
  'invoiceTotal',
  'acceptedPayable',
  'creditAmount',
  'allocatedAmount',
]);

const QUANTITY_KEYS = new Set([
  'accepted',
  'damaged',
  'missing',
  'acceptedQuantity',
  'damagedQuantity',
  'missingQuantity',
  'quantity',
]);

/** Opaque identifiers carry no meaning on screen; the raw payload still has them. */
const HIDDEN_KEYS = new Set(['receiptLineId', 'lineNumber', 'sourceBranchId', 'destinationBranchId']);

const ARRAY_KEYS = ['lines', 'correctedLines', 'deltas'];

function label(key: string): string {
  return FIELD_LABELS[key] ?? humanise(key);
}

function display(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  const text = String(value);
  if (MONEY_KEYS.has(key)) {
    return formatMoney(text);
  }
  if (QUANTITY_KEYS.has(key)) {
    return formatQuantity(text);
  }
  // Enum-looking values read better sentence-cased; document numbers stay verbatim.
  return /^[A-Z][A-Z_]+$/.test(text) && text.includes('_') ? humanise(text) : text;
}

export interface ChangeRow {
  key: string;
  label: string;
  before?: string;
  after: string;
}

function isPlainObject(value: unknown): value is Payload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecordArray(value: unknown): Payload[] {
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

/**
 * Receipt corrections are the case worth pairing by hand: the log stores the
 * posted split under `old.lines` and the corrected split under
 * `new.correctedLines`, so line 1 of each pair becomes "100 → 70".
 */
function pairedLineRows(oldPayload: Payload, newPayload: Payload): ChangeRow[] {
  const before = asRecordArray(oldPayload.lines);
  const after = asRecordArray(newPayload.correctedLines);
  if (before.length === 0 || after.length === 0) {
    return [];
  }

  const rows: ChangeRow[] = [];
  after.forEach((corrected, index) => {
    const original = before[index];
    if (!original) {
      return;
    }
    const multiLine = after.length > 1;
    for (const key of ['accepted', 'damaged', 'missing']) {
      const from = display(key, original[key]);
      const to = display(key, corrected[key]);
      if (from === to) {
        continue;
      }
      rows.push({
        key: `${index}-${key}`,
        label: multiLine ? `Line ${index + 1} · ${label(key)}` : label(key),
        before: from,
        after: to,
      });
    }
  });
  return rows;
}

/** A single-sided list of line figures, e.g. what a receipt posted. */
function singleSidedLineRows(payload: Payload, arrayKey: string, prefix: string): ChangeRow[] {
  const rows: ChangeRow[] = [];
  asRecordArray(payload[arrayKey]).forEach((line, index) => {
    const multiLine = asRecordArray(payload[arrayKey]).length > 1;
    for (const [key, value] of Object.entries(line)) {
      if (HIDDEN_KEYS.has(key)) {
        continue;
      }
      rows.push({
        key: `${prefix}-${index}-${key}`,
        label: multiLine ? `Line ${index + 1} · ${label(key)}` : label(key),
        after: display(key, value),
      });
    }
  });
  return rows;
}

/** Everything the audit payload says, as before/after rows. */
export function describeChanges(changes: { old?: unknown; new?: unknown } | null): ChangeRow[] {
  if (!changes) {
    return [];
  }
  const oldPayload = isPlainObject(changes.old) ? changes.old : {};
  const newPayload = isPlainObject(changes.new) ? changes.new : {};

  const rows: ChangeRow[] = [];

  // Scalars present on either side.
  const keys = new Set([...Object.keys(oldPayload), ...Object.keys(newPayload)]);
  for (const key of keys) {
    if (ARRAY_KEYS.includes(key) || HIDDEN_KEYS.has(key)) {
      continue;
    }
    const before = oldPayload[key];
    const after = newPayload[key];
    if (isPlainObject(before) || isPlainObject(after) || Array.isArray(before) || Array.isArray(after)) {
      continue;
    }
    if (before !== undefined && after !== undefined) {
      const from = display(key, before);
      const to = display(key, after);
      if (from !== to) {
        rows.push({ key, label: label(key), before: from, after: to });
      }
      continue;
    }
    const only = after !== undefined ? after : before;
    if (only !== undefined) {
      rows.push({ key, label: label(key), after: display(key, only) });
    }
  }

  const paired = pairedLineRows(oldPayload, newPayload);
  if (paired.length > 0) {
    rows.push(...paired);
  } else {
    rows.push(...singleSidedLineRows(newPayload, 'lines', 'new'));
    rows.push(...singleSidedLineRows(newPayload, 'deltas', 'delta'));
    rows.push(...singleSidedLineRows(newPayload, 'correctedLines', 'corrected'));
  }

  return rows;
}

function ValueBox({ value, tone }: { value: string; tone: 'before' | 'after' }) {
  const theme = useTheme();
  const t = paletteTokens(theme.palette.mode as ColorMode);
  return (
    <Box
      sx={{
        px: 1,
        py: 0.4,
        borderRadius: 1.5,
        border: 1,
        borderColor: tone === 'after' ? 'primary.main' : 'divider',
        bgcolor: tone === 'after' ? t.accentSoft : 'transparent',
        color: tone === 'after' ? 'primary.dark' : 'text.secondary',
        fontWeight: tone === 'after' ? 700 : 500,
        fontSize: 12.5,
        textDecoration: tone === 'before' ? 'line-through' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </Box>
  );
}

/** Small before/after cards; the arrow only appears when there is a "before". */
export function AuditChangeView({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.75} sx={{ mt: 1 }}>
      {rows.map((row) => (
        <Stack
          key={row.key}
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
            {row.label}
          </Typography>
          {row.before !== undefined ? (
            <>
              <ValueBox value={row.before} tone="before" />
              <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            </>
          ) : null}
          <ValueBox value={row.after} tone="after" />
        </Stack>
      ))}
    </Stack>
  );
}
