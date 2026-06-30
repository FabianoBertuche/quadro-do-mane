import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { RedisModule } from './common/redis/redis.module';
import { CookieModule } from './common/cookies/cookie.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { TenantContextModule } from './common/tenant/tenant-context.module';
import { validateEnv } from './common/config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { TeamsModule } from './modules/teams/teams.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { EventsModule } from './modules/events/events.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { UploadModule } from './modules/upload/upload.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { EmailsModule } from './modules/emails/emails.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    CryptoModule,
    RedisModule,
    CookieModule,
    TenantContextModule,
    AuthModule,
    TeamsModule,
    ProjectsModule,
    TasksModule,
    EventsModule,
    ContactsModule,
    NotificationsModule,
    DashboardModule,
    ActivityLogModule,
    AuditLogModule,
    UploadModule,
    UsersModule,
    RolesModule,
    EmailsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude('api/auth/login', 'api/auth/refresh')
      .forRoutes('*');
  }
}
