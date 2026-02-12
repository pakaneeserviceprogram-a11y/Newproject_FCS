import { Controller, Get, Param } from '@nestjs/common';
import { VendorsService } from './vendors.service';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // ลบเครื่องหมาย + หน้า id ออก เพื่อส่งค่าเป็น String (ตัวหนังสือ)
    return this.vendorsService.findOne(id);
  }
}