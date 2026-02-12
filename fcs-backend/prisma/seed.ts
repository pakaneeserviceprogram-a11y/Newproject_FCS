// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding...');

  // 1. สร้างกลุ่มบัตร (Card Groups)
  const groupVisitor = await prisma.cardGroup.upsert({
    where: { CardGroupID: 'VISITOR' },
    update: {},
    create: {
      CardGroupID: 'VISITOR',
      GroupName: 'บุคคลทั่วไป (General)',
      IsDefault: true,
    },
  });

  const groupStaff = await prisma.cardGroup.upsert({
    where: { CardGroupID: 'STAFF' },
    update: {},
    create: {
      CardGroupID: 'STAFF',
      GroupName: 'พนักงาน (Internal Staff)',
      IsDefault: false,
    },
  });

  // 2. สร้างร้านค้าตัวอย่าง (Vendor)
  const vendor1 = await prisma.vendor.upsert({
    where: { VendorID: 'V001' },
    update: {},
    create: {
      VendorID: 'V001',
      VendorName: 'ร้านข้าวแกงป้าพร (PaPa Curry)',
      GPSharePercent: 15.0, // GP 15%
    },
  });

  // 3. สร้างจุดให้บริการ (Terminal/POS)
  const terminal1 = await prisma.terminal.upsert({
    where: { TerminalID: 'POS-01' },
    update: {},
    create: {
      TerminalID: 'POS-01',
      TerminalName: 'จุดขายน้ำ - ชั้น 1',
      TerminalType: 'Cashier',
      MachineSerialNo: 'HW-998877', // จำลองเลขเครื่อง
    },
  });

  // ... (ต่อจากโค้ดเดิม)

  // 1. สร้าง Roles (กลุ่มผู้ใช้งาน)
  const roleAdminIT = await prisma.appRole.upsert({
    where: { RoleName: 'ADMIN_IT' }, update: {},
    create: { RoleName: 'ADMIN_IT', Description: 'ผู้ดูแลระบบไอที' }
  });

  const roleCashier = await prisma.appRole.upsert({
    where: { RoleName: 'CASHIER_STAFF' }, update: {},
    create: { RoleName: 'CASHIER_STAFF', Description: 'พนักงานเติมเงิน' }
  });
  
  const roleVendorOwner = await prisma.appRole.upsert({
    where: { RoleName: 'VENDOR_OWNER' }, update: {},
    create: { RoleName: 'VENDOR_OWNER', Description: 'เจ้าของร้านค้า' }
  });

  // 2. สร้าง Permissions (สิทธิ์)
  await prisma.appPermission.upsert({
    where: { PermissionCode: 'VOID_ORDER' }, update: {},
    create: { PermissionCode: 'VOID_ORDER', Description: 'สิทธิ์ยกเลิกบิลอาหาร' }
  });

  // 3. สร้าง User ตัวอย่าง
  // 3.1 ไอที (ส่วนกลาง)
  await prisma.appUser.upsert({
    where: { Username: 'it_support' }, update: {},
    create: {
      Username: 'it_support',
      PasswordHash: 'hashed_password_123', // รหัสผ่านที่เข้ารหัสแล้ว
      FullName: 'Mr. IT Support',
      RoleID: roleAdminIT.RoleID,
      VendorID: null // เป็นคนส่วนกลาง
    }
  });

  // 3.2 ป้าพร (เจ้าของร้านข้าวแกง) - เป็น Supervisor ฝั่งร้านค้า
  await prisma.appUser.upsert({
    where: { Username: 'praphorn' }, update: {},
    create: {
      Username: 'praphorn',
      PasswordHash: 'hashed_password_456',
      FullName: 'ป้าพร เจ้าของร้าน',
      RoleID: roleVendorOwner.RoleID,
      VendorID: 'V001' // <--- ผูกกับร้าน V001 ทำให้เห็นแค่ยอดร้านตัวเอง
    }
  });


  

  console.log('✅ Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });