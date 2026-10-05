import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AttachmentIntakeService } from './attachment-intake.service';

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
  ],
  exports: [UploadService, AttachmentIntakeService],
})
export class UploadModule {}
