import { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Link as RouterLink } from 'react-router-dom';
import type { DocumentHistoryEntry, DocumentRef, DocumentType } from '@/types/api';
import { DOCUMENT_TYPE_LABELS, documentPath, formatDateTime } from '@/utils/format';
import { paletteTokens, statusTone, type ColorMode, type StatusTone } from '@/app/theme';
import { AuditChangeView, describeChanges } from './AuditChangeView';
import { EmptyState } from './states';

/** A history entry plus the document it was recorded against. */
export interface ActivityEntry extends DocumentHistoryEntry {
  document?: DocumentRef;
}

type ActivityGroup = 'documents' | 'approvals' | 'inventory' | 'corrections' | 'payments';

interface ActionMeta {
  icon: React.ReactNode;
  tone: StatusTone;
  group: ActivityGroup;
  /** Headline, given the document the entry belongs to. */
  title: (documentType?: DocumentType) => string;
}

const noun = (documentType?: DocumentType) =>
  documentType ? DOCUMENT_TYPE_LABELS[documentType] : 'Document';

const ACTION_META: Record<string, ActionMeta> = {
  CREATE: {
    icon: <AddCircleOutlineIcon fontSize="small" />,
    tone: 'neutral',
    group: 'documents',
    title: (t) => `${noun(t)} created`,
  },
  SUBMIT: {
    icon: <SendOutlinedIcon fontSize="small" />,
    tone: 'info',
    group: 'approvals',
    title: (t) => `${noun(t)} submitted`,
  },
  APPROVE: {
    icon: <CheckCircleOutlineIcon fontSize="small" />,
    tone: 'primary',
    group: 'approvals',
    title: (t) => `${noun(t)} approved`,
  },
  REJECT: {
    icon: <BlockIcon fontSize="small" />,
    tone: 'danger',
    group: 'approvals',
    title: (t) => `${noun(t)} rejected`,
  },
  CANCEL: {
    icon: <BlockIcon fontSize="small" />,
    tone: 'neutral',
    group: 'documents',
    title: (t) => `${noun(t)} cancelled`,
  },
  POST: {
    icon: <Inventory2OutlinedIcon fontSize="small" />,
    tone: 'success',
    group: 'inventory',
    title: (t) => `${noun(t)} posted`,
  },
  CORRECT: {
    icon: <AutorenewIcon fontSize="small" />,
    tone: 'warning',
    group: 'corrections',
    title: (t) => `${noun(t)} corrected`,
  },
  DISPATCH: {
    icon: <LocalShippingOutlinedIcon fontSize="small" />,
    tone: 'info',
    group: 'inventory',
    title: () => 'Stock dispatched',
  },
  RECEIVE: {
    icon: <MoveToInboxIcon fontSize="small" />,
    tone: 'success',
    group: 'inventory',
    title: () => 'Stock received',
  },
  PAYMENT_ALLOCATED: {
    icon: <PaymentsOutlinedIcon fontSize="small" />,
    tone: 'success',
    group: 'payments',
    title: () => 'Payment allocated',
  },
  CREDIT_APPLIED: {
    icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    tone: 'warning',
    group: 'payments',
    title: () => 'Credit note applied',
  },
  FULFILMENT_UPDATED: {
    icon: <TrendingUpIcon fontSize="small" />,
    tone: 'info',
    group: 'documents',
    title: () => 'Fulfilment updated',
  },
  TRANSFER_ALLOCATED: {
    icon: <LocalShippingOutlinedIcon fontSize="small" />,
    tone: 'info',
    group: 'inventory',
    title: () => 'Internal stock allocated',
  },
};

const FALLBACK_META: ActionMeta = {
  icon: <HistoryIcon fontSize="small" />,
  tone: 'neutral',
  group: 'documents',
  title: () => 'Activity recorded',
};

const FILTERS: { value: 'all' | ActivityGroup; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'documents', label: 'Documents' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'payments', label: 'Payments' },
  { value: 'corrections', label: 'Corrections' },
  { value: 'approvals', label: 'Approvals' },
];

function metaFor(action: string): ActionMeta {
  return ACTION_META[action] ?? FALLBACK_META;
}

/**
 * The verbatim audit payload, one click behind the human sentence. Business users
 * never see JSON; an auditor or a developer can always read exactly what was
 * stored, and copy it.
 */
function TechnicalDetailsDialog({
  entry,
  onClose,
}: {
  entry: ActivityEntry | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = paletteTokens(theme.palette.mode as ColorMode);
  const [copied, setCopied] = useState(false);

  const payload = entry
    ? JSON.stringify(
        {
          id: entry.id,
          action: entry.action,
          document: entry.document?.documentNumber,
          user: entry.user,
          createdAt: entry.createdAt,
          reason: entry.reason,
          changes: entry.changes,
        },
        null,
        2
      )
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the payload is still selectable on screen */
    }
  };

  return (
    <Dialog open={Boolean(entry)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Technical details
        <Typography variant="caption" color="text.secondary" display="block" fontWeight={400}>
          Raw DocumentLog payload, exactly as stored
        </Typography>
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          size="small"
          aria-label="Close technical details"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
          <Button
            size="small"
            startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />}
            onClick={() => void copy()}
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </Stack>
        <Box
          component="pre"
          tabIndex={0}
          sx={{
            m: 0,
            p: 1.5,
            fontSize: 12,
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
            lineHeight: 1.55,
            bgcolor: t.code,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            maxHeight: 420,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {payload}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ActivityItem({
  entry,
  isLast,
  onShowRaw,
}: {
  entry: ActivityEntry;
  isLast: boolean;
  onShowRaw: (entry: ActivityEntry) => void;
}) {
  const theme = useTheme();
  const meta = metaFor(entry.action);
  const colours = statusTone(theme.palette.mode as ColorMode, meta.tone);
  const rows = useMemo(() => describeChanges(entry.changes), [entry.changes]);

  return (
    <Stack direction="row" spacing={1.5} sx={{ position: 'relative' }}>
      {/* Rail + node */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <Avatar
          sx={{
            width: 30,
            height: 30,
            bgcolor: colours.bg,
            color: colours.fg,
            border: `1px solid ${colours.border}`,
          }}
          variant="rounded"
        >
          {meta.icon}
        </Avatar>
        {!isLast ? (
          <Box sx={{ flex: 1, width: '2px', bgcolor: 'divider', mt: 0.5, minHeight: 16 }} />
        ) : null}
      </Box>

      <Box sx={{ pb: isLast ? 0 : 2.5, minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" fontWeight={700}>
            {meta.title(entry.document?.documentType)}
          </Typography>
          {entry.document ? (
            <MuiLink
              component={RouterLink}
              to={documentPath(entry.document.documentType, entry.document.id)}
              underline="hover"
              variant="caption"
              fontWeight={700}
            >
              {entry.document.documentNumber}
            </MuiLink>
          ) : null}
        </Stack>

        {rows.length > 0 ? <AuditChangeView rows={rows} /> : null}

        {entry.reason ? (
          <Box
            sx={{
              mt: 1,
              px: 1.25,
              py: 0.75,
              borderLeft: 3,
              borderColor: 'primary.light',
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block">
              Reason
            </Typography>
            <Typography variant="body2">{entry.reason}</Typography>
          </Box>
        ) : null}

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          <Typography variant="caption" fontWeight={600}>
            {entry.user?.name ?? 'System'}
          </Typography>
          {entry.user?.email ? (
            <Typography variant="caption" color="text.secondary">
              {entry.user.email}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.disabled">
            ·
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(entry.createdAt)}
          </Typography>
          {entry.changes ? (
            <Tooltip title="Show the raw audit payload">
              <Button
                size="small"
                startIcon={<CodeOutlinedIcon sx={{ fontSize: 14 }} />}
                onClick={() => onShowRaw(entry)}
                sx={{ minWidth: 0, py: 0, px: 0.75, fontSize: 11.5, fontWeight: 600 }}
              >
                Technical details
              </Button>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}

/**
 * Chat-style audit feed. Every line comes from DocumentLog - action, actor,
 * timestamp, reason and the before/after payload - rendered as a sentence
 * instead of JSON. The original payload stays one click away so an auditor
 * never loses the verbatim record.
 */
export function ActivityTimeline({
  entries,
  emptyTitle = 'No activity recorded',
  emptyDescription = 'Actions appear here as the document moves through the workflow.',
  searchable = true,
  maxHeight,
}: {
  entries: ActivityEntry[] | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  searchable?: boolean;
  maxHeight?: number | string;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | ActivityGroup>('all');
  const [rawEntry, setRawEntry] = useState<ActivityEntry | null>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (entries ?? []).filter((entry) => {
      const meta = metaFor(entry.action);
      if (filter !== 'all' && meta.group !== filter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        meta.title(entry.document?.documentType),
        entry.action,
        entry.reason ?? '',
        entry.user?.name ?? '',
        entry.user?.email ?? '',
        entry.document?.documentNumber ?? '',
        entry.changes ? JSON.stringify(entry.changes) : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [entries, filter, search]);

  if (!entries || entries.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Box>
      {searchable ? (
        <Stack spacing={1.25} sx={{ mb: 2 }}>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity…"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {FILTERS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                size="small"
                onClick={() => setFilter(option.value)}
                variant={filter === option.value ? 'filled' : 'outlined'}
                color={filter === option.value ? 'primary' : 'default'}
              />
            ))}
          </Stack>
        </Stack>
      ) : null}

      <Collapse in={visible.length === 0} unmountOnExit>
        <EmptyState
          title="Nothing matches"
          description="No activity matches the current search or filter."
        />
      </Collapse>

      <Box sx={maxHeight ? { maxHeight, overflowY: 'auto', pr: 0.5 } : undefined}>
        <Stack>
          {visible.map((entry, index) => (
            <ActivityItem
              key={entry.id}
              entry={entry}
              isLast={index === visible.length - 1}
              onShowRaw={setRawEntry}
            />
          ))}
        </Stack>
      </Box>

      <TechnicalDetailsDialog entry={rawEntry} onClose={() => setRawEntry(null)} />
    </Box>
  );
}
