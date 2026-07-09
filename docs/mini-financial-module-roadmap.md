# Mini Financial Module Roadmap

## Purpose

Build an office-only internal finance module for tracking delivery-company income, expenses, rider-held cash, rider settlements, and financial reports.

This module is not intended to be full formal accounting or tax software. It should be simple, editable, and useful for daily office operations.

## Core Business Rules

- Only office users can access the finance module.
- Delivery fees are the main company income source.
- Riders collect delivery fees from customers during delivery.
- The company should recognize delivery-fee income only when the rider gives the collected cash back to office.
- Expenses and income should use dynamic office-defined categories.
- Records should be editable.
- No approval workflow is required.
- Clients use a simple pay-per-order model.
- Reports should support daily, weekly, monthly, rider, client, order, category, payment-method, and profit/loss views.
- Rider commission handling should be flexible and expandable.

## Phase 1: Finance Foundation

Create the base finance data model.

### Finance Categories

Use dynamic categories so office can define its own income and expense groups.

Suggested table: `finance_categories`

- `id`
- `name`
- `type`: `income` or `expense`
- `description`
- `is_active`
- `created_by`
- `timestamps`

Example income categories:

- Delivery Fee Collection
- Extra Service Fee
- Adjustment Income
- Other Income

Example expense categories:

- Fuel
- Rider Commission
- Rider Salary
- Office Rent
- Packaging
- Marketing
- Refund
- Maintenance
- Other Expense

### Finance Transactions

Store all manual and system-generated income/expense records.

Suggested table: `finance_transactions`

- `id`
- `type`: `income` or `expense`
- `category_id`
- `amount`
- `payment_method`: `cash`, `mobile_banking`, `bank_transfer`, `other`
- `transaction_date`
- `description`
- `reference_type`
- `reference_id`
- `created_by`
- `timestamps`

Notes:

- Manual income and expense records should be editable.
- System-generated settlement income should also be editable if the office needs corrections.
- Use `reference_type` and `reference_id` to connect finance records to rider settlements, orders, or other future records.

## Phase 2: Rider Cash Flow

Track delivery fees collected by riders and later settled back to office.

### Current Flow

1. Rider completes an order.
2. Delivery fee is recorded as cash held by rider.
3. Office sees the rider's pending cash balance.
4. Rider gives cash back to office.
5. Office records a settlement.
6. The system creates company income from the settlement.

### Rider Settlements

Use or extend the existing rider settlement flow.

Suggested settlement fields:

- `rider_id`
- `amount`
- `payment_method`
- `settled_at`
- `note`
- `created_by`

When office records a rider settlement:

- Reduce rider cash held.
- Create a rider settlement record.
- Create an income transaction using the `Delivery Fee Collection` category.
- Link the finance transaction to the settlement.

Example:

- Order delivery fee: 4,500
- Rider cash held: +4,500
- Office collects 4,500 from rider
- Finance income: +4,500
- Rider cash held: 0

### Partial Settlements

Support partial settlement.

Example:

- Rider cash held: 20,000
- Office collects: 12,000
- Remaining rider balance: 8,000

## Phase 3: Income And Expense Management

Add office screens and APIs for managing finance transactions.

### Income Management

Office can:

- Add income manually
- Edit income
- Delete income
- Assign income category
- Select payment method
- Add description and date

Manual income should be separate from rider-settlement income but stored in the same transaction table.

### Expense Management

Office can:

- Add expense
- Edit expense
- Delete expense
- Assign expense category
- Select payment method
- Add description and date

Expense examples:

- Fuel
- Rider salary
- Rider commission
- Office rent
- Refund
- Maintenance

## Phase 4: Flexible Rider Commission

Make commission support flexible, but keep the first version simple.

### MVP Commission Handling

For the first finance version:

- Add `Rider Commission` as an expense category.
- Office can manually add rider commission as an expense transaction.
- Link the expense to a rider if needed.

### Future Commission Rules

Later, add configurable commission rules.

Suggested table: `commission_rules`

- `id`
- `name`
- `type`: `none`, `fixed`, `percentage`, `fixed_plus_percentage`
- `fixed_amount`
- `percentage`
- `is_active`
- `timestamps`

Possible rule types:

- No commission
- Fixed amount per completed order
- Percentage of delivery fee
- Fixed amount plus percentage
- Per-rider custom rule

Recommended future behavior:

- When order is completed, calculate expected commission.
- Office can review and edit the amount.
- When commission is paid, create an expense transaction.

## Phase 5: Finance Dashboard

Add an office-only Finance section.

Suggested tabs:

1. Overview
2. Transactions
3. Rider Settlements
4. Categories
5. Reports

### Overview

Show high-level cards:

- Today income
- Today expense
- This month income
- This month expense
- Net profit
- Rider cash not yet settled
- Top expense category
- Top rider by collected delivery fees

Show useful lists:

- Riders with pending cash
- Recent income
- Recent expenses
- Recent settlements

### Transactions

Show all income and expense records.

Filters:

- Date range
- Type
- Category
- Payment method
- Rider
- Client/customer
- Order
- Search text

Actions:

- Add transaction
- Edit transaction
- Delete transaction

### Rider Settlements

Show:

- Rider name
- Total collected delivery fees
- Total settled amount
- Current pending balance
- Last settlement date

Actions:

- Collect settlement
- View settlement history
- Edit settlement

### Categories

Show:

- Category name
- Type
- Active/inactive status
- Description

Actions:

- Add category
- Edit category
- Disable category

Prefer disabling categories over deleting if transactions already use them.

## Phase 6: Reports

Build finance reports for internal office decisions.

### Summary Reports

- Daily income, expense, and profit/loss
- Weekly income, expense, and profit/loss
- Monthly income, expense, and profit/loss
- Custom date range summary

### Category Reports

- Income by category
- Expense by category
- Net by category

### Rider Reports

- Delivery fees collected by rider
- Settled amount by rider
- Pending rider cash balance
- Rider commission expense
- Rider net contribution

### Client/Customer Reports

- Orders by client/customer
- Delivery fee total by client/customer
- Payment status by client/customer
- Profit contribution by client/customer, if enough data exists

### Order Reports

- Order code
- Client/customer
- Rider
- Delivery fee
- Fee collected status
- Settlement status
- Related finance transaction

### Payment Method Reports

- Cash income
- Mobile banking income
- Bank transfer income
- Cash expenses
- Mobile banking expenses

## Phase 7: Integration With Existing Delivery Flow

### Order Completion

When rider completes an order:

- Save delivery fee.
- Mark payment status as paid if this matches the current app behavior.
- Increase rider cash held.
- Create or update cash collection record.
- Do not create company income yet.

### Rider Settlement

When office collects money from rider:

- Create settlement record.
- Decrease rider cash held.
- Create finance income transaction.
- Link transaction to the settlement.

### Order Editing

If completed order delivery fee changes:

- Update rider-held cash if not settled yet.
- If already settled, show warning or create an adjustment transaction.

Recommended simple MVP behavior:

- Allow edit.
- Recalculate unsettled rider balance.
- If settlement already exists, require office to add a manual adjustment transaction.

### Order Deletion

If a completed order is deleted:

- Remove or reverse unsettled rider cash.
- If already settled, keep finance history and require manual adjustment.

## Phase 8: Access Control And Audit

### Access Control

Only these roles should access finance routes:

- `office_admin`
- `super_admin`

No rider or client finance access in the initial module.

### Editability

Records should be editable because this is an internal module.

Recommended safeguards:

- Keep `created_by`.
- Keep `updated_by` if practical.
- Add admin log entries for create, update, and delete.

No approval workflow is needed.

## Phase 9: Testing Plan

Add backend feature tests for:

- Office can create income category.
- Office can create expense category.
- Office can create income transaction.
- Office can create expense transaction.
- Office can edit finance transaction.
- Office can delete finance transaction.
- Client cannot access finance APIs.
- Rider cannot access finance APIs.
- Completed order increases rider cash held.
- Rider settlement decreases rider cash held.
- Rider settlement creates company income transaction.
- Partial rider settlement leaves correct balance.
- Finance summary calculates income, expense, and net profit correctly.
- Reports filter by date range.
- Reports filter by rider.
- Reports filter by client/customer.
- Reports filter by category.
- Reports filter by payment method.

## MVP Scope

The first useful version should include:

- Office-only finance routes
- Office-only finance page
- Dynamic income and expense categories
- Manual income and expense transactions
- Edit and delete transaction support
- Rider cash balance list
- Rider settlement form
- Settlement-generated company income
- Basic overview dashboard
- Basic date-range report
- Tests for core finance flows

## Recommended Build Order

1. Create finance category model, migration, controller, routes, and tests.
2. Create finance transaction model, migration, controller, routes, and tests.
3. Add finance transaction filters and summary API.
4. Extend rider settlement flow to create company income.
5. Add rider cash balance report endpoint.
6. Build office Finance UI tabs.
7. Add report filters by date, rider, client, order, category, and payment method.
8. Add manual rider commission expense support.
9. Add optional commission rules later.
10. Polish edit logs and adjustment handling.

## Future Enhancements

- Export reports to CSV or Excel.
- Printable settlement receipt.
- PDF reports.
- Per-rider commission rules.
- Per-client monthly summary.
- Cash drawer tracking.
- Bank account tracking.
- Finance adjustment workflow.
- Optional approval flow for larger expenses.
