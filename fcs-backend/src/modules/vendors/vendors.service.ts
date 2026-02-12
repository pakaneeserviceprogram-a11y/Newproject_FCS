import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Import ตัวเชื่อม DB

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {} // ฉีดเข้ามาใช้งาน

  // ดึงข้อมูลทั้งหมด
  findAll() {
    return this.prisma.vendor.findMany();
  }

  // ดึงตาม ID
  findOne(id: string) {
    return this.prisma.vendor.findUnique({
      where: { VendorID: id }
    });
  }
}