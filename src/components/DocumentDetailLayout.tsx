import { useMemo, useState } from 'react';
import { Box, Chip, Divider, Grid, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

export interface DocumentTab {
  key: string;
  label: string;
  /** Row count or similar; omitted when there is nothing to count. */
  count?: number;
  content: React.ReactNode;
  /** Hidden entirely when false, so a tab never opens onto "not applicable". */
  visible?: boolean;
}

/**
 * The workspace every ERP document is presented in.
 *
 *   header    identity and workflow actions
 *   summary   the few figures that answer "where is this document?"
 *   tabs      lines, related documents, inventory, payments, audit
 *   activity  the timeline, on a rail beside the document on a wide screen and
 *             below it on anything narrower
 *
 * Feature pages supply the content; none of them lays out its own workspace, so
 * a purchase order and a dispensing note read the same way.
 */
export function DocumentDetailLayout({
  header,
  summary,
  tabs,
  activity,
  activityTitle = 'Activity',
  activitySubtitle,
  initialTabKey,
}: {
  header: React.ReactNode;
  summary?: React.ReactNode;
  tabs: DocumentTab[];
  activity?: React.ReactNode;
  activityTitle?: string;
  activitySubtitle?: string;
  /**
   * Opens on a named tab instead of the first one, so another screen can send
   * somebody straight to the section it was talking about. It seeds the initial
   * state only - once the page is open the user's clicks own the selection.
   */
  initialTabKey?: string;
}) {
  const visibleTabs = useMemo(() => tabs.filter((tab) => tab.visible !== false), [tabs]);
  const [active, setActive] = useState(() => {
    const requested = visibleTabs.findIndex((tab) => tab.key === initialTabKey);
    return requested >= 0 ? requested : 0;
  });
  // A tab disappearing (a section that no longer applies) must not strand the view.
  const index = Math.min(active, Math.max(visibleTabs.length - 1, 0));
  const current = visibleTabs[index];

  const document = (
    <>
      {visibleTabs.length > 0 ? (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={index}
              onChange={(_event, value: number) => setActive(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Document sections"
            >
              {visibleTabs.map((tab) => (
                <Tab
                  key={tab.key}
                  id={`document-tab-${tab.key}`}
                  aria-controls={`document-panel-${tab.key}`}
                  label={
                    tab.count === undefined ? (
                      tab.label
                    ) : (
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <span>{tab.label}</span>
                        <Chip
                          size="small"
                          label={tab.count}
                          sx={{ height: 18, fontSize: 10.5, pointerEvents: 'none' }}
                        />
                      </Stack>
                    )
                  }
                />
              ))}
            </Tabs>
          </Box>
          {current ? (
            <Box
              role="tabpanel"
              id={`document-panel-${current.key}`}
              aria-labelledby={`document-tab-${current.key}`}
              sx={{ p: { xs: 1.5, md: 2.25 } }}
            >
              {current.content}
            </Box>
          ) : null}
        </Paper>
      ) : null}
    </>
  );

  if (!activity) {
    return (
      <Box>
        {header}
        {summary}
        {document}
      </Box>
    );
  }

  return (
    <Box>
      {header}
      {summary}
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} lg={8.5} sx={{ minWidth: 0 }}>
          {document}
        </Grid>
        <Grid item xs={12} lg={3.5} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ px: 2, py: 1.5 }}
            >
              <HistoryOutlinedIcon fontSize="small" color="primary" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{activityTitle}</Typography>
                {activitySubtitle ? (
                  <Typography variant="caption" color="text.secondary">
                    {activitySubtitle}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
            <Divider />
            <Box sx={{ p: 2 }}>{activity}</Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * A titled block inside a tab panel. Tabs already sit on a card, so sections
 * inside them are separated by a rule and a heading rather than another card -
 * cards inside cards is the look this upgrade is moving away from.
 */
export function DetailSection({
  title,
  subtitle,
  actions,
  children,
  first,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Skips the top rule for the first section in a panel. */
  first?: boolean;
}) {
  return (
    <Box sx={{ mt: first ? 0 : 3 }}>
      {first ? null : <Divider sx={{ mb: 2 }} />}
      {title ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle2">{title}</Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {actions ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {actions}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
      {children}
    </Box>
  );
}
