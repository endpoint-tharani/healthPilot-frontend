import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import DevicesIcon from '@mui/icons-material/Devices';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useBranches } from '@/hooks/useReferenceData';
import { useColorMode } from '@/app/ColorModeContext';
import { paletteTokens } from '@/app/theme';
import { GlobalSearch } from '@/components/GlobalSearch';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { humanise } from '@/utils/format';
import { NAV_SECTIONS, QUICK_ACTIONS, ROUTE_TITLES, type NavItem } from './navigation';

const DRAWER_WIDTH = 264;
const DRAWER_WIDTH_COLLAPSED = 76;

/** Bordered square icon button, as used across the top bar. */
const TOOL_BUTTON = { border: 1, borderColor: 'divider', borderRadius: 2, p: 0.85 } as const;

/** Wording rule: the central warehouse is a branch, named in full wherever it shows. */
function branchLabel(branch: { name: string; type?: string } | null | undefined): string {
  if (!branch) {
    return 'Branch scoped';
  }
  return branch.name;
}

/**
 * Name for the current route, used for the browser tab only. The workspace shows
 * no breadcrumb trail: the sidebar already says where you are, and every detail
 * page carries its own way back, so a third copy of the same information was
 * only costing vertical space.
 */
function usePageTitle(): string {
  const { pathname } = useLocation();

  if (pathname === '/') {
    return 'Dashboard';
  }

  const allItems = NAV_SECTIONS.flatMap((section) => section.items);
  const segments = pathname.split('/').filter(Boolean);
  let current = '';
  let title = 'Dashboard';

  segments.forEach((segment, index) => {
    current += `/${segment}`;
    const navItem = allItems.find((item) => item.path === current);
    if (navItem) {
      title = navItem.label;
    } else if (ROUTE_TITLES[current]) {
      title = ROUTE_TITLES[current];
    } else if (index === segments.length - 1) {
      // Trailing id segment: a short reference rather than a raw uuid.
      title = segment.length > 12 ? 'Details' : humanise(segment);
    }
  });

  return title;
}

function NavButton({
  item,
  selected,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  selected: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const theme = useTheme();
  const tokens = paletteTokens(theme.palette.mode as 'light' | 'dark');

  const button = (
    <ListItemButton
      component={RouterLink}
      to={item.path}
      selected={selected}
      onClick={onNavigate}
      aria-current={selected ? 'page' : undefined}
      sx={{
        borderRadius: 2,
        mx: collapsed ? 0.75 : 1,
        my: 0.15,
        px: collapsed ? 1.25 : 1.5,
        minHeight: 36,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: selected ? tokens.navActiveText : 'text.secondary',
        '&.Mui-selected': {
          backgroundColor: tokens.navActive,
          '&:hover': { backgroundColor: tokens.navActive },
        },
        '&:hover': { backgroundColor: tokens.railHover },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed ? 0 : 30,
          color: selected ? tokens.navActiveText : 'text.secondary',
        }}
      >
        {item.icon}
      </ListItemIcon>
      {collapsed ? null : (
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{ fontSize: 13, fontWeight: selected ? 700 : 500 }}
        />
      )}
    </ListItemButton>
  );

  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      <Box>{button}</Box>
    </Tooltip>
  ) : (
    button
  );
}

export function AppLayout() {
  const { user, logout, canAny, can, hasAllBranches } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const tokens = paletteTokens(theme.palette.mode as 'light' | 'dark');
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { mode, toggle } = useColorMode();
  const { data: branches } = useBranches();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenu, setUserMenu] = useState<null | HTMLElement>(null);
  const [createMenu, setCreateMenu] = useState<null | HTMLElement>(null);
  const [branchMenu, setBranchMenu] = useState<null | HTMLElement>(null);

  const pageTitle = usePageTitle();

  // Keep the browser tab in step with the section being viewed.
  useEffect(() => {
    document.title = `${pageTitle} · HealthPilot Pharmacy ERP`;
  }, [pageTitle]);

  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        // An empty permission list means the item is not permission-gated at
        // all - the user's own notification inbox, for example.
        items: section.items.filter(
          (item) => item.permissions.length === 0 || canAny(...item.permissions)
        ),
      })).filter((section) => section.items.length > 0),
    [canAny]
  );

  // Only one group is open at a time; the one holding the current route starts open.
  const activeGroup = useMemo(
    () =>
      visibleSections.find(
        (section) =>
          section.title &&
          section.items.some(
            (item) =>
              location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          )
      )?.title ?? null,
    [visibleSections, location.pathname]
  );
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);

  // Landing in another group (breadcrumb, quick action, deep link) moves the open group with it.
  useEffect(() => {
    if (activeGroup) {
      setOpenGroup(activeGroup);
    }
  }, [activeGroup]);

  const quickActions = QUICK_ACTIONS.filter((action) => can(action.permission));

  const handleLogout = async (allSessions: boolean) => {
    setUserMenu(null);
    await logout(allSessions);
    navigate('/login', { replace: true });
  };

  const railCollapsed = collapsed && isDesktop;
  const drawerWidth = railCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: railCollapsed ? 1.5 : 2.5, gap: 1.25, minHeight: 64 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <LocalPharmacyIcon fontSize="small" />
        </Box>
        {railCollapsed ? null : (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1} noWrap>
              Health
              <Box component="span" sx={{ color: 'primary.main' }}>
                Pilot
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pharmacy ERP
            </Typography>
          </Box>
        )}
      </Toolbar>
      <Divider />

      <Box component="nav" aria-label="Main" sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {visibleSections.map((section) => {
          if (!section.title) {
            return (
              <List key="root" dense disablePadding sx={{ mb: 0.5 }}>
                {section.items.map((item) => (
                  <NavButton
                    key={item.path}
                    item={item}
                    collapsed={railCollapsed}
                    selected={location.pathname === '/'}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </List>
            );
          }

          const open = openGroup === section.title;
          return (
            <Box key={section.title} sx={{ mb: 0.5 }}>
              {railCollapsed ? (
                <Divider sx={{ mx: 1.5, my: 1 }} />
              ) : (
                <ListItemButton
                  onClick={() =>
                    setOpenGroup((current) => (current === section.title ? null : section.title))
                  }
                  aria-expanded={open}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    minHeight: 32,
                    '&:hover': { backgroundColor: tokens.railHover },
                  }}
                >
                  <ListItemText
                    primary={section.title}
                    primaryTypographyProps={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                    }}
                  />
                  <ExpandMoreIcon
                    fontSize="small"
                    sx={{
                      color: 'text.disabled',
                      transition: 'transform 150ms',
                      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
                    }}
                  />
                </ListItemButton>
              )}

              <Collapse in={railCollapsed ? true : open} timeout="auto" unmountOnExit>
                <List
                  dense
                  disablePadding
                  sx={
                    railCollapsed
                      ? undefined
                      : {
                          ml: 2.25,
                          borderLeft: 2,
                          borderColor: 'divider',
                          '& .MuiListItemButton-root': { ml: 0 },
                        }
                  }
                >
                  {section.items.map((item) => (
                    <NavButton
                      key={item.path}
                      item={item}
                      collapsed={railCollapsed}
                      selected={
                        location.pathname === item.path ||
                        location.pathname.startsWith(`${item.path}/`)
                      }
                      onNavigate={() => setMobileOpen(false)}
                    />
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {isDesktop ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.5, pb: 1 }}>
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <IconButton
              size="small"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              sx={TOOL_BUTTON}
            >
              {collapsed ? (
                <ChevronRightIcon fontSize="small" />
              ) : (
                <ChevronLeftIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}

      <Divider />
      <Box
        sx={{
          p: railCollapsed ? 1 : 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          justifyContent: railCollapsed ? 'center' : 'flex-start',
        }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </Avatar>
        {railCollapsed ? null : (
          <>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {humanise(user?.role)}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={() => void handleLogout(false)} aria-label="Sign out">
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: 'width 180ms, margin 180ms',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: 64 }}>
          <IconButton
            onClick={() => setMobileOpen((open) => !open)}
            sx={{ ...TOOL_BUTTON, display: { md: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuIcon fontSize="small" />
          </IconButton>

          {/* Branch scope the session is limited to; never called a "location". */}
          <Button
            onClick={(event) => setBranchMenu(event.currentTarget)}
            endIcon={<UnfoldMoreIcon fontSize="small" />}
            aria-label="Branch scope"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              border: 1,
              borderColor: 'divider',
              color: 'text.primary',
              px: 1,
              py: 0.4,
              gap: 0.5,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: tokens.navActive,
                color: tokens.navActiveText,
                mr: 0.75,
              }}
            >
              {hasAllBranches ? (
                <AccountTreeOutlinedIcon sx={{ fontSize: 14 }} />
              ) : user?.branch?.type === 'CENTRAL_WAREHOUSE' ? (
                <WarehouseOutlinedIcon sx={{ fontSize: 14 }} />
              ) : (
                <StorefrontOutlinedIcon sx={{ fontSize: 14 }} />
              )}
            </Box>
            <Box sx={{ textAlign: 'left', minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                lineHeight={1.1}
                sx={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                Branch
              </Typography>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 170 }}>
                {hasAllBranches ? 'All branches' : branchLabel(user?.branch)}
              </Typography>
            </Box>
          </Button>

          <Menu
            anchorEl={branchMenu}
            open={Boolean(branchMenu)}
            onClose={() => setBranchMenu(null)}
            slotProps={{ paper: { sx: { minWidth: 280 } } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Branch access
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {hasAllBranches ? 'Every branch in the company' : 'Your assigned branches'}
              </Typography>
            </Box>
            <Divider />
            {(branches ?? []).map((branch) => (
              <MenuItem
                key={branch.id}
                selected={branch.id === user?.branch?.id}
                onClick={() => {
                  setBranchMenu(null);
                  navigate(`/inventory?branch=${branch.id}`);
                }}
              >
                <ListItemIcon>
                  {branch.type === 'CENTRAL_WAREHOUSE' ? (
                    <WarehouseOutlinedIcon fontSize="small" />
                  ) : (
                    <StorefrontOutlinedIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={branch.name}
                  secondary={`${branch.code} · ${branch.type === 'CENTRAL_WAREHOUSE' ? 'Central warehouse' : 'Branch'}`}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: 11 }}
                />
              </MenuItem>
            ))}
            <Divider />
            <MenuItem
              onClick={() => {
                setBranchMenu(null);
                navigate('/branches');
              }}
            >
              Manage branches
            </MenuItem>
          </Menu>

          {/* Global search across documents, products, suppliers and branches. */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              px: { xs: 0, md: 2 },
              minWidth: 0,
            }}
          >
            <GlobalSearch />
          </Box>

          {quickActions.length > 0 ? (
            <>
              <Button
                onClick={(event) => setCreateMenu(event.currentTarget)}
                variant="contained"
                startIcon={<AddIcon />}
                size="small"
                aria-label="Create a document"
                sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Create
              </Button>
              <IconButton
                onClick={(event) => setCreateMenu(event.currentTarget)}
                aria-label="Create a document"
                sx={{
                  ...TOOL_BUTTON,
                  display: { xs: 'inline-flex', sm: 'none' },
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={createMenu}
                open={Boolean(createMenu)}
                onClose={() => setCreateMenu(null)}
                slotProps={{ paper: { sx: { minWidth: 230 } } }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
                  Create new
                </Typography>
                {quickActions.map((action) => (
                  <MenuItem
                    key={action.path}
                    onClick={() => {
                      setCreateMenu(null);
                      navigate(action.path);
                    }}
                  >
                    {action.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : null}

          <NotificationsMenu buttonSx={TOOL_BUTTON} />

          <IconButton
            onClick={(event) => setUserMenu(event.currentTarget)}
            aria-label="Account and preferences"
            sx={{ p: 0.5, flexShrink: 0 }}
          >
            <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 13 }}>
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={userMenu}
            open={Boolean(userMenu)}
            onClose={() => setUserMenu(null)}
            slotProps={{ paper: { sx: { minWidth: 260 } } }}
          >
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography variant="subtitle2">{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {user?.email}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight={700}>
                {humanise(user?.role)} ·{' '}
                {hasAllBranches ? 'All branches' : branchLabel(user?.branch)}
              </Typography>
            </Box>
            <Divider />
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1, display: 'block' }}>
              Preferences
            </Typography>
            <MenuItem onClick={toggle}>
              <ListItemIcon>
                {mode === 'light' ? (
                  <DarkModeOutlinedIcon fontSize="small" />
                ) : (
                  <LightModeOutlinedIcon fontSize="small" />
                )}
              </ListItemIcon>
              {mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => void handleLogout(false)}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
            <MenuItem onClick={() => void handleLogout(true)}>
              <ListItemIcon>
                <DevicesIcon fontSize="small" />
              </ListItemIcon>
              Sign out of all sessions
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="div"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, transition: 'width 180ms' }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              transition: 'width 180ms',
              overflowX: 'hidden',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          px: { xs: 2, md: 3 },
          // Asymmetric on purpose: the page heading starts close under the app
          // bar, while the bottom keeps room to scroll the last card clear.
          pt: 1.5,
          pb: 3,
          mt: 8,
          minWidth: 0,
        }}
      >
        {/* Each page opens with its own heading; the shell adds nothing above it. */}
        <Outlet />
      </Box>
    </Box>
  );
}
