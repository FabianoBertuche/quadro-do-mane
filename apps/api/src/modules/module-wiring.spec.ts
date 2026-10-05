import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MODULE_METADATA, OPTIONAL_DEPS_METADATA } from '@nestjs/common/constants';
import { AiService } from './ai/ai.service';
import { AiAudioService } from './ai/ai-audio.service';
import { TemporaryAudioCleanupScheduler } from './ai/media/temporary-audio-cleanup.scheduler';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectsModule } from './projects/projects.module';
import { TeamsModule } from './teams/teams.module';

test('TeamsModule imports NotificationsModule for its dispatcher dependency', () => {
  assert.ok(Reflect.getMetadata(MODULE_METADATA.IMPORTS, TeamsModule)?.includes(NotificationsModule));
});

test('ProjectsModule imports NotificationsModule for its dispatcher dependency', () => {
  assert.ok(Reflect.getMetadata(MODULE_METADATA.IMPORTS, ProjectsModule)?.includes(NotificationsModule));
});

test('AiService treats security limits as an optional dependency', () => {
  assert.ok(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, AiService)?.includes(6));
});

test('AiAudioService treats optional limits and audit dependencies as optional', () => {
  const optionalDependencies = Reflect.getMetadata(OPTIONAL_DEPS_METADATA, AiAudioService) ?? [];
  assert.ok(optionalDependencies.includes(5));
  assert.ok(optionalDependencies.includes(6));
});

test('TemporaryAudioCleanupScheduler treats timer configuration as optional', () => {
  const optionalDependencies = Reflect.getMetadata(OPTIONAL_DEPS_METADATA, TemporaryAudioCleanupScheduler) ?? [];
  assert.ok(optionalDependencies.includes(1));
  assert.ok(optionalDependencies.includes(2));
});
