import { resolveNotificationRoute } from './notification-navigation';
import { test, expect } from 'vitest';

test('maps an accepted task payload to its Expo Router route', () => {
  expect(resolveNotificationRoute({ taskId: 'task-1' })).toBe('/task/task-1');
});

test('rejects an arbitrary route from notification payload', () => {
  expect(resolveNotificationRoute({ route: 'https://example.com' })).toBeNull();
});