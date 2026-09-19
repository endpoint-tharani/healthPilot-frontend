import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Grid, Skeleton, Stack, Typography } from '@mui/material';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { useParams } from 'react-router-dom';
import { creditNoteApi, supplierInvoiceApi } from '@/api/endpoints';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { FinancialSummary } from '@/components/FinancialSummary';
import { DocumentRefLink } from '@/components/DocumentChain';
import { StatCard } from '@/components/StatCard';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { formatMoney } from '@/utils/decimal';
import type { DocumentDetail } from '@/types/api';

/** The invoice this note credits, from the recorded CREDIT_FOR link. */
function creditedInvoiceRef(creditNote: DocumentDetail) {
  return [...creditNote.links.outgoing, ...creditNote.links.incoming].find(
    (link) => link.linkType === 'CREDIT_FOR'
  )?.document;
}

/**
 * What this credit note does to the supplier invoice it was raised against. The
 * invoice's own `financials` are shown live, so the note is always read in the
 * context of the balance it reduced.
 */
function CreditImpactPanel({ creditNote }: { creditNote: DocumentDetail }) {
  const invoiceRef = creditedInvoiceRef(creditNote);

  const invoice = useQuery({
    queryKey: ['supplier-invoices', invoiceRef?.id],
    queryFn: () => supplierInvoiceApi.get(invoiceRef!.id),
    enabled: Boolean(invoiceRef?.id),
  });

  if (!invoiceRef) {
    return null;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle2">Effect on the supplier invoice</Typography>
          <Typography variant="caption" color="text.secondary">
            A credit note reduces what is payable; it is never treated as a payment
          </Typography>
        </Box>
        <DocumentRefLink document={invoiceRef} />
      </Stack>

      {invoice.isError ? (
        <Alert severity="info">The credited invoice is outside your branch scope.</Alert>
      ) : invoice.isLoading ? (
        <Skeleton variant="rounded" height={150} />
      ) : invoice.data ? (
        <Box sx={{ maxWidth: 440 }}>
          <FinancialSummary
            lines={[
              { label: 'Invoice total', value: invoice.data.financials.invoiceTotal },
              {
                label: 'Credited in total',
                value: invoice.data.financials.creditedAmount,
                negative: true,
                caption: 'All credit notes against this invoice',
              },
              { label: 'Paid', value: invoice.data.financials.paidAmount, ruleAbove: true },
              {
                label: 'Remaining payable',
                value: invoice.data.financials.outstandingBalance,
                emphasis: true,
              },
              {
                label: 'Allocatable now',
                value: invoice.data.financials.allocatableAmount,
              },
            ]}
          />
        </Box>
      ) : null}
    </Box>
  );
}

export function CreditNoteDetailPage() {
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['credit-notes', id],
    queryFn: () => creditNoteApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);
  const invoiceRef = detail ? creditedInvoiceRef(detail) : undefined;

  return (
    <DocumentPageFrame
      backTo="/credit-notes"
      backLabel="All credit notes"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          noteLabel="Reason for the credit"
          quantityLabel="Credited"
          overview={<CreditImpactPanel creditNote={detail} />}
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Credit amount"
                  value={`−${formatMoney(detail.totalAmount)}`}
                  caption="Reduces what is payable"
                  tone="warning"
                  icon={<ReceiptOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Net of tax"
                  value={formatMoney(detail.subtotal)}
                  caption={`Tax ${formatMoney(detail.taxAmount)}`}
                  icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Credits invoice"
                  value={invoiceRef?.documentNumber ?? '—'}
                  caption={invoiceRef ? 'Linked supplier invoice' : 'No invoice linked'}
                  icon={<ReceiptLongOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Lines credited"
                  value={detail.lineItems.length}
                  caption="Products on this note"
                  icon={<PaymentsOutlinedIcon fontSize="small" />}
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
