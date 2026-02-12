import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- เพิ่มโค้ดส่วนนี้เพื่อแก้ปัญหา BigInt JSON ---
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
  // ---------------------------------------------

  // 2. เปิด CORS (สำคัญมากสำหรับ React!) 👇
  app.enableCors({
    origin: '*', // ยอมรับทุกเว็บ (หรือระบุ 'http://localhost:5173' เพื่อความปลอดภัย)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
