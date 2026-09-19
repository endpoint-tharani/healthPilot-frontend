import { Alert, Box, Skeleton, Stack, Typography } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { DocumentDetailLayout, DetailSection, type DocumentTab } from '@/components/DocumentDetailLayout';
import { DocumentHeader, type DocumentFact } from '@/components/DocumentHeader';
import { DocumentFlow } from '@/components/DocumentFlow';
import { DocumentChain } from '@/components/DocumentChain';
import { LineItemsTable } from '@/components/LineItemsTable';
import { InventoryMovementsTable, type MovementRow } from '@/components/InventoryMovementsTable';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { FinancialSummary, type FinancialLine } from '@/components/FinancialSummary';
import { PaymentAllocationsTable } from '@/components/PaymentAllocationsTable';
import { EmptyState } from '@/components/states';
import { dec } from '@/utils/decimal';
import { DOCUMENT_TYPE_LABELS, formatDate, formatDateTime } from '@/utils/format';
import type { DocumentChain as Chain } from '@/hooks/useDocumentChain';
import type { DocumentDetail } from '@/types/api';

/** The facts that identify a document, chosen by what the record actually carries. */
export function defaultFacts(detail: DocumentDetail): DocumentFact[] {
  const facts: DocumentFact[] = [];

  if (detail.sourceBranch || detail.destinationBranch) {
    facts.push({
      icon: <StorefrontOutlinedIcon fontSize="small" />,
      label: 'Route',
      value: `${detail.sourceBranch?.name ?? '—'} → ${detail.destinationBranch?.name ?? '—'}`,
    });
  } else {
    facts.push({
      icon: <StorefrontOutlinedIcon fontSize="small" />,
      label: 'Branch',
      value: detail.branch?.name ?? '—',
    });
  }

  if (detail.supplier) {
    facts.push({
      icon: <LocalShippingOutlinedIcon fontSize="small" />,
      label: 'Supplier',
      value: detail.supplier.name,
    });
  }

  if (detail.supplierRef) {
    facts.push({
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      label: 'Supplier reference',
      value: detail.supplierRef,
    });
  }

  facts.push({
    icon: <PersonOutlineIcon fontSize="small" />,
    label: 'Created by',
    value: (
      <>
        {detail.createdBy?.name ?? '—'}
        {detail.createdBy?.email ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {detail.createdBy.email}
          </Typography>
        ) : null}
      </>
    ),
  });

  facts.push({
    icon: <ScheduleOutlinedIcon fontSize="small" />,
    label: 'Created',
    value: formatDateTime(detail.createdAt),
  });

  if (detail.expectedDeliveryDate) {
    facts.push({
      icon: <EventOutlinedIcon fontSize="small" />,
      label: detail.documentType === 'STOCK_REQUIREMENT' ? 'Required by' : 'Expected',
      value: formatDate(detail.expectedDeliveryDate),
    });
  }

  return facts;
}

/** Money as the document itself stores it; optional figures appear only when set. */
export function documentTotals(detail: DocumentDetail): FinancialLine[] {
  const lines: FinancialLine[] = [
    { label: 'Subtotal', value: detail.subtotal },
    { label: 'Tax', value: detail.taxAmount },
    { label: 'Total', value: detail.totalAmount, emphasis: true, ruleAbove: true },
  ];
  if (dec(detail.disputedAmount).greaterThan(0)) {
    lines.push({ label: 'Disputed', value: detail.disputedAmount, negative: true });
  }
  if (dec(detail.paidAmount).greaterThan(0)) {
    lines.push({ label: 'Paid', value: detail.paidAmount });
  }
  if (dec(detail.balanceAmount).greaterThan(0)) {
    lines.push({ label: 'Outstanding', value: detail.balanceAmount, emphasis: true });
  }
  return lines;
}

function ActivitySkeleton() {
  return (
    <Stack spacing={2}>
      {[0, 1, 2].map((index) => (
        <Stack key={index} direction="row" spacing={1.5}>
          <Skeleton variant="rounded" width={30} height={30} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="55%" height={18} />
            <Skeleton width="80%" height={16} />
            <Skeleton width="40%" height={14} />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * The workspace shared by every ERP document. A feature page supplies what is
 * particular to its document - the workflow actions, the panel that explains its
 * own numbers - and this composes the parts every document has: identity header,
 * the recorded chain, lines, links, ledger movements, payments and the audit
 * timeline on the rail beside it.
 */
export function DocumentWorkspace({
  detail,
  chain,
  facts,
  actions,
  summary,
  overview,
  totals,
  movements,
  linesContent,
  paymentsContent,
  paymentsCount,
  extraTabs = [],
  quantityLabel,
  noteLabel,
  initialTabKey,
}: {
  detail: DocumentDetail;
  chain: Chain;
  facts?: DocumentFact[];
  actions?: React.ReactNode;
  /** KPI row between the header and the tabs. */
  summary?: React.ReactNode;
  /** Document-specific explanation, shown at the top of Overview. */
  overview?: React.ReactNode;
  /** Overrides the money block; pass null to hide it on a document that has none. */
  totals?: FinancialLine[] | null;
  /** Defaults to the rows this document itself posted. */
  movements?: MovementRow[];
  /** Replaces the standard line-items table, for documents that track fulfilment. */
  linesContent?: React.ReactNode;
  /** Replaces the standard allocations table, for documents paid through another. */
  paymentsContent?: React.ReactNode;
  paymentsCount?: number;
  extraTabs?: DocumentTab[];
  quantityLabel?: string;
  noteLabel?: string;
  /** Opens on a named tab, for a link that points at one section of the page. */
  initialTabKey?: string;
}) {
  const ledgerRows = movements ?? detail.inventoryTransactions;
  const moneyLines = totals === undefined ? documentTotals(detail) : totals;
  const auditHidden = detail.history === undefined;

  const tabs: DocumentTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      content: (
        <>
          <DetailSection
            first
            title="Document flow"
            subtitle="Every step the backend recorded as a DocumentLink; open one by clicking it"
          >
            {chain.isLoading ? (
              <Stack direction="row" spacing={1}>
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} variant="rounded" width={170} height={84} />
                ))}
              </Stack>
            ) : (
              <DocumentFlow nodes={chain.flowNodes} />
            )}
            {chain.partial ? (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                Part of this chain sits outside your branch scope, so only the documents you may
                read are shown.
              </Alert>
            ) : null}
          </DetailSection>

          {overview ? <DetailSection>{overview}</DetailSection> : null}

          {moneyLines && moneyLines.length > 0 ? (
            <DetailSection
              title="Financial summary"
              subtitle="Figures stored on this document by the backend"
            >
              <Box sx={{ maxWidth: 420 }}>
                <FinancialSummary lines={moneyLines} />
              </Box>
            </DetailSection>
          ) : null}
        </>
      ),
    },
    {
      key: 'lines',
      label: 'Line items',
      count: detail.lineItems.length,
      content: linesContent ??
        (detail.lineItems.length === 0 ? (
          <EmptyState
            dense
            title="No line items"
            description="This document carries no product lines."
          />
        ) : (
          <LineItemsTable
            lines={detail.lineItems}
            documentType={detail.documentType}
            quantityLabel={quantityLabel}
          />
        )),
    },
    ...extraTabs,
    {
      key: 'related',
      label: 'Related',
      count: detail.links.outgoing.length + detail.links.incoming.length,
      content: (
        <DetailSection
          first
          title="Linked documents"
          subtitle="Traceability recorded by the backend as DocumentLink rows"
        >
          <DocumentChain detail={detail} />
        </DetailSection>
      ),
    },
    {
      key: 'inventory',
      label: 'Inventory',
      count: ledgerRows.length,
      content:
        ledgerRows.length === 0 ? (
          <EmptyState
            dense
            title="No inventory movements"
            description="This document has not posted any stock transactions yet."
          />
        ) : (
          <InventoryMovementsTable
            movements={ledgerRows}
            showSourceDocument={Boolean(movements)}
          />
        ),
    },
    {
      key: 'payments',
      label: 'Payments',
      count: paymentsCount ?? detail.paymentAllocations.length,
      content: paymentsContent ??
        (detail.paymentAllocations.length === 0 ? (
          <EmptyState
            dense
            title="No payment allocations"
            description="No payment has been allocated to this document yet."
          />
        ) : (
          <PaymentAllocationsTable allocations={detail.paymentAllocations} />
        )),
    },
  ];

  return (
    <DocumentDetailLayout
      header={
        <DocumentHeader
          documentTypeLabel={DOCUMENT_TYPE_LABELS[detail.documentType]}
          documentNumber={detail.documentNumber}
          status={detail.status}
          facts={facts ?? defaultFacts(detail)}
          actions={actions}
          note={detail.notes}
          noteLabel={noteLabel ?? 'Notes'}
        />
      }
      summary={summary}
      tabs={tabs}
      initialTabKey={initialTabKey}
      activityTitle="Activity"
      activitySubtitle="Audit trail across this document chain"
      activity={
        auditHidden ? (
          <Alert severity="info">
            Your role does not include audit access, so activity is not shown.
          </Alert>
        ) : chain.isLoading ? (
          <ActivitySkeleton />
        ) : (
          <ActivityTimeline
            entries={chain.activity}
            emptyTitle="No activity recorded"
            emptyDescription="Actions appear here as the document moves through the workflow."
            maxHeight={680}
          />
        )
      }
    />
  );
}
