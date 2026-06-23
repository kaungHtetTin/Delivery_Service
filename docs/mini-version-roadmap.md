# FlowDrop Delivery Mini Version Roadmap

## Goal

Finish the first usable mini version of FlowDrop Delivery without realtime websocket tracking. This version should support the normal daily operating flow: client request, office review and assignment, rider delivery progress, final fee collection, and basic office reporting.

## Release Scope

The mini version focuses on stable manual operations. Realtime updates, live maps, rider recommendation, and advanced accounting can be implemented after this release.

## 1. System Setup

### Required

- Confirm fresh migration works from an empty database.
- Confirm seeding creates only:
  - system settings
  - super admin / office account
  - rider accounts
  - client accounts
- Confirm no unwanted demo orders, payments, customers, shops, or cash collections are seeded.
- Update `.env.example` with the expected local database settings.
- Use MySQL for local development and automated tests.
- Document default login accounts in `README.md`.

### Acceptance Check

- `php artisan migrate:fresh --seed` works.
- Office, rider, and client demo accounts can log in.

## 2. Authentication and Roles

### Required

- Client can register and log in.
- Rider can log in with a seeded rider account.
- Office admin / super admin can log in.
- Wrong-role portal access shows a clear message.
- Logout works from available account/logout screens.

### Acceptance Check

- Client account cannot access office/rider features.
- Rider account cannot access office management.
- Office account can access admin tools.

## 3. Client Portal

### Required

- Client can create a delivery request.
- Client can edit their own pending order.
- Client can delete their own pending order.
- Client cannot edit/delete after office review starts.
- Delivery fee payment method only shows:
  - Cash
  - Banking
- COD toggle appears on the payment method step.
- Final review clearly shows:
  - pickup details
  - delivery details
  - product details
  - delivery fee payment method
  - COD on/off
- Tracking page shows current order status clearly.

### Acceptance Check

- A client can submit an order and see it in their delivery list.
- Pending order edit saves correctly.
- Pending order delete removes the order.
- Approved or assigned orders cannot be edited or deleted by the client.

## 4. Office Portal

### Required

- Office can view all delivery orders.
- Office can search/filter orders by status, fee status, rider, and text search.
- Office can open order detail drawer.
- Order detail drawer clearly shows:
  - order creator
  - contacts
  - package and payment details
  - Product COD on/off
  - rider assignment
  - delivery fee collection section
- Office can edit order details.
- Office can delete orders.
- Office can assign or change rider.
- Office can record or update delivery fee collection.
- Office can confirm collection.
- Client/source badge in delivery tables is compact and readable.

### Acceptance Check

- Office can assign an available rider to a pending/approved order.
- Assigned order appears in rider portal.
- Office can see COD status before assignment.
- Office can update cash collection after delivery completion.

## 5. Rider Portal

### Required

- Rider sees assigned active jobs.
- Rider can open assigned job detail.
- Rider can progress through delivery workflow.
- COD remark is highlighted when Product COD is on.
- Complete Delivery flow asks for final delivery fee.
- Final delivery fee input is styled and readable.
- After final delivery fee submit:
  - order is completed
  - rider leaves the active job detail
  - rider is navigated to Job History
- Completed jobs appear in history.

### Acceptance Check

- Rider can complete an assigned delivery from start to finish.
- Completion creates/updates delivery fee and cash collection data.
- Rider is not left stuck on the completed active-job screen.

## 6. Cash Collection

### Required

- Delivery fee collected by rider is recorded.
- Rider cash held is updated when applicable.
- Office can see collection records.
- Office can edit collection amount or note.
- Office can mark collection as confirmed.

### Acceptance Check

- Completed delivery with fee creates a cash collection record.
- Office reports and cash collection views reflect the collected amount.

## 7. Basic Reports

### Required

- Show summary of:
  - total orders
  - active orders
  - completed orders
  - failed orders
  - cancelled orders
  - pending/paid/rejected payments
  - cash collected
  - rider activity
- Reports may stay simple for this release.
- Export can remain placeholder unless it is implemented fully.

### Acceptance Check

- Report summary loads without errors.
- Counts update after order completion.

## 8. UI Cleanup

### Required

- Remove or hide unfinished controls that look complete but do nothing.
- Make placeholder map/GPS areas clearly non-realtime.
- Ensure mobile sticky action buttons are not covered by bottom navigation.
- Ensure modals do not frame out.
- Ensure table badges, status pills, and form controls are visually consistent.
- Check office, client, and rider screens at common desktop and mobile widths.

### Acceptance Check

- No major form action is blocked by navigation or layout.
- Main tables do not visually break with normal data.
- Assignment modal search input stays inside the modal frame.

## 9. Documentation

### Required

- Update `README.md` with:
  - setup steps
  - migration/seed command
  - dev server commands
  - default account list
  - current feature scope
- Document that websocket/realtime tracking is future scope.
- Document known limitations for the mini version.

### Acceptance Check

- A new developer can run the app locally from README instructions.

## 10. Verification

### Required Commands

```powershell
php artisan test
npm run build
```

### Optional Fresh Install Check

```powershell
php artisan migrate:fresh --seed
php artisan serve
npm run dev
```

### Acceptance Check

- All tests pass.
- Frontend build succeeds.
- Fresh seeded environment can complete the mini-version workflow.

## Out of Scope for Mini Version

- WebSocket / realtime order updates
- Live rider location streaming
- Map provider integration
- Automatic rider assignment
- Rider recommendation engine
- Distance-based delivery fee calculation
- Branch management
- Zone pricing
- Push notifications
- SMS/email notifications
- Advanced accounting and settlement reports
- Full PWA/mobile app packaging

## Suggested Finish Order

1. Verify fresh migration and seed flow.
2. Finalize client create/edit/delete order flow.
3. Finalize office order detail, assignment, and collection flow.
4. Finalize rider workflow and completion navigation.
5. Clean placeholder UI and table/modal layout issues.
6. Update README and known limitations.
7. Run full test/build verification.
8. Do one complete manual workflow:
   - client creates order
   - office assigns rider
   - rider completes order
   - office confirms collection
   - reports update
