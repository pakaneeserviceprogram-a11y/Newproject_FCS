import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // <--- 1. ใส่บรรทัดนี้สำคัญมาก!
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // <--- 2. ส่งออกให้คนอื่นใช้
})
export class PrismaModule {}