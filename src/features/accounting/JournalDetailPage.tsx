import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import { accountingApi } from '@/api/accounting';
import { useAuth } from '@/auth/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KeyValue } from '@/components/KeyValue';
import { BlockSkeleton, ErrorState } from '@/components/states';
import { useToast } from '@/components/Toast';
import { formatMoney } from '@/utils/decimal';
import { documentPath, formatDate, formatDateTime, humanise } from '@/utils/format';
import { JournalStatusChip } from './JournalListPage';
import { MoneyCell, PrintButton, PrintStyles } from './reportShell';

/**
 * One posting in full: its lines, its totals, who raised it and what it was
 * raised for.
 *
 * A posted journal offers no edit and no delete anywhere on the page, because
 * neither is a lawful operation on accounting history. The only write is a
 * reversal, which states the correction as its own dated entry and leaves the
 * original standing.
 */
export function JournalDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const [reverseOpen, setReverseOpen] = useState(false);

  const query = useQuery({
    queryKey: ['accounting', 'journal', id],
    queryFn: () => accountingApi.journal(id),
    enabled: Boolean(id),
  });

  const reverse = useMutation({
    mutationFn: (reason: string) => accountingApi.reverseJournal(id, reason),
    onSuccess: (result) => {
      toast.success(
        result.alreadyPosted
          ? `This entry was already reversed by ${result.journalNumber}.`
          : `Reversing entry ${result.journalNumber} was posted.`
      );
      setReverseOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (error) => toast.fromError(error, 'The journal could not be reversed.'),
  });

  if (query.isLoading) {
    return <BlockSkeleton height={420} />;
  }
  if (query.error || !query.data) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Paper>
    );
  }

  const journal = query.data;
  const canReverse =
    journal.status === 'POSTED' && !journal.reversedBy && can('ACCOUNTING_POST');

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Journal entry"
        title={
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>
              {journal.journalNumber}
            </Box>
            <JournalStatusChip status={journal.status} />
          </Stack>
        }
        subtitle={journal.description}
        actions={
          <>
            <PrintButton />
            {canReverse ? (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<UndoOutlinedIcon />}
                onClick={() => setReverseOpen(true)}
                className="no-print"
              >
                Reverse
              </Button>
            ) : null}
          </>
        }
      />

      {journal.status === 'REVERSED' && journal.reversedBy ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This entry was reversed by{' '}
          <MuiLink
            component={RouterLink}
            to={`/accounting/journals/${journal.reversedBy.id}`}
            fontWeight={700}
          >
            {journal.reversedBy.journalNumber}
          </MuiLink>
          . It remains in the record: accounting history is corrected by a new entry, never by
          editing or deleting the original.
        </Alert>
      ) : null}

      {journal.reversalOf ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is a reversing entry cancelling{' '}
          <MuiLink
            component={RouterLink}
            to={`/accounting/journals/${journal.reversalOf.id}`}
            fontWeight={700}
          >
            {journal.reversalOf.journalNumber}
          </MuiLink>
          .
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <KeyValue label="Document date" value={formatDate(journal.documentDate)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KeyValue label="Event" value={humanise(journal.event)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KeyValue label="Branch" value={journal.branch?.name ?? 'Company level'} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KeyValue
              label="Source document"
              value={
                journal.sourceDocument ? (
                  <MuiLink
                    component={RouterLink}
                    to={documentPath(
                      journal.sourceDocument.documentType,
                      journal.sourceDocument.id
                    )}
                    fontWeight={700}
                  >
                    {journal.sourceDocument.documentNumber}
                  </MuiLink>
                ) : (
                  (journal.sourcePayment?.paymentNumber ?? '—')
                )
              }
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KeyValue
              label="Created by"
              value={`${journal.createdBy?.name ?? '—'} · ${formatDateTime(journal.createdAt)}`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KeyValue
              label="Posted by"
              value={
                journal.postedBy
                  ? `${journal.postedBy.name} · ${formatDateTime(journal.postedAt)}`
                  : 'Not posted'
              }
            />
          </Grid>
          <Grid item xs={12} sm={6} md={6}>
            <KeyValue
              label="Accounting event key"
              value={
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}
                >
                  {journal.sourceEventKey}
                </Typography>
              }
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}>#</TableCell>
                <TableCell sx={{ width: 90 }}>Code</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Account</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  Description
                </TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {journal.lines.map((line) => (
                <TableRow key={line.id} hover>
                  <TableCell>{line.lineNumber}</TableCell>
                  <TableCell
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontWeight: 700,
                      fontSize: 12.5,
                    }}
                  >
                    {line.ledger.code}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {line.ledger.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {line.ledger.head.code} · {line.ledger.head.name}
                    </Typography>
                    {/*
                      The subledger this line belongs to. Trade payables is one
                      control account for every supplier, so without the name here
                      a reader of the journal cannot tell whose liability moved.
                    */}
                    {line.supplier ? (
                      <Typography variant="caption" color="primary.main" display="block">
                        Supplier: {line.supplier.name}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="body2" color="text.secondary">
                      {line.description ?? '—'}
                    </Typography>
                  </TableCell>
                  <MoneyCell muted={line.debit === '0.00'}>
                    {line.debit === '0.00' ? '—' : formatMoney(line.debit)}
                  </MoneyCell>
                  <MoneyCell muted={line.credit === '0.00'}>
                    {line.credit === '0.00' ? '—' : formatMoney(line.credit)}
                  </MoneyCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ p: 2 }}
        >
          <Box sx={{ flex: 1 }}>
            <Chip
              size="small"
              color={journal.isBalanced ? 'success' : 'error'}
              label={
                journal.isBalanced
                  ? 'Balanced — debits equal credits'
                  : 'UNBALANCED — this entry does not balance'
              }
              sx={{ fontWeight: 700 }}
            />
          </Box>
          <Stack direction="row" spacing={4}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Total debit
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(journal.totalDebit)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Total credit
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(journal.totalCredit)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Paper>

      <ConfirmDialog
        open={reverseOpen}
        title={`Reverse ${journal.journalNumber}?`}
        description={
          <>
            A reversing entry will be posted with every debit and credit of this journal swapped,
            and this entry will be marked REVERSED. Nothing is edited or deleted — both entries
            stay in the record, and their net effect is nil.
          </>
        }
        confirmLabel="Post reversing entry"
        confirmColor="warning"
        reason="required"
        reasonLabel="Why is this being reversed?"
        busy={reverse.isPending}
        error={reverse.error}
        onCancel={() => setReverseOpen(false)}
        onConfirm={(reason) => reverse.mutate(reason ?? '')}
      />
    </>
  );
}
