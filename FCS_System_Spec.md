ได้ครับ ผมจัดทำเอกสาร Technical Specification (Markdown) ฉบับสมบูรณ์ให้ครับ



เอกสารชุดนี้ถูกออกแบบมาเพื่อ:



เห็นภาพรวม: มี ER Diagram และ Sequence Diagram ให้ทีมเข้าใจ Flow



เข้าใจ Data: มี Data Dictionary อธิบายตารางสำคัญ



พร้อมใช้งาน: รวม SQL Script ทั้งหมด และ แก้ลำดับการรัน (Sequence) ให้แล้ว (ใส่ข้อมูล Card\_Groups ก่อนสร้าง Subsidy\_Rules เพื่อไม่ให้ error)



คุณสามารถ Copy Code ด้านล่างนี้ไป Save เป็นไฟล์ FCS\_System\_Spec.md แล้วส่งให้ทีม Dev ได้เลยครับ



📘 FCS Modern Database Specification

Project: Modern Food Court System (FCS)



Database: FCS\_ModernDB



Version: 1.2 (Integrated Welfare \& Back Office)



1\. 🏗️ ภาพรวมโครงสร้างข้อมูล (ER Diagram)

ความสัมพันธ์หลักของระบบ ระหว่าง บัตร (Cards), การเงิน (Transactions) และ สวัสดิการ (Subsidy)



Code snippet

erDiagram

&nbsp;   %% Master Data

&nbsp;   Card\_Groups ||--o{ Cards : "defines price tier"

&nbsp;   Employees ||--o{ Cards : "owns"

&nbsp;   Vendors ||--o{ Products : "sells"

&nbsp;   Products ||--o{ Product\_Price\_Tiers : "has special price"

&nbsp;   Card\_Groups ||--o{ Product\_Price\_Tiers : "receives special price"



&nbsp;   %% Transaction

&nbsp;   Cards ||--o{ Txn\_Cashier : "topup/refund"

&nbsp;   Cards ||--o{ Sales\_Orders : "purchases"

&nbsp;   Txn\_Cashier ||--|{ Txn\_Cashier\_Payments : "paid by"

&nbsp;   Sales\_Orders ||--|{ Sales\_Order\_Items : "contains"



&nbsp;   %% Welfare / Subsidy Module

&nbsp;   Card\_Groups ||--o{ Subsidy\_Rules : "receives welfare"

&nbsp;   Subsidy\_Rules ||--o{ Txn\_Subsidy\_Log : "triggers"

&nbsp;   Cards ||--o{ Txn\_Subsidy\_Log : "audit trail"



&nbsp;   %% Security

&nbsp;   App\_Roles ||--|{ App\_Role\_Permissions : "has"

&nbsp;   App\_Permissions ||--|{ App\_Role\_Permissions : "assigned to"

&nbsp;   App\_Users ||--|{ App\_User\_Roles : "is in"

&nbsp;   App\_Roles ||--|{ App\_User\_Roles : "assigned to"

2\. 💰 Welfare \& Subsidy Logic (ระบบสวัสดิการ)

ส่วนนี้มีความซับซ้อนที่สุด คือการเติมเงินอัตโนมัติ (Auto Top-up)



2.1 ตารางที่เกี่ยวข้อง

Table Name	Description	Key Field

Subsidy\_Rules	กฎการให้สวัสดิการ (เช่น ให้ Staff วันละ 50 บาท)	TopUpMode ('RESET' ตัดยอดเก่า, 'STACK' สะสมยอด)

Txn\_Subsidy\_Log	ประวัติการเติมเงินสวัสดิการ (Audit Trail)	แยก TxnType ('AUTO', 'MANUAL')

2.2 ขั้นตอนการทำงาน (Sequence Diagram)

Logic การทำงานของ Stored Procedure: Sp\_Subsidy\_Process\_AutoRules (รันทุกเที่ยงคืน)



Code snippet

sequenceDiagram

&nbsp;   participant Job as Scheduler (00:01 AM)

&nbsp;   participant DB as Database

&nbsp;   participant Log as Txn\_Subsidy\_Log

&nbsp;   participant Card as Cards Table



&nbsp;   Job->>DB: Call Sp\_Subsidy\_Process\_AutoRules

&nbsp;   DB->>DB: Find Active Rules for Today

&nbsp;   

&nbsp;   loop For Each Rule

&nbsp;       DB->>Card: Select Target Cards (e.g., Group='STAFF')

&nbsp;       alt Mode = RESET (ล้างยอดเก่า)

&nbsp;           DB->>Card: Update SubsidyBalance = NewAmount

&nbsp;       else Mode = STACK (ทบยอด)

&nbsp;           DB->>Card: Update SubsidyBalance = Old + NewAmount

&nbsp;       end

&nbsp;       DB->>Log: Insert Log (Type='AUTO')

&nbsp;       DB->>DB: Update Rule LastRunDate

&nbsp;   end

&nbsp;   

&nbsp;   DB-->>Job: Success

3\. 📂 Installation Script (SQL)

คำแนะนำสำหรับทีม Dev: รัน Script นี้ตามลำดับ 1-5 เพื่อสร้าง Database และป้องกัน Error เรื่อง Foreign Key



Step 1: Create Database \& Tables

(โครงสร้างตารางทั้งหมด)



SQL

CREATE DATABASE FCS\_ModernDB COLLATE Thai\_CI\_AS;

GO

USE FCS\_ModernDB;

GO



/\* --- 1. Master Data --- \*/

CREATE TABLE Terminals (

&nbsp;   TerminalID NVARCHAR(20) PRIMARY KEY, TerminalName NVARCHAR(100), TerminalType NVARCHAR(20),

&nbsp;   MachineSerialNo NVARCHAR(50) NOT NULL, POS\_Reg\_No NVARCHAR(50), LocationCode NVARCHAR(20),

&nbsp;   IsActive BIT DEFAULT 1, CreatedAt DATETIME DEFAULT GETDATE()

);



CREATE TABLE Vendors (

&nbsp;   VendorID NVARCHAR(20) PRIMARY KEY, VendorName NVARCHAR(100) NOT NULL, OwnerName NVARCHAR(100),

&nbsp;   TaxID NVARCHAR(20), BranchID NVARCHAR(10) DEFAULT '00000', IsVatRegistered BIT DEFAULT 0,

&nbsp;   GP\_Share\_Percent DECIMAL(5, 2) DEFAULT 0.00, Rent\_Price DECIMAL(12, 2) DEFAULT 0.00, IsActive BIT DEFAULT 1

);



CREATE TABLE Employees (

&nbsp;   EmployeeID NVARCHAR(20) PRIMARY KEY, FullName NVARCHAR(150) NOT NULL, Department NVARCHAR(100),

&nbsp;   Status NVARCHAR(20) DEFAULT 'Active', ExtraData NVARCHAR(MAX), UpdatedAt DATETIME DEFAULT GETDATE()

);



CREATE TABLE Card\_Groups (

&nbsp;   CardGroupID NVARCHAR(20) PRIMARY KEY, GroupName NVARCHAR(100), IsDefault BIT DEFAULT 0

);



CREATE TABLE Cards (

&nbsp;   CardUID NVARCHAR(50) PRIMARY KEY, 

&nbsp;   EmployeeID NVARCHAR(20) REFERENCES Employees(EmployeeID),

&nbsp;   CardGroupID NVARCHAR(20) DEFAULT 'VISITOR' REFERENCES Card\_Groups(CardGroupID),

&nbsp;   CashBalance DECIMAL(12, 2) DEFAULT 0.00,       -- เงินเติมเอง (ถอนได้)

&nbsp;   SubsidyBalance DECIMAL(12, 2) DEFAULT 0.00,    -- เงินสวัสดิการ (ถอนไม่ได้)

&nbsp;   Status NVARCHAR(20) DEFAULT 'Active', ExpireDate DATE NULL,

&nbsp;   PointBalance DECIMAL(12, 2) DEFAULT 0.00, PointExpDate DATE

);



CREATE TABLE Products (

&nbsp;   ProductID NVARCHAR(20) PRIMARY KEY, VendorID NVARCHAR(20) REFERENCES Vendors(VendorID),

&nbsp;   ProductName NVARCHAR(150) NOT NULL, BasePrice DECIMAL(12, 2) NOT NULL DEFAULT 0,

&nbsp;   StockType NVARCHAR(20) DEFAULT 'STOCK', IsActive BIT DEFAULT 1

);



CREATE TABLE Product\_Price\_Tiers (

&nbsp;   TierID BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   ProductID NVARCHAR(20) REFERENCES Products(ProductID),

&nbsp;   CardGroupID NVARCHAR(20) REFERENCES Card\_Groups(CardGroupID),

&nbsp;   SpecialPrice DECIMAL(12, 2) NOT NULL,

&nbsp;   CONSTRAINT UK\_Product\_Tier UNIQUE (ProductID, CardGroupID)

);



CREATE TABLE Ref\_Payment\_Types (

&nbsp;   PaymentTypeID NVARCHAR(20) PRIMARY KEY, PaymentName NVARCHAR(50), NeedRefNo BIT DEFAULT 0

);



CREATE TABLE Coupons (

&nbsp;   CouponCode NVARCHAR(50) PRIMARY KEY, Value DECIMAL(12, 2) NOT NULL,

&nbsp;   Status NVARCHAR(20) DEFAULT 'Active', ExpireDate DATE, UsedAt DATETIME NULL, UsedByTxnID BIGINT NULL

);



/\* --- 2. Transactions --- \*/

CREATE TABLE System\_Shifts (

&nbsp;   ShiftID INT IDENTITY(1,1) PRIMARY KEY, ShiftDate DATE DEFAULT CAST(GETDATE() AS DATE),

&nbsp;   TerminalID NVARCHAR(20) REFERENCES Terminals(TerminalID), OpenedBy NVARCHAR(50),

&nbsp;   OpenedAt DATETIME DEFAULT GETDATE(), ClosedAt DATETIME NULL, Status NVARCHAR(20) DEFAULT 'Open'

);



CREATE TABLE Txn\_Cashier (

&nbsp;   TxnID BIGINT IDENTITY(1,1) PRIMARY KEY, TxnDate DATETIME DEFAULT GETDATE(),

&nbsp;   ShiftID INT REFERENCES System\_Shifts(ShiftID), TerminalID NVARCHAR(20) REFERENCES Terminals(TerminalID),

&nbsp;   MachineSerialNo NVARCHAR(50), POS\_Reg\_No NVARCHAR(50), IssuerTaxID NVARCHAR(20), TaxInvoiceNo NVARCHAR(50), IsFullTax BIT DEFAULT 0,

&nbsp;   CardUID NVARCHAR(50) REFERENCES Cards(CardUID), TxnType NVARCHAR(20) NOT NULL,

&nbsp;   TotalAmount DECIMAL(12, 2) NOT NULL, CashierUserID NVARCHAR(50), Remark NVARCHAR(255)

);



CREATE TABLE Txn\_Cashier\_Payments (

&nbsp;   PaymentID BIGINT IDENTITY(1,1) PRIMARY KEY, TxnID BIGINT REFERENCES Txn\_Cashier(TxnID),

&nbsp;   PaymentTypeID NVARCHAR(20) REFERENCES Ref\_Payment\_Types(PaymentTypeID),

&nbsp;   Amount DECIMAL(12, 2) NOT NULL, RefNo NVARCHAR(100), RefData NVARCHAR(MAX)

);



CREATE TABLE Sales\_Orders (

&nbsp;   OrderID BIGINT IDENTITY(1,1) PRIMARY KEY, OrderNo NVARCHAR(30), OrderDate DATETIME DEFAULT GETDATE(),

&nbsp;   ShiftID INT REFERENCES System\_Shifts(ShiftID), TerminalID NVARCHAR(20) REFERENCES Terminals(TerminalID),

&nbsp;   MachineSerialNo NVARCHAR(50), VendorID NVARCHAR(20) REFERENCES Vendors(VendorID),

&nbsp;   IssuerTaxID NVARCHAR(20), TaxInvoiceNo NVARCHAR(50),

&nbsp;   CardUID NVARCHAR(50) REFERENCES Cards(CardUID), TotalAmount DECIMAL(12, 2) NOT NULL,

&nbsp;   VatAmount DECIMAL(12, 2) DEFAULT 0, CashUsed DECIMAL(12, 2) DEFAULT 0, SubsidyUsed DECIMAL(12, 2) DEFAULT 0,

&nbsp;   Status NVARCHAR(20) DEFAULT 'Completed'

);



CREATE TABLE Sales\_Order\_Items (

&nbsp;   ItemID BIGINT IDENTITY(1,1) PRIMARY KEY, OrderID BIGINT REFERENCES Sales\_Orders(OrderID),

&nbsp;   ProductID NVARCHAR(20) REFERENCES Products(ProductID), ProductName\_Log NVARCHAR(150),

&nbsp;   Quantity INT DEFAULT 1, UnitPrice DECIMAL(12, 2), TotalPrice AS (Quantity \* UnitPrice) PERSISTED

);



/\* --- 3. Security \& Back Office --- \*/

CREATE TABLE App\_Permissions (

&nbsp;   PermissionCode NVARCHAR(50) PRIMARY KEY, Description NVARCHAR(100), Category NVARCHAR(50)

);



CREATE TABLE App\_Roles (

&nbsp;   RoleID INT IDENTITY(1,1) PRIMARY KEY, RoleName NVARCHAR(50) UNIQUE, Description NVARCHAR(100), IsSystemRole BIT DEFAULT 0

);



CREATE TABLE App\_Role\_Permissions (

&nbsp;   RoleID INT REFERENCES App\_Roles(RoleID), PermissionCode NVARCHAR(50) REFERENCES App\_Permissions(PermissionCode),

&nbsp;   PRIMARY KEY (RoleID, PermissionCode)

);



CREATE TABLE App\_Users (

&nbsp;   UserID INT IDENTITY(1,1) PRIMARY KEY, Username NVARCHAR(50) UNIQUE, IsADUser BIT DEFAULT 0,

&nbsp;   PasswordHash NVARCHAR(255), RelatedVendorID NVARCHAR(20), IsActive BIT DEFAULT 1

);



CREATE TABLE App\_User\_Roles (

&nbsp;   UserID INT REFERENCES App\_Users(UserID), RoleID INT REFERENCES App\_Roles(RoleID), PRIMARY KEY (UserID, RoleID)

);



CREATE TABLE App\_Menus (

&nbsp;   MenuID INT IDENTITY(1,1) PRIMARY KEY, ParentMenuID INT REFERENCES App\_Menus(MenuID),

&nbsp;   MenuName\_TH NVARCHAR(100), MenuName\_EN NVARCHAR(100), IconClass NVARCHAR(50),

&nbsp;   RoutePath NVARCHAR(100), SortOrder INT DEFAULT 0,

&nbsp;   RequiredPermissionCode NVARCHAR(50) REFERENCES App\_Permissions(PermissionCode), IsActive BIT DEFAULT 1

);



/\* --- 4. Welfare / Subsidy --- \*/

CREATE TABLE Subsidy\_Rules (

&nbsp;   RuleID INT IDENTITY(1,1) PRIMARY KEY, RuleName NVARCHAR(100) NOT NULL,

&nbsp;   CardGroupID NVARCHAR(20) REFERENCES Card\_Groups(CardGroupID), -- FK ต้องมี Group ก่อน Insert

&nbsp;   FrequencyType NVARCHAR(20) DEFAULT 'DAILY', ExecutionDay INT DEFAULT 0,

&nbsp;   Amount DECIMAL(12, 2) NOT NULL, TopUpMode NVARCHAR(20) DEFAULT 'RESET',

&nbsp;   IsActive BIT DEFAULT 1, LastRunDate DATE NULL

);



CREATE TABLE Txn\_Subsidy\_Log (

&nbsp;   LogID BIGINT IDENTITY(1,1) PRIMARY KEY, TxnDate DATETIME DEFAULT GETDATE(),

&nbsp;   CardUID NVARCHAR(50) NOT NULL, EmployeeID NVARCHAR(20),

&nbsp;   Amount DECIMAL(12, 2) NOT NULL, PreviousBalance DECIMAL(12, 2) DEFAULT 0, NewBalance DECIMAL(12, 2) DEFAULT 0,

&nbsp;   TxnType NVARCHAR(20) NOT NULL, RuleID INT REFERENCES Subsidy\_Rules(RuleID),

&nbsp;   PerformedBy NVARCHAR(50), Remark NVARCHAR(255)

);



/\* --- 5. Promotion \& Inventory (Brief) --- \*/

CREATE TABLE Promo\_Cashier\_Campaigns (

&nbsp;   CampaignID INT IDENTITY(1,1) PRIMARY KEY, CampaignName NVARCHAR(100), StartDate DATETIME, EndDate DATETIME,

&nbsp;   MinTopUpAmount DECIMAL(12,2), CustomerType NVARCHAR(20), RewardType NVARCHAR(20), CalculationType NVARCHAR(20),

&nbsp;   RewardValue DECIMAL(12,2), IsRefundable BIT, ExpireDays INT, IsActive BIT DEFAULT 1, CreatedAt DATETIME

);

CREATE TABLE Promo\_Redemption\_Log (

&nbsp;   LogID BIGINT IDENTITY(1,1) PRIMARY KEY, TxnID BIGINT, CampaignID INT, CardUID NVARCHAR(50),

&nbsp;   RewardType NVARCHAR(20), RewardAmount DECIMAL(12,2), ExpireDate DATE, RedeemedAt DATETIME

);

Step 2: Create Stored Procedures

(Logic การทำงานหลัก)



SQL

GO

/\* SP: Manual Subsidy Topup \*/

CREATE PROCEDURE Sp\_Subsidy\_Manual\_TopUp

&nbsp;   @CardUID NVARCHAR(50), @Amount DECIMAL(12,2), @Remark NVARCHAR(255), @AdminUser NVARCHAR(50)

AS

BEGIN

&nbsp;   SET NOCOUNT ON;

&nbsp;   BEGIN TRANSACTION;

&nbsp;   BEGIN TRY

&nbsp;       DECLARE @OldBal DECIMAL(12,2); DECLARE @EmpID NVARCHAR(20);

&nbsp;       SELECT @OldBal = SubsidyBalance, @EmpID = EmployeeID FROM Cards WHERE CardUID = @CardUID;



&nbsp;       IF @OldBal IS NULL THROW 50001, 'Card not found', 1;



&nbsp;       UPDATE Cards SET SubsidyBalance = SubsidyBalance + @Amount WHERE CardUID = @CardUID;

&nbsp;       INSERT INTO Txn\_Subsidy\_Log (CardUID, EmployeeID, Amount, PreviousBalance, NewBalance, TxnType, PerformedBy, Remark)

&nbsp;       VALUES (@CardUID, @EmpID, @Amount, @OldBal, @OldBal + @Amount, 'MANUAL', @AdminUser, @Remark);



&nbsp;       COMMIT TRANSACTION;

&nbsp;   END TRY

&nbsp;   BEGIN CATCH

&nbsp;       ROLLBACK TRANSACTION; THROW;

&nbsp;   END CATCH

END

GO



/\* SP: Auto Subsidy Process (Scheduled Job) \*/

CREATE PROCEDURE Sp\_Subsidy\_Process\_AutoRules

AS

BEGIN

&nbsp;   SET NOCOUNT ON;

&nbsp;   DECLARE @Today DATE = CAST(GETDATE() AS DATE);

&nbsp;   DECLARE @DayOfMonth INT = DAY(@Today);



&nbsp;   DECLARE @RuleCursor CURSOR;

&nbsp;   DECLARE @RuleID INT, @CardGroup NVARCHAR(20), @Amt DECIMAL(12,2), @Mode NVARCHAR(20), @RuleName NVARCHAR(100);



&nbsp;   SET @RuleCursor = CURSOR FOR

&nbsp;   SELECT RuleID, RuleName, CardGroupID, Amount, TopUpMode

&nbsp;   FROM Subsidy\_Rules

&nbsp;   WHERE IsActive = 1 AND (LastRunDate IS NULL OR LastRunDate < @Today)

&nbsp;     AND (FrequencyType = 'DAILY' OR (FrequencyType = 'MONTHLY' AND ExecutionDay = @DayOfMonth));



&nbsp;   OPEN @RuleCursor;

&nbsp;   FETCH NEXT FROM @RuleCursor INTO @RuleID, @RuleName, @CardGroup, @Amt, @Mode;



&nbsp;   WHILE @@FETCH\_STATUS = 0

&nbsp;   BEGIN

&nbsp;       BEGIN TRANSACTION

&nbsp;       BEGIN TRY

&nbsp;           -- 1. Insert Log

&nbsp;           INSERT INTO Txn\_Subsidy\_Log (CardUID, EmployeeID, Amount, PreviousBalance, NewBalance, TxnType, RuleID, PerformedBy, Remark)

&nbsp;           SELECT C.CardUID, C.EmployeeID, @Amt, C.SubsidyBalance,

&nbsp;               CASE WHEN @Mode = 'RESET' THEN @Amt ELSE C.SubsidyBalance + @Amt END,

&nbsp;               'AUTO', @RuleID, 'SYSTEM', 'Auto Rule: ' + @RuleName

&nbsp;           FROM Cards C WHERE C.CardGroupID = @CardGroup AND C.Status = 'Active';



&nbsp;           -- 2. Update Balance

&nbsp;           IF @Mode = 'RESET'

&nbsp;               UPDATE Cards SET SubsidyBalance = @Amt WHERE CardGroupID = @CardGroup AND Status = 'Active';

&nbsp;           ELSE

&nbsp;               UPDATE Cards SET SubsidyBalance = SubsidyBalance + @Amt WHERE CardGroupID = @CardGroup AND Status = 'Active';



&nbsp;           -- 3. Mark Rule as Run

&nbsp;           UPDATE Subsidy\_Rules SET LastRunDate = @Today WHERE RuleID = @RuleID;



&nbsp;           COMMIT TRANSACTION

&nbsp;       END TRY

&nbsp;       BEGIN CATCH

&nbsp;           ROLLBACK TRANSACTION;

&nbsp;       END CATCH

&nbsp;       FETCH NEXT FROM @RuleCursor INTO @RuleID, @RuleName, @CardGroup, @Amt, @Mode;

&nbsp;   END

&nbsp;   CLOSE @RuleCursor; DEALLOCATE @RuleCursor;

END

GO

Step 3: Seed Data (Important!) ✅

ส่วนนี้ต้องรันก่อน Step 4 เพื่อแก้ปัญหา Error FK



SQL

/\* 1. สร้างกลุ่มบัตร (Prerequisite for Subsidy Rules) \*/

INSERT INTO Card\_Groups (CardGroupID, GroupName, IsDefault) VALUES 

('VISITOR', 'บุคคลทั่วไป', 1),

('STAFF',   'พนักงานประจำ', 0),

('VIP',     'ผู้บริหาร/แขก', 0);



/\* 2. สร้าง Roles พื้นฐาน \*/

INSERT INTO App\_Roles (RoleName, Description, IsSystemRole) VALUES 

('SystemAdmin', 'Admin สูงสุด', 1),

('Cashier', 'พนักงานแคชเชียร์', 0);



/\* 3. สร้าง Permissions \*/

INSERT INTO App\_Permissions (PermissionCode, Description, Category) VALUES

('POS\_VIEW', 'เข้าใช้ POS', 'Terminal'),

('VENDOR\_VIEW', 'ดูร้านค้า', 'Vendor');



/\* 4. สร้าง Menus \*/

INSERT INTO App\_Menus (MenuName\_TH, RoutePath, RequiredPermissionCode) VALUES 

('จัดการร้านค้า', '/vendors', 'VENDOR\_VIEW');

Step 4: Setup Business Rules

(เมื่อมีข้อมูลกลุ่มบัตรแล้ว จึงจะใส่กฎได้)



SQL

/\* ใส่กฎสวัสดิการ \*/

INSERT INTO Subsidy\_Rules (RuleName, CardGroupID, FrequencyType, Amount, TopUpMode) VALUES 

('Staff Daily 50', 'STAFF', 'DAILY', 50.00, 'RESET'),   -- ให้ 50 บาททุกวัน (ไม่สะสม)

('VIP Monthly 1000', 'VIP', 'MONTHLY', 1000.00, 'STACK'); -- ให้ 1000 ทุกเดือน (สะสมได้)

