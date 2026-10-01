'use client';

import { useId, useState } from 'react';
import type { AiRuntimeModel } from '@/lib/ai-runtime';

interface AiModelComboboxProps {
  models: AiRuntimeModel[];
  value?: string;
  disabled?: boolean;
  onSelect: (slug: string) => void;
}

export function AiModelCombobox({ models, value, disabled = false, onSelect }: AiModelComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-models`;
  const [query, setQuery] = useState('');
  const selected = models.find((model) => model.slug === value);
  const filteredModels = models.filter((model) => `${model.displayName} ${model.slug}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-muted-foreground">Modelo global</label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        value={query || selected?.displayName || ''}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={models.length ? 'Buscar modelo...' : 'Nenhum modelo disponível'}
        disabled={disabled || !models.length}
        aria-controls={listboxId}
        aria-expanded={filteredModels.length > 0}
        aria-autocomplete="list"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
      {filteredModels.length > 0 && (
        <ul id={listboxId} role="listbox" aria-label="Modelos disponíveis" className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {filteredModels.map((model) => (
            <li key={model.slug} role="option" aria-selected={model.slug === value}>
              <button type="button" onClick={() => { onSelect(model.slug); setQuery(''); }} disabled={disabled} className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-muted disabled:opacity-50">
                <span className="text-sm font-medium">{model.displayName}</span>
                <span className="text-xs text-muted-foreground">{model.slug}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {models.length > 0 && <p className="mt-1 text-xs text-muted-foreground">A seleção altera o modelo para todos os usuários deste tenant.</p>}
    </div>
  );
}
