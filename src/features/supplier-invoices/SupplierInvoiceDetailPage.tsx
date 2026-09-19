import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Grid, Typography } from '@mui/material';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { supplierInvoiceApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { FinancialSummary, type FinancialLine } from '@/components/FinancialSummary';
import { StatCard } from '@/components/StatCard';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { dec, formatMoney } from '@/utils/decimal';
import type { InvoiceFinancials } from '@/types/api';

/**
 * The invoice position, in the order an accountant reads it: what was claimed,
 * what the receipts actually accepted, what was credited back, what has been
 * paid and what is still owed. Every figure is `financials`, calculated by the
 * backend - the UI does no invoice arithmetic beyond the open-dispute
 * subtraction it labels as such.
 */
function invoiceLines(financials: InvoiceFinancials): FinancialLine[] {
  const lines: FinancialLine[] = [
    { label: 'Invoice total claimed', value: financials.invoiceTotal },
    {
      label: 'Payable on accepted stock',
      value: financials.acceptedPayable,
      caption: 'What the goods receipts accepted',
    },
  ];

  if (dec(financials.disputedAmount).greaterThan(0)) {
    lines.push({
      label: 'Disputed',
      value: financials.disputedAmount,
      negative: true,
      caption: 'Claimed but not accepted',
    });
  }
  if (dec(financials.creditedAmount).greaterThan(0)) {
    lines.push({
      label: 'Credit notes',
      value: financials.creditedAmount,
      negative: true,
      caption: 'Raised against this invoice',
    });
  }

  lines.push(
    { label: 'Paid', value: financials.paidAmount, ruleAbove: true },
    { label: 'Outstanding balance', value: financials.outstandingBalance, emphasis: true },
    {
      label: 'Allocatable now',
      value: financials.allocatableAmount,
      caption: 'Disputed value cannot be settled until a credit note clears it',
    }
  );

  return lines;
}

export function SupplierInvoiceDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();

  const query = useQuery({
    queryKey: ['supplier-invoices', id],
    queryFn: () => supplierInvoiceApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);
  const financials = detail?.financials;
  const openDispute = financials
    ? dec(financials.disputedAmount).minus(dec(financials.creditedAmount))
    : dec(0);

  const actions = detail ? (
    <>
      {can('CREDIT_NOTE_CREATE') && openDispute.greaterThan(0) ? (
        <Button
          component={RouterLink}
          to={`/credit-notes/new?supplierInvoiceId=${detail.id}`}
          size="small"
          variant="contained"
          color="warning"
          startIcon={<ReceiptOutlinedIcon />}
        >
          Raise credit note
        </Button>
      ) : null}
      {can('PAYMENT_CREATE') && dec(detail.financials.allocatableAmount).greaterThan(0) ? (
        <Button
          component={RouterLink}
          to={`/payments/new?invoiceId=${detail.id}`}
          size="small"
          variant="contained"
          startIcon={<PaymentsOutlinedIcon />}
        >
          Pay invoice
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <DocumentPageFrame
      backTo="/supplier-invoices"
      backLabel="All supplier invoices"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail && financials ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          actions={actions}
          quantityLabel="Invoiced"
          totals={null}
          overview={
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
                Invoice position
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Calculated by the backend from the stock actually accepted, the credits raised and
                the payments allocated
              </Typography>
              <Box sx={{ maxWidth: 480, mt: 1.5 }}>
                <FinancialSummary lines={invoiceLines(financials)} />
              </Box>
              {openDispute.greaterThan(0) ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {formatMoney(openDispute)} of {detail.documentNumber} is disputed and not yet
                  credited. A payment cannot settle disputed value until a credit note clears it.
                </Alert>
              ) : null}
            </Box>
          }
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Invoice"
                  value={formatMoney(financials.invoiceTotal)}
                  caption="Claimed by the supplier"
                  icon={<ReceiptLongOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Credited"
                  value={`−${formatMoney(financials.creditedAmount)}`}
                  caption="Credit notes against this invoice"
                  tone={dec(financials.creditedAmount).greaterThan(0) ? 'warning' : 'neutral'}
                  icon={<ReceiptOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Paid"
                  value={formatMoney(financials.paidAmount)}
                  caption="Allocated from payments"
                  tone={dec(financials.paidAmount).greaterThan(0) ? 'success' : 'neutral'}
                  icon={<PaymentsOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Outstanding"
                  value={formatMoney(financials.outstandingBalance)}
                  caption={
                    openDispute.greaterThan(0)
                      ? `${formatMoney(openDispute)} of it disputed`
                      : 'Nothing in dispute'
                  }
                  tone={
                    dec(financials.outstandingBalance).greaterThan(0)
                      ? openDispute.greaterThan(0)
                        ? 'danger'
                        : 'warning'
                      : 'success'
                  }
                  icon={
                    openDispute.greaterThan(0) ? (
                      <GavelOutlinedIcon fontSize="small" />
                    ) : (
                      <AccountBalanceWalletOutlinedIcon fontSize="small" />
                    )
                  }
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
