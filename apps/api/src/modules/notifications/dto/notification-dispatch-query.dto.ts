import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationPushStatus } from '@prisma/client';
import { NOTIFICATION_CATEGORIES, NotificationCategoryName } from '../notification-preferences.service';

/** Filtros da listagem administrativa de entregas. Todos opcionais. */
export class NotificationDispatchQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_CATEGORIES })
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategoryName;

  @ApiPropertyOptional({ enum: Object.values(NotificationPushStatus) })
  @IsOptional()
  @IsIn(Object.values(NotificationPushStatus))
  pushStatus?: NotificationPushStatus;

  @ApiPropertyOptional({ description: 'Destinatário da entrega' })
  @IsOptional()
  @IsString()
  tenantUserId?: string;
}
