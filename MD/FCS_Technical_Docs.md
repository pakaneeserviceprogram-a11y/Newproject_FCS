จัดให้ครับ เพื่อให้ทีมงานสามารถเริ่มงานได้ทันที ผมได้จัดทำ เอกสารประกอบการพัฒนา (Technical Documentation) ชุดตั้งต้นให้ครับเอกสารชุดนี้เน้นสิ่งที่ต้องใช้ "เขียนโค้ด" และ "ทดสอบระบบ" ทันที ประกอบด้วย:API Specification: เพื่อให้ Frontend (React/Web) และ Backend คุยกันรู้เรื่องSystem Flow: ขั้นตอนการทำงานหน้าแคชเชียร์และร้านค้าTest Cases: รายการทดสอบสำหรับ QAคุณสามารถ Copy ไป save เป็นไฟล์ FCS\_Technical\_Docs.md ได้เลยครับ📄 FCS Technical DocumentationProject: Modern Food Court SystemRelated Database: FCS\_ModernDBStatus: Draft v1.01. 🔌 API Specification (สำหรับ Backend \& Frontend)รายการ API หลักที่ต้องพัฒนา โดยอ้างอิงจาก Database Schema ที่ออกแบบไว้1.1 Authentication \& ProfileMethodEndpointDescriptionRequest Body (JSON)Response (JSON)POST/api/auth/loginเข้าสู่ระบบ (Admin/Staff/Vendor){ "username": "admin", "password": "\*\*\*" }{ "token": "jwt...", "role": "Admin", "name": "..." }GET/api/auth/meดึงข้อมูล User ปัจจุบัน-{ "userId": 1, "permissions": \["POS\_VIEW", ...] }1.2 Card Operations (จัดการบัตร)MethodEndpointDescriptionRequest BodyResponseGET/api/cards/{cardUID}เช็คยอดเงิน/สถานะบัตร-{ "cardUID": "...", "cashBalance": 100.00, "subsidyBalance": 50.00, "status": "Active" }GET/api/cards/{cardUID}/historyดูประวัติการใช้บัตร (ล่าสุด 20 รายการ)-\[ { "txnDate": "...", "amount": -40, "shop": "Khao Man Gai" }, ... ]1.3 Cashier Module (จุดเติมเงิน)MethodEndpointDescriptionRequest BodyResponsePOST/api/pos/open-shiftเปิดกะทำงาน{ "terminalID": "POS-01", "userID": 10 }{ "shiftID": 501, "openedAt": "..." }POST/api/pos/topupเติมเงิน (เรียก SP Sp\_Cashier\_ApplyPromo){ "shiftID": 501, "cardUID": "...", "amount": 100, "paymentType": "CASH" }{ "txnID": 888, "newBalance": 150, "bonus": 0 }POST/api/pos/refundคืนเงินมัดจำ/เงินคงเหลือ{ "shiftID": 501, "cardUID": "..." }{ "refundAmount": 55.00, "status": "Card Closed" }1.4 Vendor Module (ร้านค้า)MethodEndpointDescriptionRequest BodyResponseGET/api/vendor/productsดึงรายการสินค้าของร้าน-\[ { "productID": "P01", "name": "Fried Rice", "price": 40 } ]POST/api/vendor/saleบันทึกยอดขาย (ตัดเงิน){ "cardUID": "...", "items": \[ {"id": "P01", "qty": 1} ] }{ "orderNo": "INV-001", "remainingBalance": 60 }2. 🔄 System Logic Flows (สำหรับ Developer)เพื่อให้เข้าใจลำดับการทำงานที่ซับซ้อน (Logic การตัดเงิน และ การโปรโมชั่น)2.1 Food Purchase Flow (Priority การตัดเงิน)Logic: ต้องตัดเงินสวัสดิการ (Subsidy) ก่อนเสมอ ถ้าไม่พอค่อยตัดเงินสด (Cash)Code snippetsequenceDiagram

&nbsp;   participant VendorApp as หน้าจอร้านค้า

&nbsp;   participant API as Backend API

&nbsp;   participant DB as Database



&nbsp;   VendorApp->>VendorApp: กดเลือกรายการอาหาร (รวม 50 บาท)

&nbsp;   VendorApp->>VendorApp: แตะบัตรลูกค้า (CardUID)

&nbsp;   VendorApp->>API: POST /sale {card: "C123", amount: 50}

&nbsp;   

&nbsp;   API->>DB: Get Card Balance

&nbsp;   DB-->>API: Cash=100, Subsidy=20

&nbsp;   

&nbsp;   API->>API: Calculate Logic

&nbsp;   Note right of API: ยอด 50 บาท <br/>1. ตัด Subsidy หมด (20 บาท)<br/>2. เหลือ 30 บาท ตัด Cash

&nbsp;   

&nbsp;   API->>DB: Insert Sales\_Order (SubsidyUsed=20, CashUsed=30)

&nbsp;   API->>DB: Update Card Balance

&nbsp;   

&nbsp;   DB-->>API: Success

&nbsp;   API-->>VendorApp: Print Slip (Remaining: Cash=70, Sub=0)

2.2 Cashier Top-up with Promo (เติมเงิน + โปรโมชั่น)Logic: เติมเงินแล้วต้องเช็คเงื่อนไขโปรโมชั่น เพื่อให้รางวัลทันทีCode snippetsequenceDiagram

&nbsp;   participant Cashier as พนักงานเติมเงิน

&nbsp;   participant API as Backend API

&nbsp;   participant DB as Database



&nbsp;   Cashier->>API: POST /topup {amount: 500, type: CASH}

&nbsp;   

&nbsp;   API->>DB: Insert Txn\_Cashier (ยอด 500)

&nbsp;   

&nbsp;   API->>DB: EXEC Sp\_Cashier\_ApplyPromo

&nbsp;   Note right of DB: เช็ค Promo\_Cashier\_Campaigns<br/>เจอโปร "เติม 500 ได้แต้ม 50"

&nbsp;   

&nbsp;   DB->>DB: Update Card (Add 500 Cash)

&nbsp;   DB->>DB: Update Card (Add 50 Point)

&nbsp;   DB->>DB: Insert Log

&nbsp;   

&nbsp;   DB-->>API: Success (NewBalance, EarnedPoints)

&nbsp;   API-->>Cashier: Show "Success! Earned 50 Points"

3\. 🧪 Test Cases (สำหรับ QA/Tester)ตารางทดสอบเพื่อให้มั่นใจว่าระบบทำงานถูกต้องตาม Database SchemaTest IDScenario (สถานการณ์)Pre-Condition (เงื่อนไขก่อนหน้า)Steps (ขั้นตอน)Expected Result (ผลที่คาดหวัง)TC-01เติมเงินปกติบัตรใหม่ ยอด 0 บาท1. แคชเชียร์เติมเงิน 100 บาท (เงินสด)2. บันทึกรายการ1. CashBalance เป็น 1002. SubsidyBalance เป็น 0 (ไม่เปลี่ยน)TC-02เติมเงิน + โปรโมชั่นมีโปร: เติม 500 แถม 50 (เข้า Subsidy)1. แคชเชียร์เติมเงิน 500 บาท1. CashBalance เพิ่ม 5002. SubsidyBalance เพิ่ม 503. Promo\_Redemption\_Log มีรายการใหม่TC-03ซื้ออาหาร (เงินพอ)Cash=100, Subsidy=501. ซื้อข้าวมันไก่ 40 บาท1. ตัด SubsidyBalance เหลือ 102. CashBalance ยังคงเหลือ 100 (ไม่ถูกตัด)TC-04ซื้ออาหาร (เงินผสม)Cash=100, Subsidy=101. ซื้อข้าวมันไก่ 40 บาท1. SubsidyBalance เหลือ 0 (ถูกตัด 10)2. CashBalance เหลือ 70 (ถูกตัด 30)TC-05ซื้ออาหาร (เงินไม่พอ)Cash=10, Subsidy=01. ซื้อข้าวมันไก่ 40 บาท1. ระบบแจ้งเตือน "ยอดเงินไม่เพียงพอ"2. บันทึกไม่สำเร็จTC-06Auto Subsidy (เที่ยงคืน)ตั้ง Rule: ให้ Staff 50 บาท/วัน (Reset)1. รัน Stored Procedure ตอนเที่ยงคืน1. บัตรกลุ่ม Staff ทุกใบ มียอด Subsidy = 502. Txn\_Subsidy\_Log มีรายการ Type='AUTO'4. 🛠️ Configuration \& Deploymentข้อมูลสำหรับการติดตั้งระบบลง Server4.1 Connection String (Web.config / appsettings.json)JSON"ConnectionStrings": {

&nbsp; "DefaultConnection": "Server=YOUR\_SERVER\_IP;Database=FCS\_ModernDB;User Id=sa;Password=your\_password;TrustServerCertificate=True;"

}

###### 4.2 Scheduled Jobs (SQL Agent)ต้องตั้งค่า Job ใน SQL Server เพื่อรันระบบอัตโนมัติ:Job Name: FCS\_Daily\_SubsidySchedule: ทุกวัน เวลา 00:01 น.Command: EXEC Sp\_Subsidy\_Process\_AutoRules;สิ่งที่คุณต้องทำต่อส่งให้ Backend: เอาส่วน ข้อ 1 (API) และ ข้อ 4 (Config) ไปเริ่มขึ้นโครงโปรเจกต์ส่งให้ Frontend: เอาส่วน ข้อ 1 (API) และ ข้อ 2 (Flows) ไปเริ่มทำหน้าจอส่งให้ QA/Tester: เอาส่วน ข้อ 3 (Test Cases) ไปเตรียมตารางทดสอบรอไว้เลยครับ

### 1.5 Back Office Management (สำหรับ Admin)
| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/employees` | ลงทะเบียนพนักงานใหม่ | `{ empID, name, cardGroupID }` |
| `POST` | `/api/cards/issue` | ผูกบัตรกับพนักงาน | `{ cardUID, empID }` |
| `POST` | `/api/products` | เพิ่มสินค้า/เมนู | `{ vendorID, name, price }` |

### 1.6 Reporting (สำหรับผู้จัดการ)
| Method | Endpoint | Description | Response Data |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/daily-sales` | สรุปยอดขายรายวัน | `{ date, totalCash, totalSubsidy, totalGP }` |
| `GET` | `/api/reports/topup` | สรุปยอดเติมเงิน (แยกตาม Type) | `{ cashTopup, bonusTopup, refund }` |


Method,Endpoint,Description,Response Data
GET,/api/reports/daily-sales,สรุปยอดขาย (เลือกช่วงเวลาได้),?startDate=...&endDate=...
GET,/api/reports/topup-summary,สรุปยอดเติมเงินแยกประเภท,"{ cash, transfer, subsidy_bonus }"
GET,/api/reports/vendor-payout,รายงานสรุปยอดจ่ายเงินคืนร้านค้า,"{ vendor, totalSales, gpDeducted, netPay }"

### 1.5 Back Office Management (ระบบจัดการหลังบ้าน)
สำหรับ Admin เพื่อจัดการข้อมูลหลัก (CRUD: Create, Read, Update, Delete)

**A. จัดการพนักงาน (Employees)**
| Method | Endpoint | Description | Request/Param |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/employees` | ค้นหาพนักงาน (List) | `?keyword=Somchai&dept=IT` |
| `GET` | `/api/employees/{id}` | ดูรายละเอียดรายคน | - |
| `POST` | `/api/employees` | ลงทะเบียนพนักงานใหม่ | `{ id, name, dept, cardGroupID }` |
| `PUT` | `/api/employees/{id}` | แก้ไขข้อมูล (เช่น ย้ายแผนก) | `{ name, dept, status }` |
| `DELETE` | `/api/employees/{id}` | ลบ/ระงับการใช้งาน | - |

**B. จัดการร้านค้า (Vendors)**
| Method | Endpoint | Description | Request/Param |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/vendors` | ดูรายชื่อร้านค้าทั้งหมด | - |
| `POST` | `/api/vendors` | เพิ่มร้านค้าใหม่ | `{ name, gpShare, rentPrice }` |
| `PUT` | `/api/vendors/{id}` | แก้ไขค่าเช่า/GP | `{ gpShare, rentPrice, isActive }` |

**C. จัดการสินค้า (Products)**
| Method | Endpoint | Description | Request/Param |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | ดูสินค้า (Filter ตามร้านได้) | `?vendorId=V01` |
| `POST` | `/api/products` | เพิ่มสินค้า/เมนู | `{ vendorID, name, price, stockType }` |
| `PUT` | `/api/products/{id}` | แก้ไขราคา/ชื่อสินค้า | `{ name, price, isActive }` |

**D. จัดการบัตร (Card Issuing)**
| Method | Endpoint | Description | Request/Param |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/cards/issue` | ผูกบัตรใหม่กับพนักงาน | `{ cardUID, empID }` |
| `POST` | `/api/cards/{uid}/block` | อายัดบัตร (กรณีสูญหาย) | `{ reason }` |
| `POST` | `/api/cards/{uid}/unblock` | ปลดล็อคบัตร | - |

### 1.6 Reporting (สำหรับผู้จัดการ/บัญชี)
| Method | Endpoint | Description | Response Data |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/daily-sales` | สรุปยอดขาย (เลือกช่วงเวลาได้) | `?startDate=...&endDate=...` |
| `GET` | `/api/reports/topup-summary` | สรุปยอดเติมเงินแยกประเภท | `{ cash, transfer, subsidy_bonus }` |
| `GET` | `/api/reports/vendor-payout` | รายงานสรุปยอดจ่ายเงินคืนร้านค้า | `{ vendor, totalSales, gpDeducted, netPay }` |
