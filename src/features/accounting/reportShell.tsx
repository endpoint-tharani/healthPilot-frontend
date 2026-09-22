import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Fragment } from 'react';
import type { ReportScope, ReportSection } from '@/types/accounting';
import { formatDate } from '@/utils/format';
import { formatMoney } from '@/utils/decimal';

/**
 * The shared furniture of the three financial statements: the period the figures
 * cover, whether they balance, and a print action.
 *
 * Kept in one place because the three reports have to agree on what "balanced"
 * looks like. A Trial Balance that quietly showed a difference in small grey text
 * while the Balance Sheet shouted about one would leave a reader unsure which to
 * believe.
 */

export function ReportScopeLine({ scope }: { scope: ReportScope }) {
  const period =
    scope.fromDate || scope.toDate
      ? `${scope.fromDate ? formatDate(scope.fromDate) : 'the beginning'} to ${
          scope.toDate ? formatDate(scope.toDate) : 'today'
        }`
      : 'all posted entries to date';

  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      Period: {period}
      {scope.branchId ? ' · one branch' : ' · every branch in scope'} · posted journals only
    </Typography>
  );
}

/**
 * States plainly whether the books balance. Shown even when they do: a reader
 * needs to know the check was made, not merely that nothing was said about it.
 */
export function BalanceIndicator({
  isBalanced,
  difference,
  balancedLabel,
  integrityError,
}: {
  isBalanced: boolean;
  difference: string;
  balancedLabel: string;
  integrityError: string | null;
}) {
  if (!isBalanced) {
    return (
      <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          Accounting integrity error — difference {difference}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {integrityError}
        </Typography>
      </Alert>
    );
  }

  return (
    <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
      {balancedLabel}
    </Alert>
  );
}

export function PrintButton() {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<PrintOutlinedIcon />}
      onClick={() => window.print()}
      className="no-print"
    >
      Print
    </Button>
  );
}

/**
 * Hides the application chrome when a statement is printed, so a reviewer gets
 * the report on paper rather than the sidebar and the filter bar around it.
 * Scoped to a print media query, so nothing about the on-screen page changes.
 */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print, nav, header, aside, .MuiDrawer-root, .MuiAppBar-root { display: none !important; }
        .MuiPaper-root { box-shadow: none !important; border: 1px solid #ddd !important; }
        body { background: #fff !important; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      }
    `}</style>
  );
}

export function ReportSurface({ children }: { children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer sx={{ overflowX: 'auto' }}>{children}</TableContainer>
    </Paper>
  );
}

/** A right-aligned money cell with tabular numerals, so columns line up. */
export function MoneyCell({
  children,
  bold,
  muted,
}: {
  children: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <TableCell
      align="right"
      sx={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: bold ? 700 : 400,
        color: muted ? 'text.secondary' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </TableCell>
  );
}

/** The heavy rule above a statement's closing total. */
export function TotalRow({
  label,
  values,
  emphasis,
}: {
  label: React.ReactNode;
  values: React.ReactNode[];
  emphasis?: boolean;
}) {
  const theme = useTheme();
  return (
    <TableRow
      sx={{
        '& td': {
          borderTop: `2px solid ${theme.palette.divider}`,
          borderBottom: 'none',
          bgcolor: emphasis ? 'action.hover' : undefined,
        },
      }}
    >
      <TableCell sx={{ fontWeight: 700 }}>{label}</TableCell>
      {values.map((value, index) => (
        <MoneyCell key={index} bold>
          {value}
        </MoneyCell>
      ))}
    </TableRow>
  );
}

export function SectionHeadingRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        sx={{
          bgcolor: 'action.hover',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: 11,
        }}
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

export function NatureChip({ code }: { code: string }) {
  const label: Record<string, string> = {
    AS: 'Asset',
    LI: 'Liability',
    EQ: 'Equity',
    IN: 'Income',
    EX: 'Expense',
  };
  const colour: Record<string, 'info' | 'warning' | 'secondary' | 'success' | 'error'> = {
    AS: 'info',
    LI: 'warning',
    EQ: 'secondary',
    IN: 'success',
    EX: 'error',
  };
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label[code] ?? code}
      color={colour[code] ?? 'default'}
      sx={{ height: 20, fontSize: 10.5, fontWeight: 600 }}
    />
  );
}

export function EmptyBooks({ what }: { what: string }) {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        No posted journal entries fall in this period, so {what} has nothing to show.
      </Typography>
    </Box>
  );
}

/**
 * One side of a statement: each head with its ledgers indented beneath it.
 *
 * Rows are emitted as fragments rather than wrapped in an element, because the
 * only thing valid between a <tbody> and a <tr> is nothing at all - a nested
 * tbody, or a <div>, makes the browser hoist the rows out of the table and the
 * whole statement collapses into a column of bare text.
 */
export function StatementSections({ sections }: { sections: ReportSection[] }) {
  return (
    <>
      {sections.flatMap((section) =>
        section.heads.map((head) => (
          <Fragment key={section.code + ':' + head.code}>
            <TableRow hover>
              <TableCell sx={{ pl: 3 }}>
                <Typography variant="body2" fontWeight={600}>
                  <Box
                    component="span"
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      color: 'text.secondary',
                      mr: 1,
                      fontSize: 11.5,
                    }}
                  >
                    {head.code}
                  </Box>
                  {head.name}
                </Typography>
              </TableCell>
              <MoneyCell bold>{formatMoney(head.amount)}</MoneyCell>
            </TableRow>

            {head.ledgers.map((ledger) => (
              <TableRow key={ledger.ledgerId}>
                <TableCell sx={{ pl: 6, border: 0, py: 0.4 }}>
                  <Typography variant="caption" color="text.secondary">
                    {ledger.code} · {ledger.name}
                  </Typography>
                </TableCell>
                <MoneyCell muted>
                  <Typography variant="caption">{formatMoney(ledger.amount)}</Typography>
                </MoneyCell>
              </TableRow>
            ))}
          </Fragment>
        ))
      )}
    </>
  );
}

export { Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography };
