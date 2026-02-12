import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { VendorsModule } from './modules/vendors/vendors.module';

@Module({
  imports: [PrismaModule, VendorsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
