/**
 * Data render smoke test: pulls real documents, ledger rows and stock from the
 * running backend and renders the components that display them, so the
 * data-dependent render paths (line items, links, movements, history, tables) are
 * exercised with genuine payloads rather than fixtures.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from '@/app/theme';
import { DataTable, type Column } from '@/components/DataTable';
import { LineItemsTable } from '@/components/LineItemsTable';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { DocumentChain } from '@/components/DocumentChain';
import { StockStatusChip } from '@/components/StatusChip';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { buildChain } from '@/hooks/useDocumentChain';
import { AuditChangeView, describeChanges } from '@/components/AuditChangeView';
import { DocumentFlow } from '@/components/DocumentFlow';
import { InventoryMovementsTable } from '@/components/InventoryMovementsTable';
import { DocumentHeader } from '@/components/DocumentHeader';
import {
  FulfilmentProgress,
  FulfilmentStats,
  fulfilmentTotals,
} from '@/features/requirements/FulfilmentSummary';
import { RequirementItems } from '@/features/requirements/RequirementItems';
import { ChainFinancialSummary, ChainPayments } from '@/features/requirements/FinancialSummary';
import {
  SourcingContextPanel,
  SourcingOpportunityBanner,
  opportunityFromAnalysis,
  opportunityFromAvailability,
} from '@/features/requirements/SourcingOpportunity';
import {
  branchColumn,
  createdByColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  subtotalColumn,
  supplierColumn,
  taxColumn,
  totalColumn,
  transferBranchesColumn,
  typeColumn,
} from '@/features/documents/documentColumns';
import { formatMoney, formatQuantity, dec, type Decimal } from '@/utils/decimal';
import type {
  DocumentDetail,
  DocumentSummary,
  LedgerRow,
  Payment,
  RequirementAvailability,
  RequirementSourcingAnalysis,
  StockRow,
} from '@/types/api';

// Overridable so the harness can be pointed at an API that is not on the
// default port, which is what running it beside another instance requires.
const BASE = process.env.SMOKE_API ?? 'http://localhost:4000/api';

async function api<T>(token: string, path: string): Promise<T> {
  const response = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!body.success) {
    throw new Error(`${path}: ${body.message}`);
  }
  return body.data as T;
}

function wrap(node: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{node}</MemoryRouter>
    </ThemeProvider>
  );
}

let failures = 0;

function check(label: string, render: () => string, expectations: string[] = []) {
  try {
    const html = render();
    for (const expectation of expectations) {
      if (!html.includes(expectation)) {
        throw new Error(`expected output to contain "${expectation}"`);
      }
    }
    console.log(`PASS ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${label}: ${(error as Error).message}`);
  }
}

async function main() {
  const loginResponse = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@healthpilot.ai', password: 'Password123!' }),
  });
  const login = await loginResponse.json();
  if (!login.success) {
    throw new Error(`login failed: ${login.message}`);
  }
  const token = login.data.accessToken as string;

  const documents = await api<DocumentSummary[]>(token, '/documents?limit=50&sortOrder=asc');
  if (documents.length === 0) {
    throw new Error('no documents found - run the scenario script first');
  }

  // Document register / list columns, with real rows.
  const registerColumns: Column<DocumentSummary>[] = [
    numberColumn,
    typeColumn,
    statusColumn,
    branchColumn,
    supplierColumn,
    dateColumn,
    subtotalColumn,
    taxColumn,
    totalColumn,
    createdByColumn,
    transferBranchesColumn,
  ];
  check(
    'DataTable with register columns',
    () =>
      wrap(
        <DataTable
          columns={registerColumns}
          rows={documents}
          rowKey={(row) => row.id}
          meta={{ page: 1, limit: 50, total: documents.length, totalPages: 1 }}
          onPageChange={() => undefined}
        />
      ),
    [documents[0].documentNumber]
  );

  /**
   * Figures the scenario must surface verbatim, so a formatting regression in the
   * money or quantity helpers fails the run rather than passing silently.
   */
  const EXPECTED_TEXT: Record<string, string[]> = {
    'PO-0001': ['₹50,000.00', '₹2,500.00', '₹52,500.00'],
    'INV-0001': ['₹52,500.00'],
    'CN-0001': ['₹15,750.00'],
    'DSP-0001': ['₹3,250.00', '₹162.50', '₹3,412.50'],
  };

  // The full traceability view for every document the scenario produced.
  for (const summary of documents) {
    const detail = await api<DocumentDetail>(token, `/documents/${summary.id}`);
    check(
      `DocumentWorkspace ${detail.documentNumber} (${detail.documentType})`,
      () =>
        wrap(
          <DocumentWorkspace
            detail={detail}
            chain={{ ...buildChain(detail, []), isLoading: false, partial: false }}
          />
        ),
      EXPECTED_TEXT[detail.documentNumber] ?? []
    );
    check(`LineItemsTable ${detail.documentNumber}`, () =>
      wrap(<LineItemsTable lines={detail.lineItems} documentType={detail.documentType} />)
    );
    check(`DocumentChain ${detail.documentNumber}`, () => wrap(<DocumentChain detail={detail} />));
    check(`ActivityTimeline ${detail.documentNumber}`, () =>
      wrap(<ActivityTimeline entries={detail.history} />)
    );
  }

  // Inventory: stock rows and ledger rows.
  const stock = await api<StockRow[]>(token, '/inventory');
  check(
    'Stock rows render',
    () =>
      wrap(
        <DataTable
          columns={[
            { key: 'branch', header: 'Branch', render: (row: StockRow) => row.branch?.name ?? '—' },
            {
              key: 'product',
              header: 'Product',
              render: (row: StockRow) => row.product?.name ?? '—',
            },
            {
              key: 'status',
              header: 'Status',
              render: (row: StockRow) => <StockStatusChip status={row.stockStatus} />,
            },
            {
              key: 'quantity',
              header: 'Quantity',
              render: (row: StockRow) => formatQuantity(row.quantity),
            },
            {
              key: 'value',
              header: 'Value',
              render: (row: StockRow) => formatMoney(row.stockValue),
            },
          ]}
          rows={stock}
          rowKey={(row) => `${row.branch?.id}-${row.batch?.id}-${row.stockStatus}`}
        />
      ),
    ['Central Pharmacy Warehouse']
  );

  const ledgerResponse = await fetch(`${BASE}/inventory/ledger?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ledgerBody = await ledgerResponse.json();
  const ledger = ledgerBody.data as LedgerRow[];
  check('Ledger rows render', () =>
    wrap(
      <DataTable
        columns={[
          {
            key: 'document',
            header: 'Document',
            render: (row: LedgerRow) => row.document?.documentNumber ?? '—',
          },
          { key: 'user', header: 'User', render: (row: LedgerRow) => row.createdBy?.name ?? '—' },
          {
            key: 'quantity',
            header: 'Quantity',
            render: (row: LedgerRow) => formatQuantity(row.quantity),
          },
        ]}
        rows={ledger}
        rowKey={(row) => row.id}
      />
    )
  );

  const paymentsResponse = await fetch(`${BASE}/payments?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payments = (await paymentsResponse.json()).data as Payment[];
  check(
    'Payment rows render',
    () =>
      wrap(
        <DataTable
          columns={[
            {
              key: 'number',
              header: 'Payment',
              render: (row: Payment) => row.paymentNumber,
            },
            {
              key: 'amount',
              header: 'Amount',
              render: (row: Payment) => formatMoney(row.amount),
            },
            {
              key: 'unallocated',
              header: 'Unallocated',
              render: (row: Payment) => formatMoney(row.unallocatedAmount),
            },
          ]}
          rows={payments}
          rowKey={(row) => row.id}
        />
      ),
    payments.length > 0 ? [payments[0].paymentNumber] : []
  );


  /* ---- Upgraded stock-requirement workspace, rendered from the real chain ---- */

  const requirementSummaries = documents.filter(
    (row) => row.documentType === 'STOCK_REQUIREMENT'
  );
  for (const requirementSummary of requirementSummaries) {
    const requirement = await api<DocumentDetail>(token, `/documents/${requirementSummary.id}`);

    // Walk the same DocumentLink chain the page's hook walks.
    const linkIds = (doc: DocumentDetail, linkType: string) =>
      [...doc.links.incoming, ...doc.links.outgoing]
        .filter((link) => link.linkType === linkType)
        .map((link) => link.document.id);

    const load = (ids: string[]) =>
      Promise.all(ids.map((docId) => api<DocumentDetail>(token, `/documents/${docId}`)));

    const purchaseOrders = await load(linkIds(requirement, 'FULFILLS'));
    const receipts = await load(purchaseOrders.flatMap((po) => linkIds(po, 'RECEIVED_AGAINST')));
    const invoices = await load(purchaseOrders.flatMap((po) => linkIds(po, 'INVOICED_AGAINST')));
    const corrections = await load(receipts.flatMap((grn) => linkIds(grn, 'CORRECTS')));
    const creditNotes = await load(invoices.flatMap((inv) => linkIds(inv, 'CREDIT_FOR')));

    const fulfilledByProduct = new Map<string, Decimal>();
    for (const doc of [...receipts, ...corrections]) {
      for (const movement of doc.inventoryTransactions) {
        if (movement.stockStatus !== 'USABLE' || !movement.product) continue;
        fulfilledByProduct.set(
          movement.product.id,
          (fulfilledByProduct.get(movement.product.id) ?? dec(0)).plus(dec(movement.quantity))
        );
      }
    }

    const movements = [...receipts, ...corrections].flatMap((doc) =>
      doc.inventoryTransactions.map((movement) => ({
        ...movement,
        sourceDocument: {
          id: doc.id,
          documentNumber: doc.documentNumber,
          documentType: doc.documentType,
          status: doc.status,
        },
      }))
    );

    const label = requirement.documentNumber;

    check(
      `DocumentHeader ${label}`,
      () =>
        wrap(
          <DocumentHeader
            documentTypeLabel="Stock Requirement"
            documentNumber={requirement.documentNumber}
            status={requirement.status}
            facts={[{ label: 'Branch', value: requirement.branch?.name ?? '-' }]}
          />
        ),
      [label, requirement.branch?.name ?? '']
    );

    const totals = fulfilmentTotals(requirement, fulfilledByProduct);

    check(`FulfilmentStats ${label}`, () =>
      wrap(<FulfilmentStats detail={requirement} totals={totals} isLoading={false} />)
    );

    check(`FulfilmentProgress ${label}`, () =>
      wrap(
        <FulfilmentProgress
          detail={requirement}
          totals={totals}
          isLoading={false}
          partial={false}
        />
      )
    );

    check(`RequirementItems ${label}`, () =>
      wrap(
        <RequirementItems
          detail={requirement}
          fulfilledByProduct={fulfilledByProduct}
          batchByProduct={new Map()}
        />
      )
    );

    check(
      `DocumentFlow ${label}`,
      () =>
        wrap(
          <DocumentFlow
            nodes={[
              {
                label: 'Stock Requirement',
                number: label,
                status: requirement.status,
                current: true,
              },
              ...purchaseOrders.map((po) => ({
                label: 'Purchase Order',
                number: po.documentNumber,
                status: po.status,
                to: `/purchase-orders/${po.id}`,
              })),
            ]}
          />
        ),
      [label]
    );

    if (movements.length > 0) {
      check(`InventoryMovementsTable ${label}`, () =>
        wrap(<InventoryMovementsTable movements={movements} showSourceDocument />)
      );
    }

    check(`ChainFinancialSummary ${label}`, () =>
      wrap(
        <ChainFinancialSummary
          financials={{
            ordered: purchaseOrders[0]?.totalAmount ?? '0.00',
            invoiced: invoices[0]?.totalAmount ?? '0.00',
            credited: creditNotes[0]?.totalAmount ?? '0.00',
            paid: invoices[0]?.paidAmount ?? '0.00',
            outstanding: invoices[0]?.balanceAmount ?? '0.00',
            disputed: invoices[0]?.disputedAmount ?? '0.00',
          }}
          hasChain={purchaseOrders.length > 0}
        />
      )
    );

    check(`ChainPayments ${label}`, () =>
      wrap(
        <ChainPayments
          payments={invoices.flatMap((invoice) =>
            invoice.paymentAllocations.map((allocation) => ({
              document: {
                id: invoice.id,
                documentNumber: invoice.documentNumber,
                documentType: invoice.documentType,
                status: invoice.status,
              },
              allocation,
            }))
          )}
        />
      )
    );

    // The headline requirement: a corrected receipt must read as before/after
    // prose, not JSON. Assert the actual transformed values.
    const correctedReceipt = receipts.find((grn) =>
      (grn.history ?? []).some((entry) => entry.action === 'CORRECT')
    );
    const correctEntry = correctedReceipt?.history?.find((entry) => entry.action === 'CORRECT');
    if (correctEntry) {
      const rows = describeChanges(correctEntry.changes);
      check(
        `AuditChangeView ${correctedReceipt?.documentNumber} correction is human-readable`,
        () => {
          const html = wrap(<AuditChangeView rows={rows} />);
          if (html.includes('&quot;old&quot;') || html.includes('{"old"')) {
            throw new Error('raw JSON leaked into the rendered output');
          }
          return html;
        },
        ['Accepted quantity', 'Damaged quantity', 'Missing quantity']
      );
      check(`describeChanges ${correctedReceipt?.documentNumber} pairs the corrected split`, () => {
        const accepted = rows.find((row) => row.label === 'Accepted quantity');
        if (!accepted?.before || !accepted.after) {
          throw new Error('accepted quantity was not paired before -> after');
        }
        return `${accepted.before} -> ${accepted.after}`;
      });
      console.log(
        '      correction reads: ' +
          rows
            .filter((row) => row.before !== undefined)
            .map((row) => `${row.label} ${row.before} -> ${row.after}`)
            .join(', ')
      );
    }
  }

  /**
   * The procurement guardrail, rendered from whatever the backend actually says
   * about a live requirement. Both shapes are exercised - the sourcing analysis
   * behind the requirement page and the cheaper availability read behind the
   * purchase order screen - because each feeds a different panel.
   */
  const sourceable = documents.filter(
    (document) =>
      document.documentType === 'STOCK_REQUIREMENT' &&
      (document.status === 'APPROVED' || document.status === 'PARTIALLY_FULFILLED')
  );

  for (const summary of sourceable.slice(0, 3)) {
    const analysis = await api<RequirementSourcingAnalysis>(
      token,
      `/stock-requirements/${summary.id}/sourcing-analysis`
    );
    const available = await api<RequirementAvailability>(
      token,
      `/stock-requirements/${summary.id}/internal-availability`
    );

    const expectedHeading = {
      HIGH_SURPLUS: 'Internal stock opportunity',
      PARTIAL_SURPLUS: 'Partial internal stock available',
      NO_SURPLUS: 'No sourceable internal surplus',
    }[analysis.surplusStatus];

    check(
      `SourcingOpportunityBanner ${summary.documentNumber} (${analysis.surplusStatus})`,
      () =>
        wrap(<SourcingOpportunityBanner opportunity={opportunityFromAnalysis(analysis)} />),
      [expectedHeading]
    );

    check(
      `SourcingContextPanel ${summary.documentNumber} never blocks the order`,
      () => {
        const html = wrap(
          <SourcingContextPanel
            opportunity={opportunityFromAvailability(available)}
            requirementNumber={summary.documentNumber}
            reviewHref={`/requirements/${summary.id}?tab=internal-sourcing`}
          />
        );
        // The guardrail is advisory. Any wording that reads as a prohibition is
        // a regression in the business rule, not just in the copy.
        for (const forbidden of ['cannot create', 'not allowed', 'blocked', 'must transfer']) {
          if (html.toLowerCase().includes(forbidden)) {
            throw new Error(`guardrail reads as a block: "${forbidden}"`);
          }
        }
        return html;
      },
      ['Requisition sourcing', summary.documentNumber]
    );

    // Surplus is never allowed to exceed what the requirement still needs once
    // the backend has capped it, and it is never simply the shelf quantity.
    check(`Surplus figures for ${summary.documentNumber} are internally consistent`, () => {
      const suggested = Number(analysis.totals.suggestedInternalQty);
      const procurement = Number(analysis.totals.suggestedProcurementQty);
      const outstanding = Number(analysis.totals.outstanding);
      if (Math.abs(suggested + procurement - outstanding) > 0.001) {
        throw new Error(
          `internal ${suggested} + procurement ${procurement} != outstanding ${outstanding}`
        );
      }
      for (const line of analysis.productLines) {
        for (const branch of line.internal.sources) {
          if (Number(branch.sourceableSurplusQty) > Number(branch.totalAvailableQty) + 0.001) {
            throw new Error(`${branch.branchCode} surplus exceeds its available quantity`);
          }
        }
      }
      return `${suggested} internal + ${procurement} procurement = ${outstanding} outstanding`;
    });
  }

  console.log(failures === 0 ? '\nDATA SMOKE PASSED' : `\nDATA SMOKE FAILED (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('DATA SMOKE ERROR:', error.message);
  process.exit(1);
});
