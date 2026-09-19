import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { paletteTokens, type ColorMode } from '@/app/theme';
import { useBranches } from '@/hooks/useReferenceData';
import { humanise } from '@/utils/format';

/**
 * Filters are a compact tool rather than a row of always-visible controls: a
 * search box and one button carrying a count of what is currently narrowing the
 * list. The controls themselves live in a popover on a desktop and a drawer on a
 * phone, so a list page spends its width on the list instead of on inputs that
 * are empty most of the time.
 *
 * Changes still take effect as they are made, exactly as the inline bar behaved,
 * so the panel closes with "Done" rather than an Apply the user could forget to
 * press and think the filter had not worked.
 */
export function FilterBar({
  children,
  search,
  onReset,
  showReset,
  activeCount = 0,
}: {
  children: React.ReactNode;
  search?: React.ReactNode;
  onReset?: () => void;
  showReset?: boolean;
  /** Drives the badge on the Filter button and the count inside the panel. */
  activeCount?: number;
}) {
  const theme = useTheme();
  const tokens = paletteTokens(theme.palette.mode as ColorMode);
  const onDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const close = () => {
    setAnchor(null);
    setDrawerOpen(false);
  };

  const heading = (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.75, py: 1.25 }}>
      <FilterAltOutlinedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
      <Typography variant="subtitle2" sx={{ flex: 1 }}>
        Filter
      </Typography>
      <IconButton size="small" onClick={close} aria-label="Close filters">
        <CloseIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Stack>
  );

  const footer = (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.75, py: 1.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        {activeCount === 0
          ? 'No filters applied'
          : `${activeCount} filter${activeCount === 1 ? '' : 's'} applied`}
      </Typography>
      <Button
        size="small"
        disabled={activeCount === 0 || !onReset}
        onClick={() => onReset?.()}
      >
        Clear
      </Button>
      <Button size="small" variant="contained" onClick={close}>
        Done
      </Button>
    </Stack>
  );

  /**
   * Every control goes full width inside the panel. The filters carry their own
   * inline widths for the old bar layout, which would otherwise leave a stack of
   * ragged right edges in a narrow popover.
   */
  const body = (
    <Stack
      spacing={1.75}
      sx={{
        p: 1.75,
        maxHeight: { xs: 'none', md: 420 },
        overflowY: { xs: 'visible', md: 'auto' },
        '& .MuiTextField-root': { width: '100%' },
      }}
    >
      {children}
    </Stack>
  );

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 1.5 }}
        useFlexGap
        flexWrap="wrap"
      >
        {search ? (
          <Box sx={{ flex: { xs: '1 1 100%', sm: '0 1 300px' }, minWidth: 0 }}>{search}</Box>
        ) : null}

        <Badge badgeContent={activeCount} color="primary" overlap="circular">
          <Button
            size="small"
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={(event) =>
              onDesktop ? setAnchor(event.currentTarget) : setDrawerOpen(true)
            }
            aria-label={
              activeCount > 0 ? `Filters: ${activeCount} applied` : 'Filters: none applied'
            }
            sx={{ flexShrink: 0 }}
          >
            Filter
          </Button>
        </Badge>

        {onReset && showReset ? (
          <Button size="small" onClick={onReset} sx={{ flexShrink: 0 }}>
            Clear
          </Button>
        ) : null}
      </Stack>

      <Popover
        anchorEl={anchor}
        open={onDesktop && Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 300,
              mt: 0.75,
              border: `1px solid ${tokens.divider}`,
              boxShadow: tokens.shadow,
              borderRadius: 2.5,
              overflow: 'hidden',
            },
          },
        }}
      >
        {heading}
        <Divider />
        {body}
        <Divider />
        {footer}
      </Popover>

      <Drawer
        anchor="right"
        open={!onDesktop && drawerOpen}
        onClose={close}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 380 } } } }}
      >
        {heading}
        <Divider />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>{body}</Box>
        <Divider />
        {footer}
      </Drawer>
    </>
  );
}

/** Debounced so typing does not fire a request per keystroke. */
export function SearchFilter({
  value,
  onChange,
  placeholder = 'Search…',
  width = 260,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  width?: number;
}) {
  const [local, setLocal] = useState(value ?? '');

  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = local.trim();
      if (next !== (value ?? '')) {
        onChange(next === '' ? undefined : next);
      }
    }, 350);
    return () => window.clearTimeout(handle);
    // onChange/value are intentionally excluded: only the typed text drives the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <TextField
      value={local}
      onChange={(event) => setLocal(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      sx={{ width: { xs: '100%', md: width } }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: local ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setLocal('')} aria-label="Clear search">
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  );
}

export function SelectFilter({
  label,
  value,
  options,
  onChange,
  width = 180,
  allLabel = 'All',
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  width?: number;
  allLabel?: string;
}) {
  return (
    <TextField
      select
      label={label}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
      sx={{ width: { xs: '100%', md: width } }}
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function EnumFilter({
  label,
  value,
  values,
  onChange,
  width = 180,
}: {
  label: string;
  value: string | undefined;
  values: readonly string[];
  onChange: (value: string | undefined) => void;
  width?: number;
}) {
  return (
    <SelectFilter
      label={label}
      value={value}
      onChange={onChange}
      width={width}
      options={values.map((item) => ({ value: item, label: humanise(item) }))}
    />
  );
}

/**
 * Branch filter fed by `/branches`, which the backend already narrows to the
 * caller scope - a branch-scoped user is never offered another branch.
 */
export function BranchFilter({
  value,
  onChange,
  label = 'Branch',
  width = 210,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  label?: string;
  width?: number;
}) {
  const { data: branches } = useBranches();

  if (!branches || branches.length <= 1) {
    return null;
  }

  return (
    <SelectFilter
      label={label}
      value={value}
      onChange={onChange}
      width={width}
      allLabel="All branches in scope"
      options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
    />
  );
}

export function DateFilter({
  label,
  value,
  onChange,
  width = 155,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  width?: number;
}) {
  return (
    <TextField
      type="date"
      label={label}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || undefined)}
      InputLabelProps={{ shrink: true }}
      sx={{ width: { xs: '100%', md: width } }}
    />
  );
}
