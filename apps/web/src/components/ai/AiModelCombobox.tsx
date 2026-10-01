'use client';

import { useId, useState } from 'react';
import type { AiRuntimeModel } from '@/lib/ai-runtime';

interface AiModelComboboxProps {
  models: AiRuntimeModel[];
  value?: string;
  disabled?: boolean;
  onSelect: (slug: string) => void;
}

export function getNextAiModelIndex(currentIndex: number, modelCount: number, key: string): number {
  if (modelCount === 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return modelCount - 1;
  if (key === 'ArrowDown') return (Math.max(currentIndex, -1) + 1) % modelCount;
  if (key === 'ArrowUp') return (Math.max(currentIndex, 0) - 1 + modelCount) % modelCount;
  return currentIndex;
}

export function AiModelCombobox({ models, value, disabled = false, onSelect }: AiModelComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-models`;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = models.find((model) => model.slug === value);
  const filteredModels = models.filter((model) => `${model.displayName} ${model.slug}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const activeModel = activeIndex >= 0 ? filteredModels[activeIndex] : undefined;

  const openList = () => {
    if (disabled || !models.length) return;
    setIsOpen(true);
    const selectedIndex = filteredModels.findIndex((model) => model.slug === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const selectModel = (model: AiRuntimeModel) => {
    if (disabled) return;
    onSelect(model.slug);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setQuery('');
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Enter' && isOpen && activeModel) {
      event.preventDefault();
      selectModel(activeModel);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex(getNextAiModelIndex(activeIndex, filteredModels.length, event.key));
    }
  };

  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-muted-foreground">Modelo global</label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        value={query || selected?.displayName || ''}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={openList}
        onBlur={() => {
          setIsOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={models.length ? 'Buscar modelo...' : 'Nenhum modelo disponível'}
        disabled={disabled || !models.length}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen && activeModel ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
      {isOpen && (
        <ul id={listboxId} role="listbox" aria-label="Modelos disponíveis" className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {filteredModels.length ? filteredModels.map((model, index) => (
            <li
              key={model.slug}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={model.slug === value}
              aria-disabled={disabled || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectModel(model)}
              className={`flex cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left ${index === activeIndex ? 'bg-muted' : 'hover:bg-muted'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
                <span className="text-sm font-medium">{model.displayName}</span>
                <span className="text-xs text-muted-foreground">{model.slug}</span>
            </li>
          )) : <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum modelo encontrado.</li>}
        </ul>
      )}
      {models.length > 0 && <p className="mt-1 text-xs text-muted-foreground">A seleção altera o modelo para todos os usuários deste tenant.</p>}
    </div>
  );
}
