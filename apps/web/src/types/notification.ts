export const notificationCategories = [
  'TASKS',
  'CALENDAR',
  'ROUTINE',
  'COLLABORATION',
  'PROJECTS_TEAMS',
  'SECURITY',
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationPushStatuses = ['PENDING', 'SENT', 'SKIPPED', 'FAILED'] as const;

export type NotificationPushStatus = (typeof notificationPushStatuses)[number];

/** Public diagnostic shape. Device identifiers, Expo tokens, and tickets are intentionally absent. */
export type NotificationDispatch = {
  id: string;
  tenantUserId: string;
  category: NotificationCategory;
  type: string;
  pushStatus: NotificationPushStatus;
  createdAt: string;
  failureReason: string | null;
};
