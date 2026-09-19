import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DocumentLineItem, DocumentType } from '@/types/api';
import { formatMoney, formatQuantity } from '@/utils/decimal';
import { formatDate } from '@/utils/format';

/** Receipts and corrections carry the accepted/damaged/missing split. */
const SPLIT_TYPES: DocumentType[] = ['GOODS_RECEIPT', 'RECEIPT_CORRECTION'];

export function LineItemsTable({
  lines,
  documentType,
  quantityLabel = 'Quantity',
}: {
  lines: DocumentLineItem[];
  documentType: DocumentType;
  quantityLabel?: string;
}) {
  const showSplit = SPLIT_TYPES.includes(documentType);
  const showBatch = lines.some((line) => line.batch);
  const isCorrection = documentType === 'RECEIPT_CORRECTION';

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
            {showBatch ? <TableCell sx={{ fontWeight: 600 }}>Batch / Expiry</TableCell> : null}
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              {isCorrection ? 'Net delta' : quantityLabel}
            </TableCell>
            {showSplit ? (
              <>
                <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                  {isCorrection ? 'Δ Usable' : 'Usable'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                  {isCorrection ? 'Δ Damaged' : 'Damaged'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {isCorrection ? 'Δ Missing' : 'Missing'}
                </TableCell>
              </>
            ) : null}
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              Unit price
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              Subtotal
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              Tax
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              Total
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>{line.lineNumber}</TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={500}>
                  {line.product?.name ?? line.product?.id}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {line.product?.code}
                  {line.unitOfMeasure ? ` • ${line.unitOfMeasure}` : ''}
                </Typography>
                {line.description ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {line.description}
                  </Typography>
                ) : null}
              </TableCell>
              {showBatch ? (
                <TableCell>
                  {line.batch ? (
                    <Box>
                      <Typography variant="body2">{line.batch.batchNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Exp. {formatDate(line.batch.expiryDate)}
                      </Typography>
                    </Box>
                  ) : (
                    '—'
                  )}
                </TableCell>
              ) : null}
              <TableCell align="right">{formatQuantity(line.quantity)}</TableCell>
              {showSplit ? (
                <>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                    {formatQuantity(line.acceptedQuantity)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                    {formatQuantity(line.damagedQuantity)}
                  </TableCell>
                  <TableCell align="right">{formatQuantity(line.missingQuantity)}</TableCell>
                </>
              ) : null}
              <TableCell align="right">{formatMoney(line.unitPrice)}</TableCell>
              <TableCell align="right">{formatMoney(line.subtotal)}</TableCell>
              <TableCell align="right">
                {formatMoney(line.taxAmount)}
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatQuantity(line.taxRate)}%
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatMoney(line.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
