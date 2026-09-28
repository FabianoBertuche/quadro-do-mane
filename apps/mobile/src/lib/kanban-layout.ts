export const KANBAN_COLUMN_WIDTH = 272;
export const KANBAN_COLUMN_GAP = 10;
export const KANBAN_BOARD_PADDING = 16;
export const KANBAN_AUTO_SCROLL_EDGE = 56;

export function columnContentX(index: number): number {
  return KANBAN_BOARD_PADDING + index * (KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP);
}

interface ColumnIndexAtPointerInput {
  pointerX: number;
  boardPageX: number;
  boardScrollX: number;
  columnCount: number;
  boardWidth: number;
}

export function columnIndexAtPointer({
  pointerX,
  boardPageX,
  boardScrollX,
  columnCount,
  boardWidth,
}: ColumnIndexAtPointerInput): number | null {
  if (pointerX < boardPageX || pointerX >= boardPageX + boardWidth) {
    return null;
  }

  const contentX = pointerX - boardPageX + boardScrollX;
  const positionAfterPadding = contentX - KANBAN_BOARD_PADDING;
  if (positionAfterPadding < 0) return null;

  const columnStride = KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP;
  const columnIndex = Math.floor(positionAfterPadding / columnStride);
  const positionInStride = positionAfterPadding % columnStride;

  if (columnIndex >= columnCount || positionInStride >= KANBAN_COLUMN_WIDTH) {
    return null;
  }

  return columnIndex;
}

interface AutoScrollDirectionInput {
  pointer: number;
  viewportStart: number;
  viewportSize: number;
  contentOffset: number;
  contentSize: number;
  edge?: number;
}

export function autoScrollDirection({
  pointer,
  viewportStart,
  viewportSize,
  contentOffset,
  contentSize,
  edge = KANBAN_AUTO_SCROLL_EDGE,
}: AutoScrollDirectionInput): -1 | 0 | 1 {
  if (pointer <= viewportStart + edge && contentOffset > 0) return -1;

  const viewportEnd = viewportStart + viewportSize;
  if (pointer >= viewportEnd - edge && contentOffset + viewportSize < contentSize) {
    return 1;
  }

  return 0;
}
