import { describe, expect, it } from 'vitest';
import { reminderWhenLabel } from './dashboard';

describe('reminderWhenLabel', () => {
  it('retorna "Hoje" quando daysLeft é 0', () => {
    expect(reminderWhenLabel(0)).toBe('Hoje');
  });

  it('retorna "Amanhã" quando daysLeft é 1', () => {
    expect(reminderWhenLabel(1)).toBe('Amanhã');
  });

  it('retorna "Em N dias" para dias futuros', () => {
    expect(reminderWhenLabel(2)).toBe('Em 2 dias');
    expect(reminderWhenLabel(7)).toBe('Em 7 dias');
  });

  it('trata values negativos como "Hoje" (evento já iniciado)', () => {
    expect(reminderWhenLabel(-3)).toBe('Hoje');
  });
});