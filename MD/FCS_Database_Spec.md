นี่คือ เอกสาร Database Schema Specification ฉบับสมบูรณ์ (รวม SQL Script และ Diagram) ที่จัดรูปแบบให้เป็นมาตรฐาน Professional ครับ



คุณปาคนีสามารถ Copy โค้ดด้านล่างนี้ทั้งหมด ไปบันทึกเป็นไฟล์ชื่อ FCS\_Database\_Spec.md เพื่อส่งให้ทีมงานหรือเก็บเข้า Git Repository ได้ทันทีครับ



Markdown

\# 📘 FCS Database Schema Specification

\*\*Project:\*\* Modern Food Court System (FCS)  

\*\*Database Name:\*\* `FCS\_ModernDB`  

\*\*Version:\*\* 2.0 (Integrated Welfare \& Back Office)  

\*\*Last Updated:\*\* 2026-01-22  

\*\*Author:\*\* Pakanee \& Team



---



\## 1. 🏗️ Entity Relationship Diagrams (ERD)

แผนภาพแสดงความสัมพันธ์ของข้อมูลในระบบ



\### 1.1 Core Business \& Transactions (ระบบหลักและการเงิน)

แสดงความสัมพันธ์ระหว่าง ผู้ถือบัตร (Card Holder) -> การเงิน (Wallet) -> และจุดขาย (POS)



```mermaid

erDiagram

&nbsp;   %% Master Data

&nbsp;   Employees ||--o{ Cards : "owns"

&nbsp;   Card\_Groups ||--o{ Cards : "defines rules"

&nbsp;   Vendors ||--o{ Products : "sells"

&nbsp;   

&nbsp;   %% Pricing \& Rules

&nbsp;   Card\_Groups ||--o{ Product\_Price\_Tiers : "gets price"

&nbsp;   Products ||--o{ Product\_Price\_Tiers : "has price"

&nbsp;   Card\_Groups ||--o{ Subsidy\_Rules : "gets welfare"



&nbsp;   %% Transactions

&nbsp;   Cards ||--o{ Txn\_Cashier : "topup/refund"

&nbsp;   Cards ||--o{ Sales\_Orders : "purchases"

&nbsp;   Txn\_Cashier ||--|{ Txn\_Cashier\_Payments : "payment detail"

&nbsp;   Sales\_Orders ||--|{ Sales\_Order\_Items : "order detail"

&nbsp;   

&nbsp;   %% Logs

&nbsp;   Subsidy\_Rules ||--o{ Txn\_Subsidy\_Log : "triggers"

&nbsp;   Promo\_Cashier\_Campaigns ||--o{ Promo\_Redemption\_Log : "rewards"

1.2 Security \& Back Office (ระบบสิทธิ์การเข้าถึง)

แสดงโครงสร้าง User, Role, Permission และการแสดงผล Menu



Code snippet

erDiagram

&nbsp;   App\_Users ||--|{ App\_User\_Roles : "assigned to"

&nbsp;   App\_Roles ||--|{ App\_Role\_Permissions : "has rights"

&nbsp;   App\_Permissions ||--|{ App\_Role\_Permissions : "mapped to"

&nbsp;   

&nbsp;   App\_Permissions ||--o{ App\_Menus : "controls visibility"

&nbsp;   App\_Menus ||--o{ App\_Menus : "parent of"

2\. 🗄️ Database Definition (SQL Script)

คำแนะนำ: ให้รัน Script ตามลำดับ Step 1 - Step 5 เพื่อป้องกัน Error เรื่อง Foreign Key



Step 1: Create Database \& Master Data

SQL

CREATE DATABASE FCS\_ModernDB COLLATE Thai\_CI\_AS;

GO

USE FCS\_ModernDB;

GO



/\* \[Terminals] - จุดให้บริการ (POS/Kiosk) \*/

CREATE TABLE Terminals (

&nbsp;   TerminalID      NVARCHAR(20) PRIMARY KEY, -- รหัสเครื่อง

&nbsp;   TerminalName    NVARCHAR(100),

&nbsp;   TerminalType    NVARCHAR(20),             -- 'Cashier', 'Vendor', 'Kiosk'

&nbsp;   MachineSerialNo NVARCHAR(50) NOT NULL,    -- Hardware S/N (For Tax Audit)

&nbsp;   IsActive        BIT DEFAULT 1

);



/\* \[Vendors] - ร้านค้า \*/

CREATE TABLE Vendors (

&nbsp;   VendorID        NVARCHAR(20) PRIMARY KEY,

&nbsp;   VendorName      NVARCHAR(100) NOT NULL,

&nbsp;   TaxID           NVARCHAR(20),             -- เลขผู้เสียภาษี

&nbsp;   GP\_Share\_Percent DECIMAL(5, 2) DEFAULT 0, -- % GP

&nbsp;   IsActive        BIT DEFAULT 1

);



/\* \[Employees] - พนักงาน/เจ้าของบัตร \*/

CREATE TABLE Employees (

&nbsp;   EmployeeID      NVARCHAR(20) PRIMARY KEY,

&nbsp;   FullName        NVARCHAR(150),

&nbsp;   Status          NVARCHAR(20) DEFAULT 'Active'

);



/\* \[Card\_Groups] - กลุ่มบัตร (Price Tier) \*/

CREATE TABLE Card\_Groups (

&nbsp;   CardGroupID     NVARCHAR(20) PRIMARY KEY,

&nbsp;   GroupName       NVARCHAR(100),

&nbsp;   IsDefault       BIT DEFAULT 0

);



/\* \[Cards] - ข้อมูลบัตรและกระเป๋าเงิน (Multi-Wallet) \*/

CREATE TABLE Cards (

&nbsp;   CardUID         NVARCHAR(50) PRIMARY KEY, -- RFID UID

&nbsp;   EmployeeID      NVARCHAR(20) REFERENCES Employees(EmployeeID),

&nbsp;   CardGroupID     NVARCHAR(20) REFERENCES Card\_Groups(CardGroupID),

&nbsp;   

&nbsp;   -- Wallets

&nbsp;   CashBalance     DECIMAL(12, 2) DEFAULT 0, -- เงินเติมเอง (ถอนได้)

&nbsp;   SubsidyBalance  DECIMAL(12, 2) DEFAULT 0, -- เงินสวัสดิการ (ถอนไม่ได้)

&nbsp;   PointBalance    DECIMAL(12, 2) DEFAULT 0, -- แต้มสะสม

&nbsp;   

&nbsp;   Status          NVARCHAR(20) DEFAULT 'Active'

);



/\* \[Products] - สินค้า \*/

CREATE TABLE Products (

&nbsp;   ProductID       NVARCHAR(20) PRIMARY KEY,

&nbsp;   VendorID        NVARCHAR(20) REFERENCES Vendors(VendorID),

&nbsp;   ProductName     NVARCHAR(150),

&nbsp;   BasePrice       DECIMAL(12, 2) DEFAULT 0

);



/\* \[Product\_Price\_Tiers] - ราคาพิเศษตามกลุ่มบัตร \*/

CREATE TABLE Product\_Price\_Tiers (

&nbsp;   TierID          BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   ProductID       NVARCHAR(20) REFERENCES Products(ProductID),

&nbsp;   CardGroupID     NVARCHAR(20) REFERENCES Card\_Groups(CardGroupID),

&nbsp;   SpecialPrice    DECIMAL(12, 2) NOT NULL

);

Step 2: Transaction Tables

SQL

/\* \[System\_Shifts] - รอบกะการทำงาน \*/

CREATE TABLE System\_Shifts (

&nbsp;   ShiftID         INT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   TerminalID      NVARCHAR(20) REFERENCES Terminals(TerminalID),

&nbsp;   OpenedBy        NVARCHAR(50),

&nbsp;   OpenedAt        DATETIME DEFAULT GETDATE(),

&nbsp;   ClosedAt        DATETIME NULL,

&nbsp;   Status          NVARCHAR(20) DEFAULT 'Open'

);



/\* \[Txn\_Cashier] - ธุรกรรมเติมเงิน/คืนเงิน \*/

CREATE TABLE Txn\_Cashier (

&nbsp;   TxnID           BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   TxnDate         DATETIME DEFAULT GETDATE(),

&nbsp;   ShiftID         INT REFERENCES System\_Shifts(ShiftID),

&nbsp;   TerminalID      NVARCHAR(20) REFERENCES Terminals(TerminalID),

&nbsp;   

&nbsp;   -- Tax Invoice Info

&nbsp;   TaxInvoiceNo    NVARCHAR(50), 

&nbsp;   MachineSerialNo NVARCHAR(50), 



&nbsp;   CardUID         NVARCHAR(50) REFERENCES Cards(CardUID),

&nbsp;   TxnType         NVARCHAR(20),  -- 'TopUp', 'Refund'

&nbsp;   TotalAmount     DECIMAL(12, 2)

);



/\* \[Txn\_Cashier\_Payments] - รายละเอียดการชำระเงิน (เงินสด/QR) \*/

CREATE TABLE Txn\_Cashier\_Payments (

&nbsp;   PaymentID       BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   TxnID           BIGINT REFERENCES Txn\_Cashier(TxnID),

&nbsp;   PaymentType     NVARCHAR(20),  -- 'CASH', 'QR', 'TRANSFER'

&nbsp;   Amount          DECIMAL(12, 2)

);



/\* \[Sales\_Orders] - บิลขายอาหาร \*/

CREATE TABLE Sales\_Orders (

&nbsp;   OrderID         BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   OrderNo         NVARCHAR(30),

&nbsp;   OrderDate       DATETIME DEFAULT GETDATE(),

&nbsp;   VendorID        NVARCHAR(20) REFERENCES Vendors(VendorID),

&nbsp;   CardUID         NVARCHAR(50) REFERENCES Cards(CardUID),

&nbsp;   

&nbsp;   TotalAmount     DECIMAL(12, 2),

&nbsp;   CashUsed        DECIMAL(12, 2), -- ตัดกระเป๋าเงินสด

&nbsp;   SubsidyUsed     DECIMAL(12, 2)  -- ตัดกระเป๋าสวัสดิการ

);



/\* \[Sales\_Order\_Items] - รายการสินค้าในบิล \*/

CREATE TABLE Sales\_Order\_Items (

&nbsp;   ItemID          BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   OrderID         BIGINT REFERENCES Sales\_Orders(OrderID),

&nbsp;   ProductID       NVARCHAR(20) REFERENCES Products(ProductID),

&nbsp;   Quantity        INT,

&nbsp;   UnitPrice       DECIMAL(12, 2) -- ราคา ณ ตอนขาย

);

Step 3: Security \& Back Office Tables

SQL

/\* \[App\_Permissions] - สิทธิ์ทั้งหมด \*/

CREATE TABLE App\_Permissions (

&nbsp;   PermissionCode  NVARCHAR(50) PRIMARY KEY,

&nbsp;   Description     NVARCHAR(100)

);



/\* \[App\_Roles] - บทบาท \*/

CREATE TABLE App\_Roles (

&nbsp;   RoleID          INT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   RoleName        NVARCHAR(50) UNIQUE

);



/\* \[App\_Role\_Permissions] - Map Role <-> Permission \*/

CREATE TABLE App\_Role\_Permissions (

&nbsp;   RoleID          INT REFERENCES App\_Roles(RoleID),

&nbsp;   PermissionCode  NVARCHAR(50) REFERENCES App\_Permissions(PermissionCode),

&nbsp;   PRIMARY KEY (RoleID, PermissionCode)

);



/\* \[App\_Users] - ผู้ใช้งาน \*/

CREATE TABLE App\_Users (

&nbsp;   UserID          INT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   Username        NVARCHAR(50) UNIQUE,

&nbsp;   PasswordHash    NVARCHAR(255),

&nbsp;   IsActive        BIT DEFAULT 1

);



/\* \[App\_User\_Roles] - Map User <-> Role \*/

CREATE TABLE App\_User\_Roles (

&nbsp;   UserID          INT REFERENCES App\_Users(UserID),

&nbsp;   RoleID          INT REFERENCES App\_Roles(RoleID),

&nbsp;   PRIMARY KEY (UserID, RoleID)

);



/\* \[App\_Menus] - เมนูระบบ \*/

CREATE TABLE App\_Menus (

&nbsp;   MenuID          INT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   ParentMenuID    INT REFERENCES App\_Menus(MenuID),

&nbsp;   MenuName\_TH     NVARCHAR(100),

&nbsp;   RoutePath       NVARCHAR(100),

&nbsp;   RequiredPermissionCode NVARCHAR(50) REFERENCES App\_Permissions(PermissionCode)

);

Step 4: Welfare \& Promotion Tables

SQL

/\* \[Subsidy\_Rules] - กฎการเติมเงินสวัสดิการ \*/

CREATE TABLE Subsidy\_Rules (

&nbsp;   RuleID          INT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   RuleName        NVARCHAR(100),

&nbsp;   CardGroupID     NVARCHAR(20) REFERENCES Card\_Groups(CardGroupID),

&nbsp;   FrequencyType   NVARCHAR(20),   -- 'DAILY', 'MONTHLY'

&nbsp;   Amount          DECIMAL(12, 2),

&nbsp;   TopUpMode       NVARCHAR(20),   -- 'RESET', 'STACK'

&nbsp;   LastRunDate     DATE

);



/\* \[Txn\_Subsidy\_Log] - ประวัติสวัสดิการ \*/

CREATE TABLE Txn\_Subsidy\_Log (

&nbsp;   LogID           BIGINT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   TxnDate         DATETIME DEFAULT GETDATE(),

&nbsp;   CardUID         NVARCHAR(50),

&nbsp;   Amount          DECIMAL(12, 2),

&nbsp;   TxnType         NVARCHAR(20),   -- 'AUTO', 'MANUAL'

&nbsp;   RuleID          INT REFERENCES Subsidy\_Rules(RuleID)

);



/\* \[Promo\_Cashier\_Campaigns] - โปรโมชั่นเติมเงิน \*/

CREATE TABLE Promo\_Cashier\_Campaigns (

&nbsp;   CampaignID      INT IDENTITY(1,1) PRIMARY KEY,

&nbsp;   CampaignName    NVARCHAR(100),

&nbsp;   MinTopUpAmount  DECIMAL(12,2),

&nbsp;   RewardType      NVARCHAR(20),   -- 'POINT', 'CASH\_BONUS'

&nbsp;   RewardValue     DECIMAL(12,2),

&nbsp;   IsRefundable    BIT,            -- 0=เข้า Subsidy, 1=เข้า Cash

&nbsp;   IsActive        BIT DEFAULT 1

);

3\. ⚙️ Business Logic (Stored Procedures)

3.1 SP: Auto Subsidy (รันทุกเที่ยงคืน)

Logic: ตรวจสอบกฎรายวัน/รายเดือน แล้วเติมเงินเข้ากระเป๋า SubsidyBalance



SQL

CREATE PROCEDURE Sp\_Subsidy\_Process\_AutoRules AS

BEGIN

&nbsp;   -- (Logic: เลือก Rule ที่ต้องรันวันนี้ -> Loop Update บัตร -> Insert Log)

&nbsp;   -- \*ดู Code ฉบับเต็มในไฟล์ Source Code\*

END

3.2 SP: Promotion Calculation

Logic: คำนวณของแถมเมื่อแคชเชียร์กดเติมเงิน



SQL

CREATE PROCEDURE Sp\_Cashier\_ApplyPromo

&nbsp;   @TxnID BIGINT, @TopUpAmount DECIMAL(12,2), @CardUID NVARCHAR(50)

AS

BEGIN

&nbsp;   -- (Logic: Check Campaign -> Add Bonus to Subsidy/Point -> Log)

&nbsp;   -- \*ดู Code ฉบับเต็มในไฟล์ Source Code\*

END

4\. ✅ Setup Data (ข้อมูลเริ่มต้น)

ชุดคำสั่งสำหรับเตรียมข้อมูลเข้าระบบครั้งแรก (Seed Data)



SQL

-- 1. สร้างกลุ่มบัตร

INSERT INTO Card\_Groups (CardGroupID, GroupName) VALUES ('VISITOR', 'บุคคลทั่วไป'), ('STAFF', 'พนักงาน');



-- 2. สร้าง Roles

INSERT INTO App\_Roles (RoleName) VALUES ('SystemAdmin'), ('Cashier');



-- 3. สร้าง Permissions

INSERT INTO App\_Permissions (PermissionCode) VALUES ('POS\_VIEW'), ('VENDOR\_VIEW');



-- 4. สร้าง User Admin

INSERT INTO App\_Users (Username) VALUES ('admin');



-- 5. สร้างกฎสวัสดิการตัวอย่าง

INSERT INTO Subsidy\_Rules (RuleName, CardGroupID, FrequencyType, Amount, TopUpMode)

VALUES ('Staff Daily 50', 'STAFF', 'DAILY', 50.00, 'RESET');

End of Document

