import { describe, expect, it } from 'vitest';
import {
  autoScrollDirection,
  columnContentX,
  columnIndexAtPointer,
} from './kanban-layout';

describe('columnContentX', () => {
  it('retorna o inicio da coluna no espaco de conteudo', () => {
    expect(columnContentX(0)).toBe(16);
    expect(columnContentX(1)).toBe(298);
  });
});

describe('columnIndexAtPointer', () => {
  const board = {
    boardPageX: 100,
    boardScrollX: 0,
    boardWidth: 320,
    columnCount: 2,
  };

  it('encontra a primeira coluna', () => {
    expect(columnIndexAtPointer({ ...board, pointerX: 116 })).toBe(0);
  });

  it('encontra uma coluna depois do scroll horizontal', () => {
    expect(
      columnIndexAtPointer({ ...board, pointerX: 120, boardScrollX: 282 }),
    ).toBe(1);
  });

  it('retorna null no padding, gap e depois da ultima coluna', () => {
    expect(columnIndexAtPointer({ ...board, pointerX: 110 })).toBeNull();
    expect(columnIndexAtPointer({ ...board, pointerX: 388 })).toBeNull();
    expect(columnIndexAtPointer({ ...board, pointerX: 670 })).toBeNull();
  });

  it('retorna null fora do viewport horizontal do board', () => {
    expect(columnIndexAtPointer({ ...board, pointerX: 99 })).toBeNull();
    expect(columnIndexAtPointer({ ...board, pointerX: 421 })).toBeNull();
  });
});

describe('autoScrollDirection', () => {
  const viewport = {
    viewportStart: 100,
    viewportSize: 300,
    contentSize: 1_000,
  };

  it('rola para o inicio perto da borda inicial quando ha conteudo antes', () => {
    expect(
      autoScrollDirection({ ...viewport, pointer: 120, contentOffset: 20 }),
    ).toBe(-1);
  });

  it('rola para o final perto da borda final quando ha conteudo depois', () => {
    expect(
      autoScrollDirection({ ...viewport, pointer: 380, contentOffset: 20 }),
    ).toBe(1);
  });

  it('nao rola no meio do viewport', () => {
    expect(
      autoScrollDirection({ ...viewport, pointer: 250, contentOffset: 20 }),
    ).toBe(0);
  });

  it('respeita os limites de conteudo', () => {
    expect(
      autoScrollDirection({ ...viewport, pointer: 120, contentOffset: 0 }),
    ).toBe(0);
    expect(
      autoScrollDirection({ ...viewport, pointer: 380, contentOffset: 700 }),
    ).toBe(0);
  });
});
