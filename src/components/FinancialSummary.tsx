import { Box, Divider, Stack, Typography } from '@mui/material';
import { formatMoney, type DecimalInput } from '@/utils/decimal';

export interface FinancialLine {
  label: string;
  value: DecimalInput;
  /** Rendered with a leading minus and in red: credits, discounts, write-downs. */
  negative?: boolean;
  /** The line the eye should land on, e.g. Total or Outstanding. */
  emphasis?: boolean;
  /** Draws a rule above this line, separating a subtotal from what follows. */
  ruleAbove?: boolean;
  caption?: string;
  muted?: boolean;
}

function Figure({ line }: { line: FinancialLine }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="baseline"
      spacing={2}
      sx={{ py: line.emphasis ? 1 : 0.7 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          color={line.emphasis ? 'text.primary' : line.muted ? 'text.disabled' : 'text.secondary'}
          fontWeight={line.emphasis ? 700 : 500}
        >
          {line.label}
        </Typography>
        {line.caption ? (
          <Typography variant="caption" color="text.secondary">
            {line.caption}
          </Typography>
        ) : null}
      </Box>
      <Typography
        variant="body2"
        fontWeight={line.emphasis ? 800 : 600}
        sx={{
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          color: line.negative ? 'error.main' : undefined,
          fontSize: line.emphasis ? '0.95rem' : undefined,
        }}
      >
        {line.negative ? '−' : ''}
        {formatMoney(line.value)}
      </Typography>
    </Stack>
  );
}

/**
 * The accounting block used wherever money is summarised: one figure per line,
 * right-aligned on tabular numerals, with a rule before the figure that matters.
 * Every value is passed in by the caller from a backend field - this component
 * performs no arithmetic of its own.
 */
export function FinancialSummary({ lines }: { lines: FinancialLine[] }) {
  return (
    <Box>
      {lines.map((line, index) => (
        <Box key={`${line.label}-${index}`}>
          {line.ruleAbove ? <Divider sx={{ my: 0.5 }} /> : null}
          <Figure line={line} />
        </Box>
      ))}
    </Box>
  );
}
