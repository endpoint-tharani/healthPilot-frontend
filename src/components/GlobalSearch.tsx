import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { branchApi, documentApi, productApi, supplierApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { DocumentStatusChip } from './StatusChip';
import { DOCUMENT_TYPE_LABELS, documentPath, formatDate } from '@/utils/format';
import type { DocumentStatus } from '@/types/api';

interface SearchResult {
  key: string;
  group: string;
  primary: string;
  secondary?: string;
  status?: DocumentStatus;
  meta?: string;
  to: string;
}

const MIN_TERM = 2;

/**
 * One search box over the records people actually look for by name or number.
 * It reuses the existing list endpoints - `?search=` on documents, products,
 * suppliers and branches - so there is no new search backend and every result
 * is already scoped to what the caller may read. Each group is only queried
 * when the user holds the permission for it.
 */
export function GlobalSearch({ placeholder = 'Search documents, products, suppliers…' }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<SearchResult | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounced so a request is not sent per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setTerm(input.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [input]);

  // "/" jumps to search from anywhere, as long as the user is not already typing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const active = term.length >= MIN_TERM;

  const results = useQueries({
    queries: [
      {
        queryKey: ['search', 'documents', term],
        queryFn: () => documentApi.list({ search: term, limit: 6 }),
        enabled: active && can('DOCUMENT_VIEW'),
        staleTime: 30_000,
      },
      {
        queryKey: ['search', 'products', term],
        queryFn: () => productApi.list({ search: term, limit: 4 }),
        enabled: active && can('PRODUCT_VIEW'),
        staleTime: 30_000,
      },
      {
        queryKey: ['search', 'suppliers', term],
        queryFn: () => supplierApi.list({ search: term, limit: 4 }),
        enabled: active && can('SUPPLIER_VIEW'),
        staleTime: 30_000,
      },
      {
        queryKey: ['search', 'branches', term],
        queryFn: () => branchApi.list({ search: term, limit: 4 }),
        enabled: active && can('BRANCH_VIEW'),
        staleTime: 30_000,
      },
    ],
  });

  const [documents, products, suppliers, branches] = results;
  const loading = active && results.some((result) => result.isFetching);

  const options = useMemo<SearchResult[]>(() => {
    if (!active) {
      return [];
    }
    const rows: SearchResult[] = [];

    for (const document of documents.data?.data ?? []) {
      rows.push({
        key: `doc-${document.id}`,
        group: 'Documents',
        primary: document.documentNumber,
        secondary: DOCUMENT_TYPE_LABELS[document.documentType],
        status: document.status,
        meta: [document.branch?.name, formatDate(document.documentDate)]
          .filter(Boolean)
          .join(' · '),
        to: documentPath(document.documentType, document.id),
      });
    }
    for (const product of products.data?.data ?? []) {
      rows.push({
        key: `product-${product.id}`,
        group: 'Products',
        primary: product.name,
        secondary: product.code,
        meta: product.unit,
        to: `/products?search=${encodeURIComponent(product.code)}`,
      });
    }
    for (const supplier of suppliers.data?.data ?? []) {
      rows.push({
        key: `supplier-${supplier.id}`,
        group: 'Suppliers',
        primary: supplier.name,
        secondary: supplier.code,
        to: `/suppliers?search=${encodeURIComponent(supplier.code)}`,
      });
    }
    for (const branch of branches.data?.data ?? []) {
      rows.push({
        key: `branch-${branch.id}`,
        group: 'Branches',
        primary: branch.name,
        secondary: branch.code,
        meta: branch.type === 'CENTRAL_WAREHOUSE' ? 'Central Pharmacy Warehouse' : 'Branch',
        to: `/branches?search=${encodeURIComponent(branch.code)}`,
      });
    }
    return rows;
  }, [active, documents.data, products.data, suppliers.data, branches.data]);

  const submitToRegister = () => {
    const value = input.trim();
    navigate(value ? `/documents?search=${encodeURIComponent(value)}` : '/documents');
    setOpen(false);
  };

  return (
    <Autocomplete<SearchResult, false, false, true>
      freeSolo
      open={open && active}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      loading={loading}
      // The server has already filtered; filtering again would hide matches.
      filterOptions={(serverOptions) => serverOptions}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.primary)}
      inputValue={input}
      onInputChange={(_event, value, reason) => {
        if (reason !== 'reset') {
          setInput(value);
        }
      }}
      onChange={(_event, value) => {
        if (value && typeof value !== 'string') {
          navigate(value.to);
          setInput('');
          setOpen(false);
        }
      }}
      onHighlightChange={(_event, option) => setHighlighted(option)}
      noOptionsText={
        loading ? 'Searching…' : `Nothing matches "${term}". Press Enter to open the register.`
      }
      slotProps={{ paper: { sx: { mt: 0.5 } } }}
      sx={{ flex: 1, maxWidth: 560 }}
      renderOption={(props, option) => {
        // The row carries its own stable key: two groups can hold the same label.
        const { key: _generated, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & {
          key: string;
        };
        return (
          <Box component="li" key={option.key} {...rest} sx={{ display: 'block !important', py: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {option.primary}
              </Typography>
              {option.secondary ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.secondary}
                </Typography>
              ) : null}
              <Box sx={{ flex: 1 }} />
              {option.status ? <DocumentStatusChip status={option.status} /> : null}
            </Stack>
            {option.meta ? (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {option.meta}
              </Typography>
            ) : null}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder={placeholder}
          aria-label="Global search"
          onKeyDown={(event) => {
            // Enter on the raw text, with no result highlighted, opens the register
            // filtered by what was typed - the old behaviour of this box.
            if (event.key === 'Enter' && !highlighted) {
              event.preventDefault();
              submitToRegister();
            }
          }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <>
                {loading ? <CircularProgress size={15} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
