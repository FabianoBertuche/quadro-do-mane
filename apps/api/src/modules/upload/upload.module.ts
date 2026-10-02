import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { ATTACHMENT_FETCH, AttachmentIntakeService } from './attachment-intake.service';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // memory storage
    }),
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    AttachmentIntakeService,
    { provide: ATTACHMENT_FETCH, useFactory: () => ((url: string, init: any) => fetch(url, init)) },
  ],
  exports: [UploadService, AttachmentIntakeService],
})
export class UploadModule {}
