import { Box, Chip, Link as MuiLink, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';
import type { DocumentDetail, DocumentLinkType, DocumentRef } from '@/types/api';
import { DOCUMENT_LINK_LABELS, DOCUMENT_TYPE_LABELS, documentPath } from '@/utils/format';
import { DocumentStatusChip } from './StatusChip';
import { EmptyState } from './states';

export function DocumentRefLink({ document }: { document: DocumentRef }) {
  return (
    <MuiLink
      component={RouterLink}
      to={documentPath(document.documentType, document.id)}
      underline="hover"
      fontWeight={600}
    >
      {document.documentNumber}
    </MuiLink>
  );
}

function LinkRow({
  linkType,
  document,
  direction,
}: {
  linkType: DocumentLinkType;
  document: DocumentRef;
  direction: 'upstream' | 'downstream';
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}
      useFlexGap
    >
      <Chip size="small" variant="outlined" label={DOCUMENT_LINK_LABELS[linkType] ?? linkType} />
      <ArrowForwardIcon
        fontSize="small"
        color="disabled"
        sx={{ transform: direction === 'upstream' ? 'none' : 'rotate(180deg)' }}
      />
      <Typography variant="body2" color="text.secondary">
        {DOCUMENT_TYPE_LABELS[document.documentType]}
      </Typography>
      <DocumentRefLink document={document} />
      <DocumentStatusChip status={document.status} />
    </Stack>
  );
}

/**
 * Renders the real DocumentLink rows in both directions, so a reviewer can walk
 * requirement → PO → GRN → correction → invoice → credit note → payment without
 * leaving the document.
 */
export function DocumentChain({ detail }: { detail: DocumentDetail }) {
  const { outgoing, incoming } = detail.links;

  if (outgoing.length === 0 && incoming.length === 0) {
    return (
      <EmptyState
        title="No linked documents"
        description="Links appear as the document progresses through the workflow."
      />
    );
  }

  return (
    <Box>
      {outgoing.length > 0 ? (
        <>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Upstream — documents this one was raised against
          </Typography>
          {outgoing.map((link) => (
            <LinkRow
              key={`out-${link.document.id}-${link.linkType}`}
              linkType={link.linkType}
              document={link.document}
              direction="upstream"
            />
          ))}
        </>
      ) : null}

      {incoming.length > 0 ? (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: outgoing.length > 0 ? 2 : 0, mb: 0.5 }}
          >
            Downstream — documents raised against this one
          </Typography>
          {incoming.map((link) => (
            <LinkRow
              key={`in-${link.document.id}-${link.linkType}`}
              linkType={link.linkType}
              document={link.document}
              direction="downstream"
            />
          ))}
        </>
      ) : null}
    </Box>
  );
}
