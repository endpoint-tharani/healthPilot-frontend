import { createTheme, type Theme } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

/**
 * Design tokens shared by both modes. The product language is blue on white:
 * a single blue accent, white cards on a very light blue-grey page, blue-grey
 * borders and navy text. Green, amber and red are reserved for status meaning
 * (success, warning, danger) and never used as decoration.
 *
 * Light is the design target for the ERP workspace; the dark set exists so the
 * long-standing colour-mode switch keeps working and is tuned to the same tones.
 */
export const BRAND = {
  blue: '#1B64DA',
  blueDark: '#14459B',
  blueSoft: '#EAF1FE',
  blueSoftDark: '#12233F',
  navy: '#0E1F33',
  emerald: '#0E9F6E',
  emeraldSoft: '#E6F6F0',
  amber: '#B45309',
  amberSoft: '#FDF3E4',
  red: '#DC2626',
  redSoft: '#FDECEC',
  slate: '#64748B',
  slateSoft: '#F1F4F9',
} as const;

const TOKENS = {
  light: {
    background: '#F4F7FC',
    paper: '#FFFFFF',
    divider: '#DFE6F1',
    textPrimary: BRAND.navy,
    textSecondary: '#5B6B82',
    tableHead: '#F5F8FD',
    /** Row hover across tables and list rails: a barely-there blue wash. */
    rowHover: '#F2F7FF',
    railHover: '#F1F5FC',
    navActive: BRAND.blueSoft,
    navActiveText: BRAND.blueDark,
    code: '#F4F7FC',
    /** Soft blue wash for section headers and highlighted panels. */
    accentSoft: BRAND.blueSoft,
    /** Vertical rail behind the activity timeline. */
    timelineRail: '#E2EAF6',
    /** The one shadow the product uses, for menus, dialogs and hover lift. */
    shadow: '0 6px 24px rgba(14,31,51,0.10)',
  },
  dark: {
    background: '#0A1220',
    paper: '#0F1A2B',
    divider: '#1D2B41',
    textPrimary: '#E7EDF6',
    textSecondary: '#94A4BB',
    tableHead: '#15243A',
    rowHover: '#15243A',
    railHover: '#15243A',
    navActive: BRAND.blueSoftDark,
    navActiveText: '#7DA9F5',
    code: '#0B1524',
    accentSoft: BRAND.blueSoftDark,
    timelineRail: '#1D2B41',
    shadow: '0 6px 24px rgba(0,0,0,0.45)',
  },
} as const;

export function paletteTokens(mode: ColorMode) {
  return TOKENS[mode];
}

/**
 * Soft status palette: a tinted background plus a readable foreground, used by
 * the status chips and the activity timeline so every state reads the same way
 * across the app instead of each surface picking its own colour.
 */
export type StatusTone = 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'danger';

export function statusTone(mode: ColorMode, tone: StatusTone) {
  const light: Record<StatusTone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: BRAND.slateSoft, fg: '#475569', border: '#DDE3EC' },
    info: { bg: BRAND.blueSoft, fg: BRAND.blueDark, border: '#CBDDFA' },
    primary: { bg: BRAND.blueSoft, fg: BRAND.blueDark, border: '#CBDDFA' },
    success: { bg: BRAND.emeraldSoft, fg: '#0A7A55', border: '#C8EBDD' },
    warning: { bg: BRAND.amberSoft, fg: BRAND.amber, border: '#F3DFC0' },
    danger: { bg: BRAND.redSoft, fg: '#B91C1C', border: '#F7CFCF' },
  };
  const dark: Record<StatusTone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: '#1A2537', fg: '#A9B7CB', border: '#26354C' },
    info: { bg: BRAND.blueSoftDark, fg: '#8DB5F7', border: '#223A63' },
    primary: { bg: BRAND.blueSoftDark, fg: '#8DB5F7', border: '#223A63' },
    success: { bg: '#0D2A20', fg: '#4FC79B', border: '#17402F' },
    warning: { bg: '#2C2113', fg: '#E0A45C', border: '#42301B' },
    danger: { bg: '#2E1616', fg: '#F08A8A', border: '#452020' },
  };
  return (mode === 'light' ? light : dark)[tone];
}

export function createAppTheme(mode: ColorMode): Theme {
  const t = TOKENS[mode];

  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? BRAND.blue : '#4E8DF0',
        dark: BRAND.blueDark,
        light: mode === 'light' ? '#4E8DF0' : '#7DA9F5',
        contrastText: '#FFFFFF',
      },
      secondary: { main: mode === 'light' ? BRAND.navy : '#94A4BB' },
      success: { main: BRAND.emerald },
      warning: { main: BRAND.amber },
      error: { main: BRAND.red },
      info: { main: mode === 'light' ? BRAND.blue : '#4E8DF0' },
      background: { default: t.background, paper: t.paper },
      divider: t.divider,
      text: { primary: t.textPrimary, secondary: t.textSecondary },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily:
        '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif',
      fontSize: 13.5,
      h4: { fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontSize: '1.02rem', fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontSize: '0.85rem', fontWeight: 700, letterSpacing: '-0.005em' },
      body2: { fontSize: '0.83rem' },
      caption: { fontSize: '0.72rem' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: mode === 'light' ? '#CBD7E8' : '#26344A',
            borderRadius: 8,
            border: `3px solid ${t.background}`,
          },
          // Numeric columns line up only when the figures share a width.
          '.tabular': { fontVariantNumeric: 'tabular-nums' },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          outlined: { borderColor: t.divider },
          elevation1: { boxShadow: t.shadow },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 14, minHeight: 34 },
          sizeSmall: { minHeight: 30, paddingInline: 11, fontSize: '0.8rem' },
          outlined: { borderColor: t.divider, '&:hover': { borderColor: 'currentColor' } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 8, '&:hover': { backgroundColor: t.railHover } },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: t.paper,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: t.divider },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: '0.83rem' } } },
      MuiFormHelperText: { styleOverrides: { root: { marginInline: 2, fontSize: '0.7rem' } } },
      MuiTable: { styleOverrides: { root: { borderCollapse: 'separate' } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: t.divider, fontSize: '0.82rem' },
          head: {
            backgroundColor: t.tableHead,
            color: t.textSecondary,
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          },
          sizeSmall: { paddingBlock: 7 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&.MuiTableRow-hover:hover': { backgroundColor: t.rowHover } },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: { fontSize: '0.78rem' },
          selectLabel: { fontSize: '0.78rem' },
          displayedRows: { fontSize: '0.78rem' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
          sizeSmall: { fontWeight: 600, borderRadius: 6, height: 22, fontSize: '0.72rem' },
          outlined: { borderColor: t.divider },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 42 },
          indicator: { height: 2.5, borderRadius: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 42,
            paddingInline: 14,
            fontSize: '0.83rem',
            fontWeight: 600,
            color: t.textSecondary,
            '&.Mui-selected': { color: mode === 'light' ? BRAND.blueDark : '#7DA9F5' },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { fontSize: 12, borderRadius: 6, paddingInline: 8 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { border: `1px solid ${t.divider}`, boxShadow: t.shadow, borderRadius: 10 },
        },
      },
      MuiMenuItem: { styleOverrides: { root: { fontSize: '0.83rem', minHeight: 36 } } },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 34 } } },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: t.paper,
            color: t.textPrimary,
            borderBottom: `1px solid ${t.divider}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: t.paper,
            borderRight: `1px solid ${t.divider}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${t.divider}`, backgroundImage: 'none' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1rem', fontWeight: 700, paddingBottom: 8 } },
      },
      MuiDialogActions: { styleOverrides: { root: { padding: 16, paddingTop: 8 } } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, fontSize: '0.82rem', alignItems: 'center' },
          standardInfo: mode === 'light' ? { backgroundColor: BRAND.blueSoft } : undefined,
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, height: 8, backgroundColor: t.timelineRail },
          bar: { borderRadius: 999 },
        },
      },
      MuiSkeleton: { defaultProps: { animation: 'wave' } },
      MuiDivider: { styleOverrides: { root: { borderColor: t.divider } } },
      MuiLink: { defaultProps: { underline: 'hover' } },
    },
  });
}

/** Default theme for contexts that render outside the colour-mode provider. */
export const theme = createAppTheme('light');
