import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  Stack,
  TextField,
  Typography,
  type AutocompleteInputChangeReason,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { requirementApi } from '@/api/endpoints';
import { formatQuantity } from '@/utils/decimal';
import { formatDate } from '@/utils/format';
import type { DocumentDetail, DocumentSummary } from '@/types/api';

/**
 * Picks the stock requisition a document is being raised against.
 *
 * It replaces a plain `<Select>` fed by the first 100 requisitions. That worked
 * while there were a handful and stopped working the moment there were not: the
 * list is served newest-first, so REQ-0001 - the one the demo scenario is built
 * around - fell off the end and became unreachable, with nothing on screen to
 * suggest it existed.
 *
 * The search therefore runs on the server rather than over a pre-loaded page.
 * The user types a requisition number, a branch or a product, the backend's own
 * document search answers it, and only a page of matches is ever fetched.
 *
 * Nothing about what may be raised against a requisition changes here: the
 * backend still enforces the status and the outstanding quantity exactly as
 * before. This only decides which requisitions a user can see in order to pick
 * one.
 */

/** Requisition statuses that may still be sourced against. The backend agrees. */
const ORDERABLE_STATUSES = 'APPROVED,PARTIALLY_FULFILLED';

/** One page of matches. Small on purpose: this is a picker, not a report. */
const PAGE_SIZE = 25;

const SEARCH_DEBOUNCE_MS = 250;

export interface RequirementOption {
  id: string;
  documentNumber: string;
  branchName: string;
  /** "Insulin Glargine 100 IU/ml · 100 Vial", from the requisition's own lines. */
  itemSummary: string;
  requiredBy: string | null;
  status: string;
}

function summariseLines(
  lines: { product: { name: string }; quantity: string; unitOfMeasure: string | null }[] | undefined,
  unitFallback?: string
): string {
  if (!lines || lines.length === 0) {
    return '';
  }
  const [first] = lines;
  const unit = first.unitOfMeasure ?? unitFallback ?? '';
  const head = `${first.product.name} · ${formatQuantity(first.quantity)}${unit ? ' ' + unit : ''}`;
  return lines.length > 1 ? `${head} +${lines.length - 1} more` : head;
}

function optionFromSummary(row: DocumentSummary): RequirementOption {
  return {
    id: row.id,
    documentNumber: row.documentNumber,
    branchName: row.branch?.name ?? 'Unassigned branch',
    itemSummary: summariseLines(row.lineSummary),
    requiredBy: row.expectedDeliveryDate,
    status: row.status,
  };
}

function optionFromDetail(detail: DocumentDetail): RequirementOption {
  return {
    id: detail.id,
    documentNumber: detail.documentNumber,
    branchName: detail.branch?.name ?? 'Unassigned branch',
    itemSummary: summariseLines(
      detail.lineItems.map((line) => ({
        // A detail line's product is a reference that may carry only an id.
        product: { name: line.product.name ?? 'Unnamed product' },
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
      })),
      detail.lineItems[0]?.product.unit
    ),
    requiredBy: detail.expectedDeliveryDate,
    status: detail.status,
  };
}

export function optionLabel(option: RequirementOption): string {
  return [option.documentNumber, option.branchName, option.itemSummary].filter(Boolean).join(' | ');
}

export function RequirementPicker<T extends FieldValues>({
  control,
  name,
  label,
  helperText,
  required,
  branchId,
  disabled,
  noOptionsText,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  helperText?: string;
  required?: boolean;
  /**
   * Restricts the list to requisitions raised by one branch. A transfer counts
   * towards a requisition only when it is going to the branch that raised it, so
   * the picker declines to offer one the backend would reject.
   */
  branchId?: string;
  disabled?: boolean;
  noOptionsText?: string;
}) {
  // What the user has typed, and the debounced version of it the server is
  // asked about. Typing is fast and the network is not, so they are not the
  // same value.
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const results = useQuery({
    queryKey: ['stock-requirements', 'picker', { search, branchId: branchId ?? null }],
    queryFn: () =>
      requirementApi.list({
        status: ORDERABLE_STATUSES,
        limit: PAGE_SIZE,
        // Ascending by number, so the oldest outstanding requisition is the
        // first thing offered rather than the last thing truncated.
        sortBy: 'documentNumber',
        sortOrder: 'asc',
        ...(search ? { search } : {}),
        ...(branchId ? { branchId } : {}),
      }),
    select: (result) => result.data.map(optionFromSummary),
    enabled: !disabled,
  });

  const handleInputChange = (next: string, reason: AutocompleteInputChangeReason) => {
    // Only what the user actually typed drives the search. MUI also reports the
    // text it writes itself when an option is chosen ('reset'), and searching
    // for that would narrow the list to the thing already selected.
    if (reason === 'input') {
      setTyped(next);
    } else if (reason === 'clear') {
      setTyped('');
    }
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <RequirementAutocomplete
          value={field.value ?? ''}
          onChange={(id) => field.onChange(id)}
          onBlur={field.onBlur}
          onInputChange={handleInputChange}
          options={results.data ?? []}
          loading={results.isFetching}
          label={label}
          required={required}
          disabled={disabled}
          error={fieldState.error?.message}
          helperText={helperText}
          noOptionsText={noOptionsText}
        />
      )}
    />
  );
}

/**
 * The control itself, split out so the selected-value lookup is not tangled up
 * in the form wiring.
 *
 * The text in the box is left to MUI rather than controlled here. It derives it
 * from the selected option, which is what keeps the field showing REQ-0001 after
 * the user picks it, and still showing it when the value arrived in the URL and
 * the option was fetched a moment later.
 *
 * A selection that is not in the current page of matches - because the user
 * searched for something else afterwards, or arrived with the id already set -
 * is fetched on its own, so the field never falls blank on a value it holds.
 */
function RequirementAutocomplete({
  value,
  onChange,
  onBlur,
  onInputChange,
  options,
  loading,
  label,
  required,
  disabled,
  error,
  helperText,
  noOptionsText,
}: {
  value: string;
  onChange: (id: string) => void;
  onBlur: () => void;
  onInputChange: (next: string, reason: AutocompleteInputChangeReason) => void;
  options: RequirementOption[];
  loading: boolean;
  label: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  noOptionsText?: string;
}) {
  const inPage = options.find((option) => option.id === value);

  const selectedDetail = useQuery({
    queryKey: ['stock-requirements', value],
    queryFn: () => requirementApi.get(value),
    enabled: Boolean(value) && !inPage,
    select: optionFromDetail,
  });

  const selected = inPage ?? (value ? (selectedDetail.data ?? null) : null);

  // The selection is always among the options, so MUI can match it even when the
  // current search would not have returned it.
  const offered = useMemo(() => {
    if (!selected || options.some((option) => option.id === selected.id)) {
      return options;
    }
    return [selected, ...options];
  }, [options, selected]);

  return (
    <Autocomplete<RequirementOption, false, false, false>
      options={offered}
      value={selected}
      disabled={disabled}
      loading={loading}
      onBlur={onBlur}
      onChange={(_event, option) => onChange(option?.id ?? '')}
      onInputChange={(_event, next, reason) => onInputChange(next, reason)}
      // Matching happens on the server, so the options handed back are already
      // the answer; filtering them again locally would hide valid results.
      filterOptions={(all) => all}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      getOptionLabel={optionLabel}
      noOptionsText={noOptionsText ?? 'No matching stock requisitions'}
      renderOption={(props, option) => {
        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
        return (
          <Box component="li" key={key} {...rest}>
            <Stack sx={{ width: '100%', minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" fontWeight={700}>
                  {option.documentNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {option.branchName}
                </Typography>
                <Chip
                  size="small"
                  label={option.status.replace(/_/g, ' ')}
                  sx={{ height: 18, fontSize: 10 }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap>
                {option.itemSummary || 'No lines'}
                {option.requiredBy ? ` · required ${formatDate(option.requiredBy)}` : ''}
              </Typography>
            </Stack>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={Boolean(error)}
          helperText={error ?? helperText}
          placeholder="Search by requisition number, branch or product"
        />
      )}
    />
  );
}
