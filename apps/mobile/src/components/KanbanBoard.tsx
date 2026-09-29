import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Task, TaskStatus } from '@/lib/types';
import { isOverdue } from '@/lib/format';
import { resolveKanbanDrop } from '@/lib/kanban-dnd';
import { autoScrollDirection, columnIndexAtPointer } from '@/lib/kanban-layout';
import { colors } from '@/theme/colors';
import { Chip } from '@/components/ui';

type AutoScrollState = {
  boardDirection: -1 | 0 | 1;
  columnDirection: -1 | 0 | 1;
  statusId: string | null;
};

type ColumnViewport = {
  contentHeight: number;
  height: number;
  pageY: number;
};

export interface KanbanBoardProps {
  statuses: TaskStatus[];
  byStatus: Map<string, Task[]>;
  onTaskPress: (id: string) => void;
  onTaskDrop: (task: Task, toStatusId: string) => void | Promise<void>;
}

function dragStartedHaptic() {
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Drag_Start);
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function dragCompletedHaptic() {
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// Reanimated SharedValues are intentionally mutated by gesture callbacks/worklets.
/* eslint-disable react-hooks/immutability */
export function KanbanBoard({
  statuses,
  byStatus,
  onTaskPress,
  onTaskDrop,
}: KanbanBoardProps) {
  const boardRef = useRef<ScrollView>(null);
  const boardViewportRef = useRef<View>(null);
  const columnRefs = useRef<Record<string, ScrollView | null>>({});
  const boardBounds = useRef({ pageX: 0, pageY: 0, width: 0, contentWidth: 0, scrollX: 0 });
  const columnViewports = useRef<Record<string, ColumnViewport>>({});
  const columnScrollY = useRef<Record<string, number>>({});
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const autoScroll = useRef<AutoScrollState>({ boardDirection: 0, columnDirection: 0, statusId: null });
  const lastDragUpdateAt = useRef(0);
  const lastDragEndedAt = useRef(0);
  const draggingSourceStatusId = useRef<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverlay, setDragOverlay] = useState<{ task: Task; status: TaskStatus } | null>(null);
  const hoveredStatusId = useSharedValue<string | null>(null);
  const boardPageX = useSharedValue(0);
  const boardPageY = useSharedValue(0);
  const overlayX = useSharedValue(0);
  const overlayY = useSharedValue(0);
  const overlayActive = useSharedValue(false);

  const stopAutoScroll = useCallback(() => {
    autoScroll.current = { boardDirection: 0, columnDirection: 0, statusId: null };
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  }, []);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const getTargetStatusId = useCallback((absoluteX: number) => {
    const index = columnIndexAtPointer({
      pointerX: absoluteX,
      boardPageX: boardBounds.current.pageX,
      boardScrollX: boardBounds.current.scrollX,
      boardWidth: boardBounds.current.width,
      columnCount: statuses.length,
    });
    return index === null ? null : (statuses[index]?.id ?? null);
  }, [statuses]);

  const ensureAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) return;
    autoScrollTimer.current = setInterval(() => {
      const next = autoScroll.current;
      if (next.boardDirection !== 0) {
        const maxX = Math.max(0, boardBounds.current.contentWidth - boardBounds.current.width);
        const x = Math.max(0, Math.min(maxX, boardBounds.current.scrollX + next.boardDirection * 20));
        if (x === boardBounds.current.scrollX) next.boardDirection = 0;
        boardBounds.current.scrollX = x;
        boardRef.current?.scrollTo({ x, y: 0, animated: false });
      }
      if (next.statusId && next.columnDirection !== 0) {
        const viewport = columnViewports.current[next.statusId];
        const maxY = viewport ? Math.max(0, viewport.contentHeight - viewport.height) : 0;
        const y = Math.max(0, Math.min(maxY, (columnScrollY.current[next.statusId] ?? 0) + next.columnDirection * 16));
        if (y === (columnScrollY.current[next.statusId] ?? 0)) next.columnDirection = 0;
        columnScrollY.current[next.statusId] = y;
        columnRefs.current[next.statusId]?.scrollTo({ x: 0, y, animated: false });
      }
      const pointer = lastPointer.current;
      if (pointer) {
        const statusId = getTargetStatusId(pointer.x);
        hoveredStatusId.value = statusId;
        next.statusId = statusId;
        const viewport = statusId ? columnViewports.current[statusId] : undefined;
        next.columnDirection = viewport && statusId && statusId !== draggingSourceStatusId.current
          ? autoScrollDirection({ pointer: pointer.y, viewportStart: viewport.pageY, viewportSize: viewport.height, contentOffset: columnScrollY.current[statusId] ?? 0, contentSize: viewport.contentHeight })
          : 0;
      }
      if (next.boardDirection === 0 && next.columnDirection === 0 && autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
        autoScrollTimer.current = null;
      }
    }, 40);
  }, [getTargetStatusId, hoveredStatusId]);

  const updateDragTarget = useCallback((absoluteX: number, absoluteY: number, force = false) => {
    lastPointer.current = { x: absoluteX, y: absoluteY };
    const now = Date.now();
    if (!force && now - lastDragUpdateAt.current < 40) return;
    lastDragUpdateAt.current = now;
    const statusId = getTargetStatusId(absoluteX);
    hoveredStatusId.value = statusId;
    const viewport = statusId ? columnViewports.current[statusId] : undefined;
    autoScroll.current = {
      boardDirection: autoScrollDirection({ pointer: absoluteX, viewportStart: boardBounds.current.pageX, viewportSize: boardBounds.current.width, contentOffset: boardBounds.current.scrollX, contentSize: boardBounds.current.contentWidth }),
      columnDirection: viewport && statusId && statusId !== draggingSourceStatusId.current
        ? autoScrollDirection({ pointer: absoluteY, viewportStart: viewport.pageY, viewportSize: viewport.height, contentOffset: columnScrollY.current[statusId] ?? 0, contentSize: viewport.contentHeight })
        : 0,
      statusId,
    };
    if (autoScroll.current.boardDirection !== 0 || autoScroll.current.columnDirection !== 0) ensureAutoScroll();
    else stopAutoScroll();
  }, [ensureAutoScroll, getTargetStatusId, hoveredStatusId, stopAutoScroll]);

  const handleDragStart = useCallback((task: Task, sourceStatusId: string, absoluteX: number, absoluteY: number) => {
    const status = statuses.find((item) => item.id === sourceStatusId);
    if (!status) return;
    draggingSourceStatusId.current = sourceStatusId;
    setDraggingTaskId(task.id);
    setDragOverlay({ task, status });
    dragStartedHaptic();
    updateDragTarget(absoluteX, absoluteY, true);
  }, [statuses, updateDragTarget]);

  const handleDragEnd = useCallback((task: Task, absoluteX: number, absoluteY: number) => {
    updateDragTarget(absoluteX, absoluteY, true);
    const targetStatusId = getTargetStatusId(absoluteX);
    const allTasks = Array.from(byStatus.values()).flat();
    const drop = resolveKanbanDrop(task.id, targetStatusId, allTasks);
    if (drop) {
      dragCompletedHaptic();
      void onTaskDrop(task, drop.targetStatusId);
    }
  }, [byStatus, getTargetStatusId, onTaskDrop, updateDragTarget]);

  const handleDragFinalize = useCallback(() => {
    stopAutoScroll();
    lastPointer.current = null;
    draggingSourceStatusId.current = null;
    lastDragEndedAt.current = Date.now();
    hoveredStatusId.value = null;
    setDraggingTaskId(null);
    setDragOverlay(null);
  }, [hoveredStatusId, stopAutoScroll]);

  const measureBoard = useCallback(() => {
    requestAnimationFrame(() => {
      boardViewportRef.current?.measureInWindow((pageX, pageY, width) => {
        boardBounds.current.pageX = pageX;
        boardBounds.current.pageY = pageY;
        boardBounds.current.width = width;
        boardPageX.value = pageX;
        boardPageY.value = pageY;
      });
    });
  }, [boardPageX, boardPageY]);

  return (
    <View ref={boardViewportRef} style={styles.boardViewport} onLayout={measureBoard}>
      <ScrollView
        ref={boardRef}
        horizontal
        scrollEnabled={draggingTaskId === null}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.board}
        scrollEventThrottle={16}
        onContentSizeChange={(contentWidth) => { boardBounds.current.contentWidth = contentWidth; }}
        onScroll={(event) => { boardBounds.current.scrollX = event.nativeEvent.contentOffset.x; }}
      >
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            items={byStatus.get(status.id) ?? []}
            dragging={draggingTaskId !== null}
            hoveredStatusId={hoveredStatusId}
            boardPageX={boardPageX}
            boardPageY={boardPageY}
            overlayX={overlayX}
            overlayY={overlayY}
            overlayActive={overlayActive}
            onColumnRef={(node) => { columnRefs.current[status.id] = node; }}
            onColumnLayout={(pageY, height) => {
              const current = columnViewports.current[status.id] ?? { contentHeight: 0 };
              columnViewports.current[status.id] = { ...current, pageY, height };
            }}
            onColumnContentSizeChange={(_width, height) => {
              const current = columnViewports.current[status.id] ?? { pageY: 0, height: 0 };
              columnViewports.current[status.id] = { ...current, contentHeight: height };
            }}
            onColumnScroll={(y) => { columnScrollY.current[status.id] = y; }}
            onTaskPress={onTaskPress}
            onDragStart={handleDragStart}
            onDragUpdate={updateDragTarget}
            onDragEnd={handleDragEnd}
            onDragFinalize={handleDragFinalize}
            lastDragEndedAt={lastDragEndedAt}
          />
        ))}
      </ScrollView>
      {dragOverlay ? <KanbanDragOverlay task={dragOverlay.task} status={dragOverlay.status} active={overlayActive} x={overlayX} y={overlayY} /> : null}
    </View>
  );
}

function KanbanColumn({
  status, items, dragging, hoveredStatusId, boardPageX, boardPageY, overlayX, overlayY, overlayActive,
  onColumnRef, onColumnLayout, onColumnContentSizeChange, onColumnScroll, onTaskPress,
  onDragStart, onDragUpdate, onDragEnd, onDragFinalize, lastDragEndedAt,
}: {
  status: TaskStatus;
  items: Task[];
  dragging: boolean;
  hoveredStatusId: { value: string | null };
  boardPageX: { value: number };
  boardPageY: { value: number };
  overlayX: { value: number };
  overlayY: { value: number };
  overlayActive: { value: boolean };
  onColumnRef: (node: ScrollView | null) => void;
  onColumnLayout: (pageY: number, height: number) => void;
  onColumnContentSizeChange: (width: number, height: number) => void;
  onColumnScroll: (y: number) => void;
  onTaskPress: (id: string) => void;
  onDragStart: (task: Task, sourceStatusId: string, absoluteX: number, absoluteY: number) => void;
  onDragUpdate: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: (task: Task, absoluteX: number, absoluteY: number) => void;
  onDragFinalize: () => void;
  lastDragEndedAt: { current: number };
}) {
  const accent = status.color || colors.mutedForeground;
  const columnViewportRef = useRef<View>(null);
  const animatedColumnStyle = useAnimatedStyle(() => ({
    backgroundColor: hoveredStatusId.value === status.id ? `${colors.primary}15` : colors.card,
    borderColor: hoveredStatusId.value === status.id ? colors.primary : accent,
  }), [accent, status.id]);
  return (
    <Animated.View style={[styles.column, animatedColumnStyle]}>
      <View style={styles.colHeader}><View style={[styles.colDot, { backgroundColor: accent }]} /><Text style={styles.colTitle}>{status.name}</Text><View style={styles.colCount}><Text style={styles.colCountText}>{items.length}</Text></View></View>
      <View ref={columnViewportRef} style={styles.columnList} onLayout={() => { requestAnimationFrame(() => { columnViewportRef.current?.measureInWindow((_pageX, pageY, _width, height) => { onColumnLayout(pageY, height); }); }); }}>
        <ScrollView ref={onColumnRef} scrollEnabled={!dragging} showsVerticalScrollIndicator={false} contentContainerStyle={styles.colBody} scrollEventThrottle={16} onContentSizeChange={onColumnContentSizeChange} onScroll={(event) => onColumnScroll(event.nativeEvent.contentOffset.y)}>
          {items.length === 0 ? <Text style={styles.colEmpty}>—</Text> : items.map((task) => <KanbanCard key={task.id} task={task} status={status} boardPageX={boardPageX} boardPageY={boardPageY} overlayX={overlayX} overlayY={overlayY} overlayActive={overlayActive} onPress={() => { if (Date.now() - lastDragEndedAt.current < 250) return; onTaskPress(task.id); }} onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd} onDragFinalize={onDragFinalize} />)}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function KanbanCard({ task, status, boardPageX, boardPageY, overlayX, overlayY, overlayActive, onPress, onDragStart, onDragUpdate, onDragEnd, onDragFinalize }: {
  task: Task; status: TaskStatus; boardPageX: { value: number }; boardPageY: { value: number }; overlayX: { value: number }; overlayY: { value: number }; overlayActive: { value: boolean }; onPress: () => void; onDragStart: (task: Task, sourceStatusId: string, absoluteX: number, absoluteY: number) => void; onDragUpdate: (absoluteX: number, absoluteY: number) => void; onDragEnd: (task: Task, absoluteX: number, absoluteY: number) => void; onDragFinalize: () => void;
}) {
  const active = useSharedValue(false);
  const overlayStartX = useSharedValue(0);
  const overlayStartY = useSharedValue(0);
  const animatedCardStyle = useAnimatedStyle(() => ({ opacity: active.value ? 0 : 1 }));
  const pan = useMemo(() => Gesture.Pan().activateAfterLongPress(180).averageTouches(true).maxPointers(1)
    .onStart((event) => { active.value = true; overlayActive.value = true; overlayStartX.value = event.absoluteX - event.x - boardPageX.value; overlayStartY.value = event.absoluteY - event.y - boardPageY.value; overlayX.value = overlayStartX.value; overlayY.value = overlayStartY.value; runOnJS(onDragStart)(task, status.id, event.absoluteX, event.absoluteY); })
    .onUpdate((event) => { overlayX.value = overlayStartX.value + event.translationX; overlayY.value = overlayStartY.value + event.translationY; runOnJS(onDragUpdate)(event.absoluteX, event.absoluteY); })
    .onEnd((event, success) => { if (success) runOnJS(onDragEnd)(task, event.absoluteX, event.absoluteY); })
    .onFinalize(() => { const wasActive = active.value; active.value = false; overlayActive.value = false; if (wasActive) runOnJS(onDragFinalize)(); }),
    [active, boardPageX, boardPageY, onDragEnd, onDragFinalize, onDragStart, onDragUpdate, overlayActive, overlayStartX, overlayStartY, overlayX, overlayY, status.id, task]);
  return <GestureDetector gesture={pan}><Animated.View collapsable={false} style={[styles.kanbanCard, animatedCardStyle]}><Pressable onPress={onPress}><View style={styles.kanbanTitleRow}><Feather name="menu" size={15} color={colors.sidebarMuted} /><Text style={styles.kanbanTitle} numberOfLines={3}>{task.title}</Text></View><View style={styles.kanbanMeta}>{task.priority ? <Chip label={task.priority.name} color={task.priority.color} /> : null}{isOverdue(task.dueDate) && status.category !== 'done' ? <Chip label="Atrasada" color={colors.error} filled /> : null}</View></Pressable></Animated.View></GestureDetector>;
}

function KanbanDragOverlay({ task, status, active, x, y }: { task: Task; status: TaskStatus; active: { value: boolean }; x: { value: number }; y: { value: number } }) {
  const animatedStyle = useAnimatedStyle(() => ({ opacity: active.value ? 0.98 : 0, transform: [{ translateX: x.value }, { translateY: y.value }, { scale: withSpring(active.value ? 1.025 : 1, { damping: 18, stiffness: 240 }) }] }));
  return <Animated.View pointerEvents="none" style={[styles.dragOverlay, animatedStyle]}><View style={styles.kanbanTitleRow}><Feather name="menu" size={15} color={colors.sidebarMuted} /><Text style={styles.kanbanTitle} numberOfLines={3}>{task.title}</Text></View><View style={styles.kanbanMeta}>{task.priority ? <Chip label={task.priority.name} color={task.priority.color} /> : null}{isOverdue(task.dueDate) && status.category !== 'done' ? <Chip label="Atrasada" color={colors.error} filled /> : null}</View></Animated.View>;
}
/* eslint-enable react-hooks/immutability */

const styles = StyleSheet.create({
  boardViewport: { flex: 1, position: 'relative' },
  board: { alignItems: 'stretch', paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  column: { width: 272, backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 16, flex: 1, maxHeight: '100%' },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderBottomColor: colors.cardBorder, borderBottomWidth: 1 },
  colDot: { width: 9, height: 9, borderRadius: 4.5 },
  colTitle: { flex: 1, color: colors.sidebarText, fontWeight: '700', fontSize: 13.5 },
  colCount: { backgroundColor: colors.muted, borderRadius: 999, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center' },
  colCountText: { color: colors.mutedForeground, fontSize: 11, fontWeight: '700' },
  columnList: { flex: 1 },
  colBody: { padding: 10, gap: 10 },
  colEmpty: { color: colors.sidebarMuted, textAlign: 'center', paddingVertical: 18 },
  kanbanCard: { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowRadius: 12 },
  dragOverlay: { position: 'absolute', width: 250, backgroundColor: colors.inputBg, borderColor: colors.primary, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, elevation: 12, shadowColor: '#000', shadowOpacity: 0.32, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12 },
  kanbanTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  kanbanTitle: { flex: 1, color: colors.foreground, fontSize: 13.5, fontWeight: '600' },
  kanbanMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
