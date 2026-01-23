\# 📘 FCS Modern Database Specification

\*\*Project Name:\*\* Modern Food Court System (FCS)  

\*\*Version:\*\* 2.0 (Full Integrated)  

\*\*Last Updated:\*\* 2026-01-22  

\*\*Author:\*\* Pakanee \& System Architect



---



\## 1. 🏗️ System Architecture \& Diagrams

ภาพรวมความสัมพันธ์ของข้อมูลในระบบ แบ่งตามโมดูลหลัก



\### 1.1 Core Business \& Transactions (ระบบหลักและการเงิน)

แสดงความสัมพันธ์ระหว่าง บัตร (Cards) -> การซื้อขาย (Sales) -> และสินค้า (Inventory)



```mermaid

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

&nbsp;   

&nbsp;   %% Promotion \& Welfare

&nbsp;   Subsidy\_Rules ||--o{ Txn\_Subsidy\_Log : "triggers"

&nbsp;   Cards ||--o{ Txn\_Subsidy\_Log : "audit trail"

&nbsp;   Promo\_Cashier\_Campaigns ||--o{ Promo\_Redemption\_Log : "rewards"

