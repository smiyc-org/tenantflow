import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DirectoryObject, ResourceObject, WorkloadType } from '@tenantflow/shared';
import { searchApi } from '../../api/search.js';

interface Props {
  workload: WorkloadType;
  type: 'user' | 'group' | 'resource';
  placeholder?: string;
  onSelect: (item: DirectoryObject | ResourceObject) => void;
  value?: string;
}

export function ResourceSearch({ workload, type, placeholder, onSelect, value }: Props) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['search', workload, type, query],
    queryFn: () => searchApi.search({ q: query, workload, type }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const results = type === 'resource' ? data?.resources ?? [] : data?.principals ?? [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Search...'}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue"
      />
      {isFetching && (
        <div className="absolute right-3 top-2.5">
          <div className="w-4 h-4 border-2 border-ms-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((item) => {
            const display = item.displayName;
            const disambig = 'disambiguator' in item ? item.disambiguator : item.url ?? item.path ?? '';
            return (
              <li
                key={item.id}
                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer"
                onMouseDown={() => {
                  onSelect(item);
                  setQuery(item.displayName);
                  setOpen(false);
                }}
              >
                <div className="text-sm font-medium text-gray-800">{display}</div>
                <div className="text-xs text-gray-500 truncate">{disambig}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
