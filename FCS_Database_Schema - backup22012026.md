\# Modern Food Court System (FCS) - Database Schema Documentation



\## 1. Project Overview

ระบบบริหารจัดการศูนย์อาหาร (Canteen/Food Court) ฉบับปรับปรุงใหม่ (Modernized)

\- \*\*Database:\*\* Microsoft SQL Server

\- \*\*Language Support:\*\* Thai \& English (Thai\_CI\_AS)

\- \*\*Key Features:\*\* - Dynamic Pricing (ราคาตามกลุ่มบัตร)

&nbsp; - Multi-Payment (เงินสด, QR, คูปอง)

&nbsp; - Tax Compliance (รองรับสรรพากร, e-Tax)

&nbsp; - RBAC Security (Role-Based Access Control + Active Directory Integration)



\## 2. Entity Relationship Summary

\- \*\*Master Data:\*\* Vendors, Terminals, Employees, Cards, Products

\- \*\*Transactions:\*\* Cashier (Top-up/Refund), Sales (POS Ordering)

\- \*\*Security:\*\* Users, Roles, Permissions, AD\_Group\_Mappings



---



\## 3. SQL Definition Script



\### Part 1: Database Setup

```sql

-- Create Database with Thai Collation

CREATE DATABASE FCS\_ModernDB

COLLATE Thai\_CI\_AS;

GO

USE FCS\_ModernDB;

GO


/* [Terminals]
  ทะเบียนเครื่อง POS/Cashier
  Purpose: ใช้ระบุตัวตนเครื่องสำหรับออกใบกำกับภาษี (Tax Requirement)
*/
CREATE TABLE Terminals (
    TerminalID      NVARCHAR(20) NOT NULL PRIMARY KEY, -- ID ในโปรแกรม เช่น 'CASH-01'
    TerminalName    NVARCHAR(100),                     
    TerminalType    NVARCHAR(20),                      -- 'Cashier', 'Vendor', 'Kiosk'
    MachineSerialNo NVARCHAR(50) NOT NULL,             -- S/N Hardware (บังคับสำหรับสรรพากร)
    POS_Reg_No      NVARCHAR(50),                      -- เลขทะเบียนเครื่องเก็บเงิน (ภ.พ.20)
    LocationCode    NVARCHAR(20),                      
    IsActive        BIT DEFAULT 1,                     
    CreatedAt       DATETIME DEFAULT GETDATE()
);

/* [Vendors]
  ข้อมูลร้านค้า
  Purpose: จัดการข้อมูลร้านค้า สัญญาเช่า และสถานะภาษี
*/
CREATE TABLE Vendors (
    VendorID        NVARCHAR(20) NOT NULL PRIMARY KEY, 
    VendorName      NVARCHAR(100) NOT NULL,            
    OwnerName       NVARCHAR(100),                     
    -- Tax Info
    TaxID           NVARCHAR(20),                      -- เลขผู้เสียภาษี
    BranchID        NVARCHAR(10) DEFAULT '00000',      
    IsVatRegistered BIT DEFAULT 0,                     
    -- Finance
    GP_Share_Percent DECIMAL(5, 2) DEFAULT 0.00,       -- ส่วนแบ่ง GP (%)
    Rent_Price      DECIMAL(12, 2) DEFAULT 0.00,       
    IsActive        BIT DEFAULT 1
);

/* [Employees] - ข้อมูลพนักงาน/ลูกค้า */
CREATE TABLE Employees (
    EmployeeID      NVARCHAR(20) NOT NULL PRIMARY KEY, 
    FullName        NVARCHAR(150) NOT NULL,            
    Department      NVARCHAR(100),                     
    Status          NVARCHAR(20) DEFAULT 'Active',     
    ExtraData       NVARCHAR(MAX),                     -- JSON for flexible data (LineID, Allergies)
    UpdatedAt       DATETIME DEFAULT GETDATE()
);

/* [Card_Groups] - กลุ่มบัตรสำหรับกำหนดราคา */
CREATE TABLE Card_Groups (
    CardGroupID     NVARCHAR(20) NOT NULL PRIMARY KEY, -- 'STAFF', 'VIP', 'VISITOR'
    GroupName       NVARCHAR(100),                     
    IsDefault       BIT DEFAULT 0                      
);

/* [Cards] - กระเป๋าเงินในบัตร */
CREATE TABLE Cards (
    CardUID         NVARCHAR(50) NOT NULL PRIMARY KEY, -- RFID UID
    EmployeeID      NVARCHAR(20) REFERENCES Employees(EmployeeID), 
    CardGroupID     NVARCHAR(20) DEFAULT 'VISITOR' REFERENCES Card_Groups(CardGroupID), 
    
    CashBalance     DECIMAL(12, 2) DEFAULT 0.00,       -- กระเป๋าเงินเติมเอง (ถอนได้)
    SubsidyBalance  DECIMAL(12, 2) DEFAULT 0.00,       -- กระเป๋าสวัสดิการ (ถอนไม่ได้)
    
    Status          NVARCHAR(20) DEFAULT 'Active',     
    ExpireDate      DATE NULL                          
);


/* [Products] - สินค้าและราคามาตรฐาน */
CREATE TABLE Products (
    ProductID       NVARCHAR(20) NOT NULL PRIMARY KEY, 
    VendorID        NVARCHAR(20) NOT NULL REFERENCES Vendors(VendorID),
    ProductName     NVARCHAR(150) NOT NULL,
    BasePrice       DECIMAL(12, 2) NOT NULL DEFAULT 0, -- ราคาปกติ
    IsActive        BIT DEFAULT 1
);

/* [Product_Price_Tiers] - ราคาพิเศษตามกลุ่มบัตร */
CREATE TABLE Product_Price_Tiers (
    TierID          BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductID       NVARCHAR(20) NOT NULL REFERENCES Products(ProductID),
    CardGroupID     NVARCHAR(20) NOT NULL REFERENCES Card_Groups(CardGroupID),
    SpecialPrice    DECIMAL(12, 2) NOT NULL,           -- ราคาเฉพาะกลุ่มนี้
    CONSTRAINT UK_Product_Tier UNIQUE (ProductID, CardGroupID)
);
CREATE INDEX IDX_PriceLookup ON Product_Price_Tiers(ProductID, CardGroupID) INCLUDE (SpecialPrice);

/* [Ref_Payment_Types] - ประเภทการจ่ายเงิน */
CREATE TABLE Ref_Payment_Types (
    PaymentTypeID   NVARCHAR(20) NOT NULL PRIMARY KEY, -- 'CASH', 'QR', 'COUPON'
    PaymentName     NVARCHAR(50),
    NeedRefNo       BIT DEFAULT 0                      -- 1=Require Reference No.
);

/* [Coupons] - ระบบคูปอง */
CREATE TABLE Coupons (
    CouponCode      NVARCHAR(50) NOT NULL PRIMARY KEY, 
    Value           DECIMAL(12, 2) NOT NULL, 
    Status          NVARCHAR(20) DEFAULT 'Active',     -- Active, Used, Expired
    ExpireDate      DATE,                              
    UsedAt          DATETIME NULL,                     
    UsedByTxnID     BIGINT NULL                        
);


/* [System_Shifts] - รอบการทำงาน/กะ */
CREATE TABLE System_Shifts (
    ShiftID         INT IDENTITY(1,1) PRIMARY KEY,     
    ShiftDate       DATE DEFAULT CAST(GETDATE() AS DATE),
    TerminalID      NVARCHAR(20) REFERENCES Terminals(TerminalID), 
    OpenedBy        NVARCHAR(50),                      
    OpenedAt        DATETIME DEFAULT GETDATE(),
    ClosedAt        DATETIME NULL,                     
    Status          NVARCHAR(20) DEFAULT 'Open'        
);


/* [Txn_Cashier] - Header ธุรกรรมแคชเชียร์ */
CREATE TABLE Txn_Cashier (
    TxnID           BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnDate         DATETIME DEFAULT GETDATE(),
    ShiftID         INT REFERENCES System_Shifts(ShiftID),
    
    -- Tax Compliance Snapshot
    TerminalID      NVARCHAR(20) NOT NULL REFERENCES Terminals(TerminalID),
    MachineSerialNo NVARCHAR(50),                      
    POS_Reg_No      NVARCHAR(50),                      
    IssuerTaxID     NVARCHAR(20),                      
    TaxInvoiceNo    NVARCHAR(50),                      
    IsFullTax       BIT DEFAULT 0,                     

    -- Transaction Info
    CardUID         NVARCHAR(50) NOT NULL REFERENCES Cards(CardUID),
    TxnType         NVARCHAR(20) NOT NULL,             -- 'TopUp', 'Refund'
    TotalAmount     DECIMAL(12, 2) NOT NULL,           
    CashierUserID   NVARCHAR(50),                      
    Remark          NVARCHAR(255)
);
CREATE INDEX IDX_Cashier_Card ON Txn_Cashier(CardUID, TxnDate);

/* [Txn_Cashier_Payments] - Detail การจ่ายเงิน (Multi-Payment) */
CREATE TABLE Txn_Cashier_Payments (
    PaymentID       BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnID           BIGINT NOT NULL REFERENCES Txn_Cashier(TxnID),
    PaymentTypeID   NVARCHAR(20) NOT NULL REFERENCES Ref_Payment_Types(PaymentTypeID),
    Amount          DECIMAL(12, 2) NOT NULL,           
    RefNo           NVARCHAR(100),                     -- QR Ref, Coupon Code
    RefData         NVARCHAR(MAX)                      
);

/* [Sales_Orders] - Header บิลขายหน้าร้าน */
CREATE TABLE Sales_Orders (
    OrderID         BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderNo         NVARCHAR(30),                      
    OrderDate       DATETIME DEFAULT GETDATE(),
    ShiftID         INT REFERENCES System_Shifts(ShiftID),
    
    -- Tax Compliance Snapshot
    TerminalID      NVARCHAR(20) NOT NULL REFERENCES Terminals(TerminalID),
    MachineSerialNo NVARCHAR(50),
    VendorID        NVARCHAR(20) NOT NULL REFERENCES Vendors(VendorID),
    IssuerTaxID     NVARCHAR(20),                      
    TaxInvoiceNo    NVARCHAR(50),                      

    -- Payment Info
    CardUID         NVARCHAR(50) NOT NULL REFERENCES Cards(CardUID),
    TotalAmount     DECIMAL(12, 2) NOT NULL,           
    VatAmount       DECIMAL(12, 2) DEFAULT 0,          
    CashUsed        DECIMAL(12, 2) DEFAULT 0,          
    SubsidyUsed     DECIMAL(12, 2) DEFAULT 0,          
    Status          NVARCHAR(20) DEFAULT 'Completed'   
);

/* [Sales_Order_Items] - Detail รายการสินค้า */
CREATE TABLE Sales_Order_Items (
    ItemID          BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderID         BIGINT NOT NULL REFERENCES Sales_Orders(OrderID),
    ProductID       NVARCHAR(20) REFERENCES Products(ProductID),
    ProductName_Log NVARCHAR(150),                     -- Snapshot Name
    Quantity        INT DEFAULT 1,
    UnitPrice       DECIMAL(12, 2),                    -- Real price sold
    TotalPrice      AS (Quantity * UnitPrice) PERSISTED 
);

/* [App_Permissions] - สิทธิ์การใช้งาน */
CREATE TABLE App_Permissions (
    PermissionCode  NVARCHAR(50) NOT NULL PRIMARY KEY, -- e.g., 'EMP_EDIT'
    Description     NVARCHAR(100),                     
    Category        NVARCHAR(50)                       
);

/* [App_Roles] - บทบาท */
CREATE TABLE App_Roles (
    RoleID          INT IDENTITY(1,1) PRIMARY KEY,
    RoleName        NVARCHAR(50) NOT NULL UNIQUE,      -- e.g., 'Admin', 'Cashier'
    Description     NVARCHAR(100),
    IsSystemRole    BIT DEFAULT 0                      
);

/* [App_Role_Permissions] - Mapping Role <-> Permission */
CREATE TABLE App_Role_Permissions (
    RoleID          INT NOT NULL REFERENCES App_Roles(RoleID),
    PermissionCode  NVARCHAR(50) NOT NULL REFERENCES App_Permissions(PermissionCode),
    PRIMARY KEY (RoleID, PermissionCode)
);

/* [App_Users] - ผู้ใช้งาน (Hybrid AD/Local) */
CREATE TABLE App_Users (
    UserID          INT IDENTITY(1,1) PRIMARY KEY,
    Username        NVARCHAR(50) NOT NULL UNIQUE,      
    IsADUser        BIT DEFAULT 0,                     -- 1 = Use Active Directory
    PasswordHash    NVARCHAR(255),                     -- Local Password
    RelatedVendorID NVARCHAR(20),                      
    IsActive        BIT DEFAULT 1        
);

/* [App_User_Roles] - Mapping User <-> Role */
CREATE TABLE App_User_Roles (
    UserID          INT NOT NULL REFERENCES App_Users(UserID),
    RoleID          INT NOT NULL REFERENCES App_Roles(RoleID),
    PRIMARY KEY (UserID, RoleID)
);

/* [App_AD_Group_Mappings] - Auto Role Assignment from AD */
CREATE TABLE App_AD_Group_Mappings (
    MappingID       INT IDENTITY(1,1) PRIMARY KEY,
    AD_GroupName    NVARCHAR(100) NOT NULL,            -- e.g., 'Canteen_Admins'
    RoleID          INT NOT NULL REFERENCES App_Roles(RoleID) 
);

CREATE PROCEDURE GetProductPrice
    @ProductID NVARCHAR(20),
    @CardGroupID NVARCHAR(20)
AS
BEGIN
    SELECT 
        p.ProductID,
        p.ProductName,
        -- Logic: Check Tier Price first, if NULL then use Base Price
        COALESCE(t.SpecialPrice, p.BasePrice) AS FinalPrice 
    FROM Products p
    LEFT JOIN Product_Price_Tiers t 
        ON p.ProductID = t.ProductID 
        AND t.CardGroupID = @CardGroupID
    WHERE p.ProductID = @ProductID;
END





## 6. Extension Modules (Stock & Loyalty)

### Part 1: High-Performance Inventory (FIFO/Lot Tracking)
*Concept:* แยกยอดคงเหลือ (Balance) ออกจากรายละเอียด Lot เพื่อความเร็วในการขาย

```sql
/* [Inv_Stock_Balance] - ยอดคงเหลือรวม (Fast Read for POS)
   Purpose: เอาไว้ให้ POS เช็คเร็วๆ ว่า "มีของขายไหม" โดยไม่ต้องไปคำนวณ Lot
*/
CREATE TABLE Inv_Stock_Balance (
    VendorID        NVARCHAR(20) NOT NULL,             -- ร้านไหน
    ProductID       NVARCHAR(20) NOT NULL,             -- สินค้าอะไร
    QtyOnHand       DECIMAL(12, 4) DEFAULT 0,          -- ยอดคงเหลือปัจจุบัน (รวมทุก Lot)
    LastUpdated     DATETIME DEFAULT GETDATE(),
    PRIMARY KEY (VendorID, ProductID)
);

/* [Inv_Lots] - ล็อตสินค้านำเข้า (Costing Layer)
   Purpose: เก็บต้นทุนและวันหมดอายุของแต่ละล็อต (ใช้ทำ FIFO ภายหลังการขาย)
*/
CREATE TABLE Inv_Lots (
    LotID           BIGINT IDENTITY(1,1) PRIMARY KEY,
    VendorID        NVARCHAR(20) NOT NULL,
    ProductID       NVARCHAR(20) NOT NULL,
    
    BatchNo         NVARCHAR(50),                      -- เลข Lot/Batch จาก Supplier
    ImportDate      DATETIME DEFAULT GETDATE(),
    ExpireDate      DATE,                              -- วันหมดอายุสินค้า
    
    CostPrice       DECIMAL(12, 4) NOT NULL,           -- ราคาทุนต่อหน่วยของ Lot นี้
    QtyInitial      DECIMAL(12, 4) NOT NULL,           -- จำนวนที่รับเข้ามา
    QtyRemaining    DECIMAL(12, 4) NOT NULL,           -- จำนวนที่เหลือใน Lot นี้
    
    IsActive        BIT DEFAULT 1                      -- 0 = หมดแล้ว หรือ หมดอายุ
);
CREATE INDEX IDX_FIFO_Sort ON Inv_Lots(ProductID, ImportDate); -- Index สำคัญสำหรับ FIFO

/* [Inv_Transactions] - ประวัติการเคลื่อนไหวสต็อก (Audit Trail) */
CREATE TABLE Inv_Transactions (
    TxnStockID      BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnDate         DATETIME DEFAULT GETDATE(),
    VendorID        NVARCHAR(20),
    ProductID       NVARCHAR(20),
    
    TxnType         NVARCHAR(20),                      -- 'IN'=รับของ, 'SALE'=ขาย, 'ADJ'=ปรับยอด, 'WASTE'=ของเสีย
    RefDocNo        NVARCHAR(50),                      -- เลขที่เอกสารอ้างอิง (เช่น PO No. หรือ OrderID)
    
    Qty             DECIMAL(12, 4),                    -- จำนวน (+ หรือ -)
    CostPrice       DECIMAL(12, 4),                    -- ต้นทุน ณ ตอนนั้น (Snapshot)
    LotID           BIGINT,                            -- ตัดจาก Lot ไหน (Update ภายหลังโดย Job ได้)
    
    CreatedBy       NVARCHAR(50)
);

/* Update Table: Cards (เพิ่ม Field) */
/*
ALTER TABLE Cards ADD PointBalance DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE Cards ADD PointExpDate DATE;
*/

/* [Point_Campaigns] - กติกาการให้แต้ม */
CREATE TABLE Point_Campaigns (
    CampaignID      INT IDENTITY(1,1) PRIMARY KEY,
    CampaignName    NVARCHAR(100),
    
    StartDate       DATETIME,
    EndDate         DATETIME,
    
    -- Logic: ซื้อครบ EveryAmt บาท ได้ Points แต้ม
    EveryAmt        DECIMAL(12, 2) DEFAULT 25.00,      -- เช่น ทุก 25 บาท
    Points          DECIMAL(12, 2) DEFAULT 1.00,       -- ได้ 1 แต้ม
    
    IsActive        BIT DEFAULT 1
);

/* [Point_Transactions] - ประวัติแต้ม (เข้า/ออก) */
CREATE TABLE Point_Transactions (
    PointTxnID      BIGINT IDENTITY(1,1) PRIMARY KEY,
    TxnDate         DATETIME DEFAULT GETDATE(),
    CardUID         NVARCHAR(50) NOT NULL,
    
    TxnType         NVARCHAR(20),                      -- 'EARN'=สะสม, 'BURN'=แลก, 'EXPIRE'=หมดอายุ
    Points          DECIMAL(12, 2),                    -- จำนวนแต้ม (+/-)
    
    RefOrderID      BIGINT,                            -- มาจากบิลขายเลขที่เท่าไหร่
    CampaignID      INT,                               -- มาจากโปรโมชั่นไหน
    
    Remark          NVARCHAR(200)
);



CREATE PROCEDURE Sp_Inventory_Receive
    @VendorID NVARCHAR(20),
    @ProductID NVARCHAR(20),
    @Qty DECIMAL(12,4),
    @Cost DECIMAL(12,4),
    @BatchNo NVARCHAR(50),
    @ExpireDate DATE,
    @User NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION
            -- 1. สร้าง Lot ใหม่
            INSERT INTO Inv_Lots (VendorID, ProductID, BatchNo, ImportDate, ExpireDate, CostPrice, QtyInitial, QtyRemaining)
            VALUES (@VendorID, @ProductID, @BatchNo, GETDATE(), @ExpireDate, @Cost, @Qty, @Qty);
            
            -- 2. บันทึก Transaction
            INSERT INTO Inv_Transactions (TxnType, VendorID, ProductID, Qty, CostPrice, CreatedBy)
            VALUES ('IN', @VendorID, @ProductID, @Qty, @Cost, @User);
            
            -- 3. อัปเดตยอดรวมทันที (Fast Update)
            MERGE Inv_Stock_Balance AS target
            USING (SELECT @VendorID AS V, @ProductID AS P) AS source
            ON (target.VendorID = source.V AND target.ProductID = source.P)
            WHEN MATCHED THEN
                UPDATE SET QtyOnHand = QtyOnHand + @Qty, LastUpdated = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (VendorID, ProductID, QtyOnHand) VALUES (@VendorID, @ProductID, @Qty);
        COMMIT TRANSACTION
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END


CREATE PROCEDURE Sp_PostSale_Process
    @OrderID BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 1. ตัดยอดสต็อกรวม (เร็วมาก)
    UPDATE B
    SET B.QtyOnHand = B.QtyOnHand - I.Quantity
    FROM Inv_Stock_Balance B
    INNER JOIN Sales_Order_Items I ON B.ProductID = I.ProductID
    INNER JOIN Sales_Orders O ON I.OrderID = O.OrderID
    WHERE O.OrderID = @OrderID AND B.VendorID = O.VendorID;

    -- 2. คำนวณแต้ม (Loyalty Calculation)
    DECLARE @TotalAmt DECIMAL(12,2);
    DECLARE @CardUID NVARCHAR(50);
    DECLARE @Points DECIMAL(12,2) = 0;
    
    SELECT @TotalAmt = TotalAmount, @CardUID = CardUID FROM Sales_Orders WHERE OrderID = @OrderID;
    
    -- ดึงกติกาปัจจุบัน (Standard Rule)
    SELECT TOP 1 @Points = FLOOR(@TotalAmt / EveryAmt) * Points
    FROM Point_Campaigns 
    WHERE IsActive = 1 AND GETDATE() BETWEEN StartDate AND EndDate;
    
    IF @Points > 0
    BEGIN
        -- เพิ่มแต้มให้ลูกค้า
        UPDATE Cards SET PointBalance = PointBalance + @Points WHERE CardUID = @CardUID;
        
        -- เก็บประวัติ
        INSERT INTO Point_Transactions (CardUID, TxnType, Points, RefOrderID)
        VALUES (@CardUID, 'EARN', @Points, @OrderID);
    END
    
    -- หมายเหตุ: การตัด Lot แบบ FIFO (ละเอียด) ควรทำเป็น Scheduled Job ทุก 5-10 นาที
    -- เพื่อไม่ให้ Lock Table นานเกินไปในขณะขาย
END

### คำแนะนำเพิ่มเติมในการนำไปใช้
1.  **Scheduled Job (FIFO Logic):** ผมแนะนำว่า **"อย่าตัด Lot ใน SP ขาย"** ให้สร้าง Job ใน SQL Agent รันทุกๆ 10 นาที เพื่อเกลี่ยรายการขายจาก `Sales_Order_Items` ไปไล่ตัด `QtyRemaining` ในตาราง `Inv_Lots` ตามลำดับเวลา (FIFO) วิธีนี้จะทำให้ตอนแคชเชียร์กดขาย ระบบจะตอบสนองทันที (0.01 วินาที) ไม่ต้องรอวนลูปตัด Lot
2.  **ดัชนี (Indexes):** สังเกตว่าผมสร้าง Index ไว้ที่ `Inv_Lots(ProductID, ImportDate)` เพื่อให้ระบบเรียงลำดับ Lot เก่ามาใหม่ได้เร็วที่สุดครับ




3. ข้อแนะนำเพิ่มเติม (เพื่อความสมบูรณ์)
เพื่อให้ระบบแยกแยะได้ชัดเจนว่า "อันไหนยอมให้สต็อกติดลบ" หรือ "อันไหนไม่ต้องเช็คสต็อกเลย" ผมแนะนำให้เพิ่ม Field StockType หรือ IsStockItem เข้าไปในตาราง Products ครับ

SQL Script สำหรับปรับปรุง (Update):

SQL
/* ปรับปรุงตาราง Products เพิ่มตัวระบุประเภทสต็อก */
ALTER TABLE Products ADD StockType NVARCHAR(20) DEFAULT 'STOCK'; 
-- 'STOCK' = ตัดสต็อก (ยอมให้ติดลบได้)
-- 'SERVICE' = ไม่ตัดสต็อก (เช่น ค่าบริการ, อาหารตามสั่ง)
-- 'FIFO' = ต้องมีของเท่านั้นถึงขายได้ (เข้มงวด)
ตัวอย่าง Logic ตอนขาย (Store Procedure):

SQL
/* ตอนตัดสต็อก ให้เช็คก่อนว่าเป็นสินค้าประเภทไหน */
IF (SELECT StockType FROM Products WHERE ProductID = @ProdID) != 'SERVICE'
BEGIN
    -- ค่อยทำการตัดสต็อก (ยอมให้ติดลบ)
    UPDATE Inv_Stock_Balance SET QtyOnHand = QtyOnHand - @Qty ...
END
สรุป: ระบบนี้ออกแบบมาให้ "การขายสำคัญที่สุด" (Sales First) ครับ สินค้าไม่มีในระบบสต็อก หรือสต็อกเป็น 0 ก็สามารถขายออกไปก่อนได้ เพื่อไม่ให้เสียโอกาสทางการค้าครับ

GO


