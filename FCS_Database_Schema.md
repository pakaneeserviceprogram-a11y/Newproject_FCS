/* =============================================
   Database: FCS_ModernDB (Modern Food Court System)
   Description: โครงสร้างฐานข้อมูลระบบศูนย์อาหาร รองรับภาษี, สต็อก FIFO และหลายกระเป๋าเงิน
   Created By: Pakanee & Gemini
   ============================================= */

-- 1. สร้าง Database และกำหนด Collation ภาษาไทย
CREATE DATABASE FCS_ModernDB
COLLATE Thai_CI_AS;
GO

USE FCS_ModernDB;
GO

/* =============================================
   PART 1: MASTER DATA (ข้อมูลหลัก)
   ============================================= */

/* [Terminals]
   Description: ทะเบียนเครื่อง POS/Cashier ทั้งหมดในระบบ
   Usage: ใช้ตรวจสอบสิทธิ์การใช้งาน และระบุตัวตนเครื่องสำหรับออกใบกำกับภาษี (Tax Requirement)
*/
CREATE TABLE Terminals (
    TerminalID      NVARCHAR(20) NOT NULL PRIMARY KEY, -- รหัสเครื่อง (PK) เช่น 'POS-01', 'KIOSK-02'
    TerminalName    NVARCHAR(100),                     -- ชื่อเรียกเครื่อง ระบุจุดที่ตั้ง
    TerminalType    NVARCHAR(20),                      -- ประเภทเครื่อง: 'Cashier' (จุดเติมเงิน), 'Vendor' (ร้านค้า), 'Kiosk' (ตู้เติมเงิน)
    MachineSerialNo NVARCHAR(50) NOT NULL,             -- S/N Hardware (บังคับเก็บตามกฎหมายสรรพากร เพื่อผูกกับเลข ภ.พ.20)
    POS_Reg_No      NVARCHAR(50),                      -- เลขทะเบียนเครื่องเก็บเงิน (ตามที่จดทะเบียนกับสรรพากร)
    LocationCode    NVARCHAR(20),                      -- รหัสพื้นที่ติดตั้ง (Zone)
    IsActive        BIT DEFAULT 1,                     -- สถานะเครื่อง: 1=ใช้งาน, 0=ยกเลิก
    CreatedAt       DATETIME DEFAULT GETDATE()         -- วันที่ลงทะเบียนเครื่อง
);

/* [Vendors]
   Description: ข้อมูลร้านค้าและผู้ประกอบการ
   Usage: ใช้คำนวณ GP, ออกใบแจ้งหนี้ค่าเช่า, และระบุข้อมูลผู้เสียภาษีในใบกำกับ
*/
CREATE TABLE Vendors (
    VendorID        NVARCHAR(20) NOT NULL PRIMARY KEY, -- รหัสร้านค้า (PK) เช่น 'V-001'
    VendorName      NVARCHAR(100) NOT NULL,            -- ชื่อร้านค้าที่แสดงบนป้าย/ใบเสร็จ
    OwnerName       NVARCHAR(100),                     -- ชื่อเจ้าของร้าน (บุคคล/นิติบุคคล)
    -- Tax Info
    TaxID           NVARCHAR(20),                      -- เลขประจำตัวผู้เสียภาษีของร้านค้า
    BranchID        NVARCHAR(10) DEFAULT '00000',      -- สาขาภาษี (ปกติ '00000' คือสำนักงานใหญ่)
    IsVatRegistered BIT DEFAULT 0,                     -- สถานะจด VAT: 1=จดทะเบียน (ออกใบกำกับได้), 0=ไม่จด
    -- Finance
    GP_Share_Percent DECIMAL(5, 2) DEFAULT 0.00,       -- ส่วนแบ่ง GP (%) ที่หักเข้าระบบ เช่น 15.00
    Rent_Price      DECIMAL(12, 2) DEFAULT 0.00,       -- ค่าเช่าคงที่ (Fixed Rent) ต่อเดือน
    IsActive        BIT DEFAULT 1                      -- สถานะร้านค้า: 1=ขายอยู่, 0=ปิดกิจการ
);

/* [Employees]
   Description: ข้อมูลบุคคล (พนักงาน/ลูกค้าประจำ)
   Usage: เป็น Master Data ของเจ้าของบัตร หรือพนักงานใช้งานระบบ
*/
CREATE TABLE Employees (
    EmployeeID      NVARCHAR(20) NOT NULL PRIMARY KEY, -- รหัสพนักงาน (PK)
    FullName        NVARCHAR(150) NOT NULL,            -- ชื่อ-นามสกุล
    Department      NVARCHAR(100),                     -- แผนก/สังกัด (ใช้สำหรับทำ Report แยกแผนก)
    Status          NVARCHAR(20) DEFAULT 'Active',     -- สถานะพนักงาน: 'Active', 'Resigned'
    ExtraData       NVARCHAR(MAX),                     -- เก็บข้อมูลยืดหยุ่นแบบ JSON (เช่น LineID, ประวัติแพ้อาหาร)
    UpdatedAt       DATETIME DEFAULT GETDATE()         -- วันที่แก้ไขข้อมูลล่าสุด
);

/* [Card_Groups]
   Description: กลุ่มผู้ถือบัตร
   Usage: ใช้กำหนดสิทธิ์และ **ระดับราคา** สินค้า (Dynamic Pricing)
*/
CREATE TABLE Card_Groups (
    CardGroupID     NVARCHAR(20) NOT NULL PRIMARY KEY, -- รหัสกลุ่ม (PK) เช่น 'STAFF', 'VIP', 'VISITOR'
    GroupName       NVARCHAR(100),                     -- ชื่อกลุ่ม
    IsDefault       BIT DEFAULT 0                      -- 1=เป็นค่าเริ่มต้นสำหรับบัตรใหม่
);

/* [Cards]
   Description: ข้อมูลบัตรและกระเป๋าเงิน (Wallet)
   Usage: เก็บยอดเงินคงเหลือ และผูกกับ RFID
*/
CREATE TABLE Cards (
    CardUID         NVARCHAR(50) NOT NULL PRIMARY KEY, -- รหัส UID ของชิป RFID/NFC (PK)
    EmployeeID      NVARCHAR(20) REFERENCES Employees(EmployeeID), -- เจ้าของบัตร (NULL ได้ถ้าเป็นบัตร Visitor)
    CardGroupID     NVARCHAR(20) DEFAULT 'VISITOR' REFERENCES Card_Groups(CardGroupID), -- กลุ่มบัตร (เพื่อคำนวณราคา)
    
    -- Multi-Pocket Wallet Concept
    CashBalance     DECIMAL(12, 2) DEFAULT 0.00,       -- กระเป๋าเงินสด: เติมเองได้, ถอนคืนได้ (Refundable)
    SubsidyBalance  DECIMAL(12, 2) DEFAULT 0.00,       -- กระเป๋าสวัสดิการ: บริษัทเติมให้, ถอนไม่ได้ (Non-Refundable), ตัดก่อนเสมอ
    
    Status          NVARCHAR(20) DEFAULT 'Active',     -- สถานะบัตร: 'Active', 'Blocked', 'Lost'
    ExpireDate      DATE NULL,                         -- วันหมดอายุบัตร
    
    -- Added for Loyalty Module
    PointBalance    DECIMAL(12, 2) DEFAULT 0.00,       -- แต้มสะสมคงเหลือ
    PointExpDate    DATE                               -- วันหมดอายุแต้ม
);

/* [Products]
   Description: รายการสินค้า
   Usage: เก็บข้อมูลสินค้าพื้นฐานและราคามาตรฐาน
*/
CREATE TABLE Products (
    ProductID       NVARCHAR(20) NOT NULL PRIMARY KEY, -- รหัสสินค้า (PK)
    VendorID        NVARCHAR(20) NOT NULL REFERENCES Vendors(VendorID), -- เจ้าของสินค้า (FK)
    ProductName     NVARCHAR(150) NOT NULL,            -- ชื่อสินค้า
    BasePrice       DECIMAL(12, 2) NOT NULL DEFAULT 0, -- ราคาขายปกติ (ถ้าไม่มี Tier Price จะใช้อันนี้)
    StockType       NVARCHAR(20) DEFAULT 'STOCK',      -- ประเภทสต็อก: 'STOCK'=ตัดสต็อก, 'SERVICE'=ไม่ตัด, 'FIFO'=ต้องมี Lot
    IsActive        BIT DEFAULT 1                      -- 1=มีขาย, 0=เลิกขาย
);

/* [Product_Price_Tiers]
   Description: ตารางราคาพิเศษ (Price List)
   Usage: ใช้ทำ Dynamic Pricing สินค้า 1 ตัว หลายราคา ตามกลุ่มบัตร
*/
CREATE TABLE Product_Price_Tiers (
    TierID          BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductID       NVARCHAR(20) NOT NULL REFERENCES Products(ProductID),      -- สินค้าตัวไหน
    CardGroupID     NVARCHAR(20) NOT NULL REFERENCES Card_Groups(CardGroupID), -- กลุ่มบัตรไหน
    SpecialPrice    DECIMAL(12, 2) NOT NULL,           -- ราคาพิเศษสำหรับกลุ่มนี้
    CONSTRAINT UK_Product_Tier UNIQUE (ProductID, CardGroupID) -- ห้ามซ้ำคู่ (สินค้า+กลุ่ม)
);
CREATE INDEX IDX_PriceLookup ON Product_Price_Tiers(ProductID, CardGroupID) INCLUDE (SpecialPrice); -- Index ช่วยค้นหาราคาเร็วขึ้น

/* [Ref_Payment_Types]
   Description: ประเภทการชำระเงิน
   Usage: รองรับ Multi-Payment (เงินสด, QR, คูปอง)
*/
CREATE TABLE Ref_Payment_Types (
    PaymentTypeID   NVARCHAR(20) NOT NULL PRIMARY KEY, -- รหัสประเภท (PK) เช่น 'CASH', 'QR', 'COUPON'
    PaymentName     NVARCHAR(50),                      -- ชื่อที่แสดง
    NeedRefNo       BIT DEFAULT 0                      -- 1=ต้องกรอกเลขที่อ้างอิง (เช่น QR Ref, รหัสคูปอง)
);

/* [Coupons]
   Description: ระบบคูปองแทนเงินสด
   Usage: ใช้ตรวจสอบสถานะคูปองว่าใช้ไปหรือยัง
*/
CREATE TABLE Coupons (
    CouponCode      NVARCHAR(50) NOT NULL PRIMARY KEY, -- รหัสคูปอง/บาร์โค้ด (PK)
    Value           DECIMAL(12, 2) NOT NULL,           -- มูลค่าบาท
    Status          NVARCHAR(20) DEFAULT 'Active',     -- สถานะ: 'Active', 'Used', 'Expired'
    ExpireDate      DATE,                              -- วันหมดอายุ
    UsedAt          DATETIME NULL,                     -- วันที่ใช้งานไป
    UsedByTxnID     BIGINT NULL                        -- ใช้งานที่ Transaction ไหน (Audit Trail)
);

/* =============================================
   PART 2: TRANSACTIONS (ข้อมูลการขาย)
   ============================================= */

/* [System_Shifts]
   Description: รอบการทำงาน (กะ)
   Usage: ใช้สรุปยอดส่งเงินเมื่อปิดกะ (Shift Close)
*/
CREATE TABLE System_Shifts (
    ShiftID         INT IDENTITY(1,1) PRIMARY KEY,     -- รหัสรอบ (PK)
    ShiftDate       DATE DEFAULT CAST(GETDATE() AS DATE), -- วันที่ของรอบบัญชี
    TerminalID      NVARCHAR(20) REFERENCES Terminals(TerminalID), -- เปิดที่เครื่องไหน
    OpenedBy        NVARCHAR(50),                      -- User ที่เปิดกะ
    OpenedAt        DATETIME DEFAULT GETDATE(),        -- เวลาเปิด
    ClosedAt        DATETIME NULL,                     -- เวลาปิด (NULL=ยังไม่ปิด)
    Status          NVARCHAR(20) DEFAULT 'Open'        -- สถานะ: 'Open', 'Closed'
);

/* [Txn_Cashier]
   Description: ธุรกรรมที่จุดเติมเงิน (Cashier)
   Usage: เก็บประวัติการเติมเงิน/คืนเงิน และข้อมูลภาษี (Header)
*/
CREATE TABLE Txn_Cashier (
    TxnID           BIGINT IDENTITY(1,1) PRIMARY KEY,  -- รหัสธุรกรรม (PK)
    TxnDate         DATETIME DEFAULT GETDATE(),        -- เวลาทำรายการ
    ShiftID         INT REFERENCES System_Shifts(ShiftID), -- อ้างอิงรอบกะ
    
    -- Tax Compliance Snapshot (บันทึกค่า ณ เวลาขาย ห้าม Join Master Data ภายหลัง)
    TerminalID      NVARCHAR(20) NOT NULL REFERENCES Terminals(TerminalID),
    MachineSerialNo NVARCHAR(50),                      -- S/N เครื่องตอนทำรายการ
    POS_Reg_No      NVARCHAR(50),                      -- ทะเบียนเครื่องตอนทำรายการ
    IssuerTaxID     NVARCHAR(20),                      -- เลขผู้เสียภาษีผู้ออกบิล
    TaxInvoiceNo    NVARCHAR(50),                      -- เลขที่ใบกำกับภาษี (ABB/Full)
    IsFullTax       BIT DEFAULT 0,                     -- 1=ขอใบกำกับภาษีเต็มรูป

    -- Transaction Info
    CardUID         NVARCHAR(50) NOT NULL REFERENCES Cards(CardUID), -- บัตรที่ทำรายการ
    TxnType         NVARCHAR(20) NOT NULL,             -- ประเภท: 'TopUp' (เติม), 'Refund' (คืน)
    TotalAmount     DECIMAL(12, 2) NOT NULL,           -- ยอดเงินรวม
    CashierUserID   NVARCHAR(50),                      -- พนักงานแคชเชียร์ผู้ทำรายการ
    Remark          NVARCHAR(255)                      -- หมายเหตุ
);
CREATE INDEX IDX_Cashier_Card ON Txn_Cashier(CardUID, TxnDate);

/* [Txn_Cashier_Payments]
   Description: รายละเอียดการรับเงิน (Detail)
   Usage: รองรับการจ่ายหลายแบบใน 1 บิล (เช่น เงินสด + คูปอง)
*/
CREATE TABLE Txn_Cashier_Payments (
    PaymentID       BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnID           BIGINT NOT NULL REFERENCES Txn_Cashier(TxnID), -- เชื่อมกับ Header
    PaymentTypeID   NVARCHAR(20) NOT NULL REFERENCES Ref_Payment_Types(PaymentTypeID),
    Amount          DECIMAL(12, 2) NOT NULL,           -- ยอดเงินของประเภทนี้
    RefNo           NVARCHAR(100),                     -- เลขอ้างอิง (เช่น Coupon Code, QR Ref ID)
    RefData         NVARCHAR(MAX)                      -- ข้อมูล JSON ตอบกลับจาก Bank (ถ้ามี)
);

/* [Sales_Orders]
   Description: ธุรกรรมการขายสินค้าที่ร้านค้า (POS)
   Usage: เก็บ Header ของบิลขาย เพื่อคำนวณยอดขายและ GP
*/
CREATE TABLE Sales_Orders (
    OrderID         BIGINT IDENTITY(1,1) PRIMARY KEY,  -- รหัสออเดอร์ (PK)
    OrderNo         NVARCHAR(30),                      -- เลขที่ใบเสร็จ (Running No.)
    OrderDate       DATETIME DEFAULT GETDATE(),        -- เวลาขาย
    ShiftID         INT REFERENCES System_Shifts(ShiftID),
    
    -- Tax Compliance Snapshot
    TerminalID      NVARCHAR(20) NOT NULL REFERENCES Terminals(TerminalID),
    MachineSerialNo NVARCHAR(50),
    VendorID        NVARCHAR(20) NOT NULL REFERENCES Vendors(VendorID), -- ร้านที่ขาย
    IssuerTaxID     NVARCHAR(20),                      -- เลขผู้เสียภาษีร้านค้า (ถ้าจด VAT)
    TaxInvoiceNo    NVARCHAR(50),                      

    -- Payment Info
    CardUID         NVARCHAR(50) NOT NULL REFERENCES Cards(CardUID), -- บัตรที่มาซื้อ
    TotalAmount     DECIMAL(12, 2) NOT NULL,           -- ยอดสุทธิ
    VatAmount       DECIMAL(12, 2) DEFAULT 0,          -- ยอด VAT (ถ้ามี)
    
    -- Wallet Deducted (ตัดเงินจากกระเป๋าไหน)
    CashUsed        DECIMAL(12, 2) DEFAULT 0,          -- ตัดจากกระเป๋าเงินสด
    SubsidyUsed     DECIMAL(12, 2) DEFAULT 0,          -- ตัดจากกระเป๋าสวัสดิการ
    
    Status          NVARCHAR(20) DEFAULT 'Completed'   -- 'Completed', 'Void'
);

/* [Sales_Order_Items]
   Description: รายละเอียดสินค้าในบิล (Line Items)
   Usage: เก็บว่าขายอะไรไปบ้าง และราคาเท่าไหร่ ณ ตอนนั้น
*/
CREATE TABLE Sales_Order_Items (
    ItemID          BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderID         BIGINT NOT NULL REFERENCES Sales_Orders(OrderID), -- เชื่อม Header
    ProductID       NVARCHAR(20) REFERENCES Products(ProductID),      -- สินค้าอะไร
    ProductName_Log NVARCHAR(150),                     -- ชื่อสินค้า ณ ตอนขาย (กันเปลี่ยนชื่อทีหลัง)
    Quantity        INT DEFAULT 1,                     -- จำนวน
    UnitPrice       DECIMAL(12, 2),                    -- ราคาขายต่อหน่วย (หลังหักส่วนลด Tier)
    TotalPrice      AS (Quantity * UnitPrice) PERSISTED -- คำนวณยอดรวมอัตโนมัติ
);

/* =============================================
   PART 3: SECURITY & ACCESS CONTROL
   ============================================= */

/* [App_Permissions] - รายชื่อสิทธิ์ทั้งหมดในระบบ */
CREATE TABLE App_Permissions (
    PermissionCode  NVARCHAR(50) NOT NULL PRIMARY KEY, -- เช่น 'EMP_EDIT', 'REPORT_VIEW'
    Description     NVARCHAR(100),                     -- คำอธิบายสิทธิ์
    Category        NVARCHAR(50)                       -- หมวดหมู่ (UI, Backend, Report)
);

/* [App_Roles] - บทบาทหน้าที่ (Group of Permissions) */
CREATE TABLE App_Roles (
    RoleID          INT IDENTITY(1,1) PRIMARY KEY,
    RoleName        NVARCHAR(50) NOT NULL UNIQUE,      -- เช่น 'Admin', 'Cashier', 'Manager'
    Description     NVARCHAR(100),
    IsSystemRole    BIT DEFAULT 0                      -- 1=Role ระบบ ห้ามลบ
);

/* [App_Role_Permissions] - จับคู่ Role ว่าทำอะไรได้บ้าง */
CREATE TABLE App_Role_Permissions (
    RoleID          INT NOT NULL REFERENCES App_Roles(RoleID),
    PermissionCode  NVARCHAR(50) NOT NULL REFERENCES App_Permissions(PermissionCode),
    PRIMARY KEY (RoleID, PermissionCode)
);

/* [App_Users] - ผู้ใช้งานระบบ (Admin/Cashier/BackOffice) */
CREATE TABLE App_Users (
    UserID          INT IDENTITY(1,1) PRIMARY KEY,
    Username        NVARCHAR(50) NOT NULL UNIQUE,      -- Login Name
    IsADUser        BIT DEFAULT 0,                     -- 1=Login ผ่าน Active Directory, 0=Database Auth
    PasswordHash    NVARCHAR(255),                     -- รหัสผ่าน (Hash) กรณีไม่ใช่ AD
    RelatedVendorID NVARCHAR(20),                      -- ผูกกับร้านค้าไหน (กรณี User เป็นเจ้าของร้าน)
    IsActive        BIT DEFAULT 1                      -- 1=ใช้งานได้, 0=ระงับ
);

/* [App_User_Roles] - กำหนด Role ให้ User (1 คนมีได้หลาย Role) */
CREATE TABLE App_User_Roles (
    UserID          INT NOT NULL REFERENCES App_Users(UserID),
    RoleID          INT NOT NULL REFERENCES App_Roles(RoleID),
    PRIMARY KEY (UserID, RoleID)
);

/* [App_AD_Group_Mappings] - Map AD Group เข้ากับ Role อัตโนมัติ */
CREATE TABLE App_AD_Group_Mappings (
    MappingID       INT IDENTITY(1,1) PRIMARY KEY,
    AD_GroupName    NVARCHAR(100) NOT NULL,            -- ชื่อ Group ใน AD เช่น 'Canteen_Admins'
    RoleID          INT NOT NULL REFERENCES App_Roles(RoleID) -- จะให้ได้ Role อะไรในระบบนี้
);

/* =============================================
   PART 4: EXTENSION - INVENTORY (FIFO/LOTS)
   ============================================= */

/* [Inv_Stock_Balance]
   Description: ยอดคงเหลือรวม (Current Balance)
   Usage: อ่านยอดตรงนี้เพื่อเช็คสต็อกหน้า POS (เร็วมาก ไม่ต้องรวม Lot)
*/
CREATE TABLE Inv_Stock_Balance (
    VendorID        NVARCHAR(20) NOT NULL,
    ProductID       NVARCHAR(20) NOT NULL,
    QtyOnHand       DECIMAL(12, 4) DEFAULT 0,          -- ยอดคงเหลือปัจจุบัน (รวมทุก Lot)
    LastUpdated     DATETIME DEFAULT GETDATE(),        -- อัปเดตล่าสุดเมื่อ
    PRIMARY KEY (VendorID, ProductID)
);

/* [Inv_Lots]
   Description: ล็อตสินค้านำเข้า (Costing Layer)
   Usage: เก็บต้นทุนจริงของแต่ละล็อต เพื่อคำนวณกำไรแบบ FIFO
*/
CREATE TABLE Inv_Lots (
    LotID           BIGINT IDENTITY(1,1) PRIMARY KEY,  -- รหัสล็อต (Auto)
    VendorID        NVARCHAR(20) NOT NULL,
    ProductID       NVARCHAR(20) NOT NULL,
    
    BatchNo         NVARCHAR(50),                      -- เลข Lot/Batch จาก Supplier
    ImportDate      DATETIME DEFAULT GETDATE(),        -- วันที่รับของ (ใช้เรียง FIFO)
    ExpireDate      DATE,                              -- วันหมดอายุสินค้า
    
    CostPrice       DECIMAL(12, 4) NOT NULL,           -- ราคาทุนต่อหน่วยของ Lot นี้
    QtyInitial      DECIMAL(12, 4) NOT NULL,           -- จำนวนที่รับเข้ามาตอนแรก
    QtyRemaining    DECIMAL(12, 4) NOT NULL,           -- จำนวนที่เหลือใน Lot นี้ (ลดลงเมื่อขาย)
    
    IsActive        BIT DEFAULT 1                      -- 0 = หมดแล้ว หรือ หมดอายุ
);
CREATE INDEX IDX_FIFO_Sort ON Inv_Lots(ProductID, ImportDate); -- Index สำคัญสำหรับเรียง FIFO

/* [Inv_Transactions]
   Description: ประวัติการเคลื่อนไหวสต็อก (Audit Trail/Stock Card)
   Usage: ตรวจสอบย้อนหลังว่าของหายไปไหน เข้า/ออก เมื่อไหร่
*/
CREATE TABLE Inv_Transactions (
    TxnStockID      BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnDate         DATETIME DEFAULT GETDATE(),
    VendorID        NVARCHAR(20),
    ProductID       NVARCHAR(20),
    
    TxnType         NVARCHAR(20),                      -- 'IN'=รับของ, 'SALE'=ขาย, 'ADJ'=ปรับยอด, 'WASTE'=ของเสีย
    RefDocNo        NVARCHAR(50),                      -- เลขที่เอกสารอ้างอิง (เช่น PO No., OrderID)
    
    Qty             DECIMAL(12, 4),                    -- จำนวนที่เคลื่อนไหว (+ เพิ่ม, - ลด)
    CostPrice       DECIMAL(12, 4),                    -- ต้นทุน ณ ตอนนั้น (Snapshot)
    LotID           BIGINT,                            -- ตัดจาก Lot ไหน (ถ้าทราบ)
    
    CreatedBy       NVARCHAR(50)                       -- ใครทำรายการ
);

/* =============================================
   PART 5: EXTENSION - LOYALTY (POINTS)
   ============================================= */

/* [Point_Campaigns]
   Description: แคมเปญสะสมแต้ม
   Usage: กำหนดกติกาการแจกแต้ม (เช่น ซื้อครบ 25 บาท ได้ 1 แต้ม)
*/
CREATE TABLE Point_Campaigns (
    CampaignID      INT IDENTITY(1,1) PRIMARY KEY,
    CampaignName    NVARCHAR(100),                     -- ชื่อแคมเปญ
    StartDate       DATETIME,                          -- วันเริ่ม
    EndDate         DATETIME,                          -- วันจบ
    
    EveryAmt        DECIMAL(12, 2) DEFAULT 25.00,      -- ยอดซื้อทุกๆ X บาท
    Points          DECIMAL(12, 2) DEFAULT 1.00,       -- ได้ Y แต้ม
    
    IsActive        BIT DEFAULT 1                      -- 1=เปิดใช้งาน
);

/* [Point_Transactions]
   Description: ประวัติคะแนน (History)
   Usage: ตรวจสอบการได้มา/ใช้ไป ของแต้ม
*/
CREATE TABLE Point_Transactions (
    PointTxnID      BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnDate         DATETIME DEFAULT GETDATE(),
    CardUID         NVARCHAR(50) NOT NULL,             -- ของใคร
    
    TxnType         NVARCHAR(20),                      -- 'EARN'=สะสม, 'BURN'=แลก, 'EXPIRE'=หมดอายุ
    Points          DECIMAL(12, 2),                    -- จำนวนแต้ม (+/-)
    
    RefOrderID      BIGINT,                            -- มาจากบิลขายเลขที่เท่าไหร่ (Traceability)
    CampaignID      INT,                               -- มาจากโปรโมชั่นไหน
    Remark          NVARCHAR(200)
);




/*
นี่คือการออกแบบ Schema สำหรับระบบโปรโมชั่นเติมเงิน (Cashier Promotion) เพื่อรองรับโจทย์ที่คุณต้องการครับ โดยผมได้เพิ่มตารางใหม่และ Logic การทำงานที่ครอบคลุมเงื่อนไข:

เติมเงินได้แต้ม (Points)

เติมเงินได้เงินเพิ่ม (Bonus Cash)

กำหนดการถอนคืน (Refundable/Non-refundable)

กำหนดวันหมดอายุ (Expiration)

ท่านสามารถนำ Script นี้ไปต่อท้ายไฟล์ SQL เดิมได้เลยครับ */
/* =============================================
   PART 6: EXTENSION - CASHIER PROMOTIONS (TOP-UP CAMPAIGNS)
   ============================================= */

/* [Promo_Cashier_Campaigns]
   Description: แคมเปญโปรโมชั่นสำหรับจุดเติมเงิน
   Usage: กำหนดเงื่อนไขว่าเติมเท่าไหร่ ได้อะไร (แต้ม/เงินแถม)
*/
CREATE TABLE Promo_Cashier_Campaigns (
    CampaignID      INT IDENTITY(1,1) PRIMARY KEY,
    CampaignName    NVARCHAR(100) NOT NULL,            -- ชื่อโปรโมชั่น เช่น 'Pro Topup 500 Get 50'
    StartDate       DATETIME NOT NULL,                 -- เริ่มโปร
    EndDate         DATETIME NOT NULL,                 -- จบโปร
    
    -- Condition (เงื่อนไข)
    MinTopUpAmount  DECIMAL(12, 2) NOT NULL DEFAULT 0, -- ยอดเติมเงินขั้นต่ำที่เข้าเงื่อนไข
    CustomerType    NVARCHAR(20) DEFAULT 'ALL',        -- 'ALL', 'VIP', 'STAFF' (เผื่อล็อคกลุ่มลูกค้า)

    -- Reward Definition (รางวัล)
    RewardType      NVARCHAR(20) NOT NULL,             -- 'POINT' (ได้แต้ม), 'CASH_BONUS' (ได้เงินเพิ่ม)
    CalculationType NVARCHAR(20) DEFAULT 'FIXED',      -- 'FIXED' (ให้ค่าคงที่), 'PERCENT' (ให้เป็น %)
    RewardValue     DECIMAL(12, 2) NOT NULL,           -- มูลค่ารางวัล (เช่น 10 แต้ม หรือ 5%)
    
    -- Constraints (ข้อจำกัด)
    IsRefundable    BIT DEFAULT 0,                     -- กรณีได้เงินเพิ่ม: 1=ถอนคืนได้ (เข้า Cash), 0=ถอนไม่ได้ (เข้า Subsidy)
    ExpireDays      INT NULL,                          -- อายุการใช้งานของรางวัล (วัน) NULL=ตามอายุบัตร
    
    IsActive        BIT DEFAULT 1,
    CreatedAt       DATETIME DEFAULT GETDATE()
);

/* [Promo_Redemption_Log]
   Description: ประวัติการได้รับโปรโมชั่น
   Usage: ตรวจสอบย้อนหลังว่า Transaction ไหนได้โปรโมชั่นอะไรไปบ้าง
*/
CREATE TABLE Promo_Redemption_Log (
    LogID           BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnID           BIGINT NOT NULL REFERENCES Txn_Cashier(TxnID), -- อ้างอิงการเติมเงิน
    CampaignID      INT NOT NULL REFERENCES Promo_Cashier_Campaigns(CampaignID),
    
    CardUID         NVARCHAR(50) NOT NULL,
    RewardType      NVARCHAR(20),                      -- 'POINT', 'CASH_BONUS'
    RewardAmount    DECIMAL(12, 2),                    -- จำนวนที่ได้รับจริง
    
    ExpireDate      DATE NULL,                         -- วันหมดอายุของรางวัลก้อนนี้ (ถ้ามี)
    RedeemedAt      DATETIME DEFAULT GETDATE()
);

/* คำอธิบายการทำงาน (Business Logic)
ผมได้ออกแบบให้รองรับ Use Case ต่างๆ ดังนี้ครับ:

1. เติมเงินแล้วได้แต้ม (Top-up for Points)
ตั้งค่า: RewardType = 'POINT', RewardValue = 10

ผลลัพธ์: เมื่อเติมเงินผ่านเกณฑ์ ระบบจะบวกแต้มเข้า Cards.PointBalance และคำนวณวันหมดอายุแต้มให้

2. เติมเงินแล้วได้เงินเพิ่ม (Top-up Bonus)
ตั้งค่า: RewardType = 'CASH_BONUS', RewardValue = 50

ผลลัพธ์: ระบบจะเติมเงินเข้ากระเป๋าบัตร โดยดูที่ฟิลด์ IsRefundable:

ถ้า IsRefundable = 1 (คืนได้) -> เข้าช่อง CashBalance (เหมือนลูกค้าเติมเอง)

ถ้า IsRefundable = 0 (คืนไม่ได้/เงินแถม) -> เข้าช่อง SubsidyBalance (เงินสวัสดิการ/เงินฟรี) อันนี้สำคัญมาก เพื่อป้องกันลูกค้าหัวหมอ เติมเอาโปรแล้วมาขอถอนเงินสดออกทันทีครับ

3. ตัวอย่าง Stored Procedure สำหรับคำนวณโปรโมชั่น (Logic หลังบ้าน)
*/

CREATE PROCEDURE Sp_Cashier_ApplyPromo
    @TxnID BIGINT,           -- เลขที่รายการเติมเงิน
    @TopUpAmount DECIMAL(12,2),
    @CardUID NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @BonusAmt DECIMAL(12,2) = 0;
    DECLARE @PointsAmt DECIMAL(12,2) = 0;
    DECLARE @Now DATETIME = GETDATE();

    -- วนลูปหาโปรโมชั่นที่ Active และยอดถึงเกณฑ์
    -- หมายเหตุ: Logic นี้สมมติว่าให้โปรฯ เดียวที่ดีที่สุด หรือให้ทุกโปรฯ ตามแต่ Policy ของห้าง
    
    SELECT TOP 1 
        @BonusAmt = CASE 
            WHEN RewardType = 'CASH_BONUS' AND CalculationType = 'FIXED' THEN RewardValue
            WHEN RewardType = 'CASH_BONUS' AND CalculationType = 'PERCENT' THEN (@TopUpAmount * RewardValue / 100)
            ELSE 0 END,
        @PointsAmt = CASE 
            WHEN RewardType = 'POINT' AND CalculationType = 'FIXED' THEN RewardValue
            WHEN RewardType = 'POINT' AND CalculationType = 'PERCENT' THEN (@TopUpAmount * RewardValue / 100)
            ELSE 0 END
    FROM Promo_Cashier_Campaigns
    WHERE IsActive = 1 
      AND @Now BETWEEN StartDate AND EndDate
      AND @TopUpAmount >= MinTopUpAmount
    ORDER BY MinTopUpAmount DESC; -- เลือกโปรที่ยอดขั้นต่ำสูงที่สุดก่อน

    -- อัปเดตข้อมูลลงบัตร (Cards)
    IF @BonusAmt > 0
    BEGIN
        -- เช็คว่าจะเข้ากระเป๋าไหน (คืนได้/ไม่ได้)
        -- Logic: ถ้า IsRefundable = 0 ให้เข้า SubsidyBalance
        UPDATE C
        SET C.SubsidyBalance = C.SubsidyBalance + @BonusAmt
        FROM Cards C 
        CROSS JOIN Promo_Cashier_Campaigns P
        WHERE C.CardUID = @CardUID AND P.IsRefundable = 0;

        -- บันทึก Log
        INSERT INTO Promo_Redemption_Log (TxnID, CampaignID, CardUID, RewardType, RewardAmount)
        VALUES (@TxnID, 999, @CardUID, 'CASH_BONUS', @BonusAmt); -- 999 คือสมมติ ID
    END

    IF @PointsAmt > 0
    BEGIN
        UPDATE Cards 
        SET PointBalance = PointBalance + @PointsAmt 
        WHERE CardUID = @CardUID;
        
        -- บันทึก Log
        INSERT INTO Promo_Redemption_Log (TxnID, CampaignID, CardUID, RewardType, RewardAmount)
        VALUES (@TxnID, 999, @CardUID, 'POINT', @PointsAmt);
    END
END




/* =============================================
   PART 7: BACK OFFICE UI STRUCTURE (MENUS)
   ใช้ร่วมกับ Part 3 Security เดิม
   ============================================= */

/* 1. สร้างตารางเมนู */
CREATE TABLE App_Menus (
    MenuID          INT IDENTITY(1,1) PRIMARY KEY,
    ParentMenuID    INT NULL REFERENCES App_Menus(MenuID), -- เมนูแม่ (ถ้ามี)
    MenuName_TH     NVARCHAR(100) NOT NULL,
    MenuName_EN     NVARCHAR(100),
    IconClass       NVARCHAR(50),                      -- เช่น 'fa-users', 'fa-credit-card'
    RoutePath       NVARCHAR(100),                     -- URL ใน Frontend เช่น '/vendors'
    SortOrder       INT DEFAULT 0,
    
    -- Link กับตาราง App_Permissions ใน Part 3
    RequiredPermissionCode NVARCHAR(50) REFERENCES App_Permissions(PermissionCode), 
    
    IsActive        BIT DEFAULT 1
);

/* 2. สร้าง Permissions (สิทธิ์ CRUD) สำหรับ 5 โมดูลหลักที่คุณขอมา */
-- เคลียร์ของเก่า (ถ้ามี) หรือ Insert ใหม่
INSERT INTO App_Permissions (PermissionCode, Description, Category) VALUES 
-- 1. จัดการร้านค้า (Vendors)
('VENDOR_VIEW',   'ดูข้อมูลร้านค้า',    'Vendor'),
('VENDOR_ADD',    'เพิ่มร้านค้าใหม่',    'Vendor'),
('VENDOR_EDIT',   'แก้ไขข้อมูลร้านค้า',  'Vendor'),
('VENDOR_DELETE', 'ลบร้านค้า',        'Vendor'),

-- 2. จัดการพนักงาน (Employees)
('EMP_VIEW',      'ดูข้อมูลพนักงาน',     'Employee'),
('EMP_ADD',       'เพิ่มพนักงานใหม่',     'Employee'),
('EMP_EDIT',      'แก้ไขข้อมูลพนักงาน',   'Employee'),
('EMP_DELETE',    'ลบพนักงาน',         'Employee'),

-- 3. จัดการบัตร (Cards)
('CARD_VIEW',     'ดูข้อมูลบัตร',        'Card'),
('CARD_ADD',      'ออกบัตรใหม่',        'Card'),
('CARD_EDIT',     'แก้ไขสถานะบัตร',      'Card'), -- อายัด/ปลดล็อค
('CARD_TOPUP',    'เติมเงินพิเศษ (Admin)', 'Card'), -- สิทธิ์เติมเงินหลังบ้าน (ถ้าจำเป็น)

-- 4. จัดการเครื่องแคชเชียร์ (Terminals)
('POS_VIEW',      'ดูรายการเครื่อง POS', 'Terminal'),
('POS_ADD',       'ลงทะเบียนเครื่องใหม่',  'Terminal'),
('POS_EDIT',      'แก้ไขตั้งค่าเครื่อง',    'Terminal'),

-- 5. จัดการโปรโมชั่น (Promotions)
('PROMO_VIEW',    'ดูโปรโมชั่น',        'Promotion'),
('PROMO_ADD',     'สร้างโปรโมชั่น',      'Promotion'),
('PROMO_EDIT',    'แก้ไข/ปิดโปรโมชั่น',   'Promotion');


/* 3. สร้างรายการเมนู (Menu Items) และผูกกับสิทธิ์ */

-- 3.1 สร้างเมนูแม่ "Master Data" (เห็นได้ทุกคนที่มีสิทธิ์ Login หรือจะกำหนดสิทธิ์ก็ได้)
INSERT INTO App_Menus (MenuName_TH, IconClass, RoutePath, SortOrder, RequiredPermissionCode)
VALUES ('ข้อมูลพื้นฐาน', 'fa-database', '/master', 1, NULL); 

DECLARE @MasterMenuID INT = SCOPE_IDENTITY(); -- จำ ID เมนูแม่ไว้

-- 3.2 สร้างเมนูย่อย โดยผูกกับ Permission _VIEW
INSERT INTO App_Menus (ParentMenuID, MenuName_TH, RoutePath, SortOrder, RequiredPermissionCode) VALUES
(@MasterMenuID, 'จัดการร้านค้า',      '/vendors',   1, 'VENDOR_VIEW'),
(@MasterMenuID, 'จัดการพนักงาน',     '/employees', 2, 'EMP_VIEW'),
(@MasterMenuID, 'จัดการบัตร',        '/cards',     3, 'CARD_VIEW'),
(@MasterMenuID, 'เครื่องแคชเชียร์',    '/terminals', 4, 'POS_VIEW');

-- 3.3 สร้างเมนูแยก สำหรับ Marketing
INSERT INTO App_Menus (MenuName_TH, IconClass, RoutePath, SortOrder, RequiredPermissionCode)
VALUES ('โปรโมชั่น & การตลาด', 'fa-tags', '/marketing', 2, 'PROMO_VIEW');




/* =============================================
   PART 10: WELFARE & SUBSIDY MANAGEMENT
   ระบบเติมเงินสวัสดิการ (Manual & Auto)
   ============================================= */

/* [Subsidy_Rules]
   Description: กฎการให้สวัสดิการอัตโนมัติ
   Usage: ตั้งค่าว่าบัตรกลุ่มไหน ได้เงินเท่าไหร่ ได้ทุกวันไหน
*/
CREATE TABLE Subsidy_Rules (
    RuleID          INT IDENTITY(1,1) PRIMARY KEY,
    RuleName        NVARCHAR(100) NOT NULL,            -- เช่น 'Daily Staff Allowance 50 THB'
    
    -- เงื่อนไขกลุ่มเป้าหมาย
    CardGroupID     NVARCHAR(20) NOT NULL REFERENCES Card_Groups(CardGroupID), -- ให้เฉพาะกลุ่มนี้
    
    -- เงื่อนไขเวลาและการให้
    FrequencyType   NVARCHAR(20) DEFAULT 'DAILY',      -- 'DAILY'=ทุกวัน, 'MONTHLY'=ทุกเดือน, 'ONE_TIME'=ครั้งเดียว
    ExecutionDay    INT DEFAULT 0,                     -- กรณี MONTHLY: ระบุวันที่ (เช่น 1 = วันที่ 1 ของเดือน)
    
    Amount          DECIMAL(12, 2) NOT NULL,           -- จำนวนเงินที่ให้
    
    -- โหมดการจัดการยอดเก่า (สำคัญมาก)
    TopUpMode       NVARCHAR(20) DEFAULT 'RESET',      
    -- 'RESET' = ล้างยอดเก่าทิ้งแล้วเติมใหม่ (เช่น ให้วันละ 50 ถ้าไม่ใช้ก็ตัดทิ้ง)
    -- 'STACK' = ทบยอด (สะสมไปเรื่อยๆ)
    
    IsActive        BIT DEFAULT 1,
    LastRunDate     DATE NULL                          -- กันการรันซ้ำในวันเดียวกัน
);

/* [Txn_Subsidy_Log]
   Description: ประวัติการเติมเงินสวัสดิการ
   Usage: ใช้ Audit ว่าใครเติมให้ หรือระบบเติมให้ตอนไหน
*/
CREATE TABLE Txn_Subsidy_Log (
    LogID           BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnDate         DATETIME DEFAULT GETDATE(),
    
    CardUID         NVARCHAR(50) NOT NULL,             -- เติมเข้าบัตรใบไหน
    EmployeeID      NVARCHAR(20),                      -- (Option) เก็บเผื่อ Card หายจะได้ตามถูกคน
    
    Amount          DECIMAL(12, 2) NOT NULL,           -- ยอดที่เติม
    PreviousBalance DECIMAL(12, 2) DEFAULT 0,          -- ยอดก่อนเติม (เพื่อการตรวจสอบ)
    NewBalance      DECIMAL(12, 2) DEFAULT 0,          -- ยอดหลังเติม
    
    TxnType         NVARCHAR(20) NOT NULL,             -- 'MANUAL'=คนกดเติม, 'AUTO'=ระบบเติมตามรอบ
    RuleID          INT NULL REFERENCES Subsidy_Rules(RuleID), -- อ้างอิงกฎ (ถ้าเป็น AUTO)
    
    PerformedBy     NVARCHAR(50),                      -- ชื่อ User (ถ้า Manual) หรือ 'SYSTEM' (ถ้า Auto)
    Remark          NVARCHAR(255)
);
CREATE INDEX IDX_Subsidy_Log ON Txn_Subsidy_Log(TxnDate, CardUID);


CREATE PROCEDURE Sp_Subsidy_Manual_TopUp
    @CardUID NVARCHAR(50),
    @Amount DECIMAL(12,2),
    @Remark NVARCHAR(255),
    @AdminUser NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. ดึงค่าเก่ามาเก็บไว้ก่อน
        DECLARE @OldBal DECIMAL(12,2);
        DECLARE @EmpID NVARCHAR(20);
        
        SELECT @OldBal = SubsidyBalance, @EmpID = EmployeeID 
        FROM Cards WHERE CardUID = @CardUID;

        IF @OldBal IS NULL 
        BEGIN
            THROW 50001, 'Card not found or inactive', 1;
        END

        -- 2. อัปเดตยอดเงิน (Manual ส่วนใหญ่จะเป็นการ Top-up เพิ่ม คือแบบ STACK)
        UPDATE Cards 
        SET SubsidyBalance = SubsidyBalance + @Amount 
        WHERE CardUID = @CardUID;

        -- 3. บันทึก Log
        INSERT INTO Txn_Subsidy_Log 
        (CardUID, EmployeeID, Amount, PreviousBalance, NewBalance, TxnType, PerformedBy, Remark)
        VALUES 
        (@CardUID, @EmpID, @Amount, @OldBal, @OldBal + @Amount, 'MANUAL', @AdminUser, @Remark);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END


CREATE PROCEDURE Sp_Subsidy_Process_AutoRules
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @DayOfMonth INT = DAY(@Today); -- วันที่เท่าไหร่ (1-31)

    -- วนลูปหากฎที่เข้าเงื่อนไขวันนี้
    -- Logic: เลือก Rule ที่ Active และ (เป็นแบบรายวัน หรือ เป็นแบบรายเดือนที่วันที่ตรง)
    -- และยังไม่เคยรันในวันนี้
    
    DECLARE @RuleCursor CURSOR;
    DECLARE @RuleID INT, @CardGroup NVARCHAR(20), @Amt DECIMAL(12,2), 
            @Mode NVARCHAR(20), @RuleName NVARCHAR(100);

    SET @RuleCursor = CURSOR FOR
    SELECT RuleID, RuleName, CardGroupID, Amount, TopUpMode
    FROM Subsidy_Rules
    WHERE IsActive = 1
      AND (LastRunDate IS NULL OR LastRunDate < @Today) -- ป้องกันรันซ้ำ
      AND (
          FrequencyType = 'DAILY' 
          OR (FrequencyType = 'MONTHLY' AND ExecutionDay = @DayOfMonth)
      );

    OPEN @RuleCursor;
    FETCH NEXT FROM @RuleCursor INTO @RuleID, @RuleName, @CardGroup, @Amt, @Mode;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRANSACTION
        BEGIN TRY
            -- 1. บันทึก Log ก่อนทำการเปลี่ยนแปลง (Bulk Insert Log)
            INSERT INTO Txn_Subsidy_Log 
            (CardUID, EmployeeID, Amount, PreviousBalance, NewBalance, TxnType, RuleID, PerformedBy, Remark)
            SELECT 
                C.CardUID, 
                C.EmployeeID, 
                @Amt, 
                C.SubsidyBalance,
                CASE 
                    WHEN @Mode = 'RESET' THEN @Amt              -- ถ้า Reset ยอดใหม่คือ Amt เลย
                    ELSE C.SubsidyBalance + @Amt                -- ถ้า Stack ยอดใหม่คือ เก่า+Amt
                END,
                'AUTO', 
                @RuleID, 
                'SYSTEM', 
                'Auto Rule: ' + @RuleName
            FROM Cards C
            WHERE C.CardGroupID = @CardGroup 
              AND C.Status = 'Active'; -- เฉพาะบัตรที่ยังใช้งานอยู่

            -- 2. อัปเดตเงินในกระเป๋า (Bulk Update)
            IF @Mode = 'RESET'
            BEGIN
                -- ล้างยอดเก่าทิ้ง แล้วใส่ยอดใหม่
                UPDATE Cards
                SET SubsidyBalance = @Amt
                WHERE CardGroupID = @CardGroup AND Status = 'Active';
            END
            ELSE -- Mode 'STACK'
            BEGIN
                -- ทบยอด
                UPDATE Cards
                SET SubsidyBalance = SubsidyBalance + @Amt
                WHERE CardGroupID = @CardGroup AND Status = 'Active';
            END

            -- 3. อัปเดตว่า Rule นี้รันแล้ว
            UPDATE Subsidy_Rules SET LastRunDate = @Today WHERE RuleID = @RuleID;

            COMMIT TRANSACTION
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            -- บันทึก Error ลงตาราง ErrorLog ถ้ามี (ในที่นี้ขอข้าม)
        END CATCH

        FETCH NEXT FROM @RuleCursor INTO @RuleID, @RuleName, @CardGroup, @Amt, @Mode;
    END

    CLOSE @RuleCursor;
    DEALLOCATE @RuleCursor;
END







