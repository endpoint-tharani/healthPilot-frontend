import {
  Box,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { DocumentInventoryTransaction, DocumentRef } from '@/types/api';
import { formatMoney, formatQuantity } from '@/utils/decimal';
import { documentPath, formatDate, humanise } from '@/utils/format';
import { StockStatusChip } from './StatusChip';

/** A ledger row plus, on chain views, the document that posted it. */
export interface MovementRow extends DocumentInventoryTransaction {
  sourceDocument?: DocumentRef;
}

/**
 * The stock ledger exactly as InventoryTransaction recorded it. Quantities are
 * shown with their sign because that is how the ledger stores them - the table
 * never nets, sums or recalculates anything.
 */
export function InventoryMovementsTable({
  movements,
  showSourceDocument = false,
}: {
  movements: MovementRow[];
  showSourceDocument?: boolean;
}) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Transaction</TableCell>
            {showSourceDocument ? <TableCell>Document</TableCell> : null}
            <TableCell>Branch</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Batch</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Value</TableCell>
            <TableCell>User</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movements.map((movement) => {
            const inbound = !movement.quantity.startsWith('-');
            return (
              <TableRow key={movement.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDate(movement.transactionDate)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {humanise(movement.transactionType)}
                  </Typography>
                  {movement.notes ? (
                    <Typography variant="caption" color="text.secondary">
                      {movement.notes}
                    </Typography>
                  ) : null}
                </TableCell>
                {showSourceDocument ? (
                  <TableCell>
                    {movement.sourceDocument ? (
                      <MuiLink
                        component={RouterLink}
                        to={documentPath(
                          movement.sourceDocument.documentType,
                          movement.sourceDocument.id
                        )}
                        underline="hover"
                        fontWeight={600}
                        variant="body2"
                      >
                        {movement.sourceDocument.documentNumber}
                      </MuiLink>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                ) : null}
                <TableCell>{movement.branch?.name ?? '—'}</TableCell>
                <TableCell>
                  <Typography variant="body2">{movement.product?.name ?? '—'}</Typography>
                  {movement.product?.code ? (
                    <Typography variant="caption" color="text.secondary">
                      {movement.product.code}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{movement.batch?.batchNumber ?? '—'}</TableCell>
                <TableCell>
                  <StockStatusChip status={movement.stockStatus} />
                </TableCell>
                <TableCell align="right">
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: inbound ? 'success.main' : 'error.main',
                    }}
                  >
                    {inbound ? '+' : '−'}
                    {formatQuantity(movement.quantity.replace('-', ''))}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(movement.totalCost)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {movement.createdBy?.name ?? '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
