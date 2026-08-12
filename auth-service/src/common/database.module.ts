
import { Module, Global } from '@nestjs/common';
import { AuthDatabaseService } from './database.service';

@Global()
@Module({
  providers: [AuthDatabaseService],
  exports: [AuthDatabaseService],
})
export class DatabaseModule {}
