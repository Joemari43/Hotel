# Harborview Hotel Booking

Modern, email-verified hotel booking experience that requires no user registration. Guests enter their stay details, confirm a six-digit code sent to their inbox, secure the down payment, and receive a confirmed reservation in minutes.

## Features

- Streamlined booking without creating an account.
- Required verification code delivered by email to block fake reservations.
- Microsoft SQL Server persistence so you can manage data through SSMS.
- Duplicate booking protection per email and overlapping date range.
- Immersive Harborview Hotel landing page that introduces experiences and perks.
- Automated in-room dining and amenity ordering with instant routing to service teams.
- Housekeeping & maintenance tracker so staff can monitor cleaning rounds, maintenance tickets, and room readiness in real time.
- Dedicated rooms showcase page to review amenities before booking.
- PHP down-payment capture with GCash, PayMaya, or credit card references before confirmation.
- Optional live GCash checkout links powered by PayMongo.
- Responsive, polished frontend served by the Node.js backend.

## Prerequisites

- Node.js 18 or newer.
- Access to a Microsoft SQL Server instance (Express, Developer, or higher).
- SMTP credentials (optional for development, required for production email delivery).

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Provision SQL Server objects**

   - Create a SQL Server login and database (or reuse existing ones).
   - Optionally run the schema script via SSMS:

     ```sql
     -- sql/schema.sql
     ```

     The server also runs the same script automatically on startup, so running it manually is optional.

3. **Configure environment variables**

   Create a `.env` file (or use another secrets manager) with the following keys:

   ```ini
   PORT=3000
   MINIMUM_DEPOSIT=2000
   PAYMONGO_SECRET_KEY=sk_test_yourSecretKey

   # Option A: discrete SQL Server settings
   SQL_SERVER=localhost
   SQL_PORT=1433
   SQL_DATABASE=HarborviewBookings
   SQL_USER=sa
   SQL_PASSWORD=yourStrong(!)Password

   # Option B: single connection string (overrides option A when set)
   # SQL_CONNECTION_STRING=Server=localhost;Database=HarborviewBookings;User Id=sa;Password=yourStrong(!)Password;TrustServerCertificate=true;

   SQL_ENCRYPT=false
   SQL_TRUST_CERT=true
   SQL_POOL_MAX=10
   # SQL_DOMAIN=MYDOMAIN
   # SQL_AUTH_TYPE=ntlm

   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey@example.com
   SMTP_PASS=super-secret-password
   SMTP_FROM="Harborview Hotel <reservations@example.com>"
   RESTAURANT_EMAIL=orders@example.com
   SERVICE_DESK_EMAIL=concierge@example.com
   HOUSEKEEPING_EMAIL=housekeeping@example.com
   ENGINEERING_EMAIL=engineering@example.com
   SPA_EMAIL=spa@example.com

   # Optional admin credentials for automated schema migrations
   # SQL_ADMIN_CONNECTION_STRING=Server=localhost;Database=HarborviewBookings;User Id=sa;Password=StrongPassword;TrustServerCertificate=true;
   # SQL_ADMIN_USER=sa
   # SQL_ADMIN_PASSWORD=AnotherStrongPassword
   ```

   If you provide the optional admin credentials above, the server will automatically run schema migrations with elevated permissions whenever the regular login lacks CREATE/ALTER rights. Otherwise, run sql/schema.sql manually as described in the SQL Server permissions section.

   The department email settings determine where new food, housekeeping, and amenity orders are emailed. Provide only the addresses you use in daily operations—the server automatically falls back to `SERVICE_DESK_EMAIL` or `RESTAURANT_EMAIL` when a specific department address is missing.

   > If SMTP credentials are omitted, the server logs verification codes to the console so you can test end-to-end without sending real mail.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 to explore the Harborview landing page, or jump straight to the booking form at http://localhost:3000/book#booking. Verification codes and reservations are stored in SQL Server.

## Automated GitHub Deployment

Use the helper to stage, commit, and push in one step:

```bash
npm run deploy:github -- "feat: describe the work you are publishing"
```

- If you omit the message, the script falls back to `chore: deploy <timestamp>`.
- It aborts gracefully when no changes are detected or when the `origin` remote is missing.
- Embedded Git repositories (for example, a nested project that has its own `.git` folder) are detected and must be ignored or converted to submodules before the script proceeds.
- Under the hood it runs `git add --all`, `git commit -m "<message>"`, and `git push origin HEAD`, so make sure any sensitive files (like `.env`) stay excluded via `.gitignore` first.

### Render auto-deploy workflow

The repo also defines `.github/workflows/render-deploy.yml`, which:

- Runs on every push to `main` (and can be triggered manually via GitHub’s “Run workflow” button).
- Executes `npm ci` and `npm test` before deploying, so the Render build is only triggered when dependencies install cleanly and the test command passes. Feel free to swap out the `npm test` step for your preferred checks.
- Hits the Render deploy hook URL stored in the `RENDER_DEPLOY_HOOK` repository secret.

To enable it:

1. In Render → Service → **Settings → Deploy Hook**, copy the hook URL.
2. In your GitHub repo → **Settings → Secrets and variables → Actions**, create a new secret named `RENDER_DEPLOY_HOOK` with that URL.
3. Push to `main` (or run the workflow manually). Passing CI automatically triggers a fresh Render deploy.

## GitHub Pages for the Static Frontend

GitHub Pages can host the HTML/CSS/JS bundle in `public/` so you have an instantly shareable preview:

1. **Mirror `public/` into `docs/`**

   ```bash
   npm run pages:sync
   ```

   This script recreates the `docs/` directory with the latest static files.

2. **Commit and push**

   ```bash
   git add docs package.json package-lock.json scripts/sync-public-to-docs.js
   git commit -m "Update docs folder for GitHub Pages"
   git push origin main
   ```

3. **Enable Pages**
   - On GitHub open **Settings → Pages**.
   - Choose the `main` branch and the `/docs` folder, then save.
   - GitHub prints the public URL (usually `https://<username>.github.io/<repo>/`) once the build finishes.

4. **Browse the static portal**
   - All landing pages, menu previews, and the booking form now load globally from GitHub’s CDN.
   - API calls still point to `/api/...`, so host the backend separately (Render/Railway/etc.) and, if needed, update fetch URLs or put the backend behind the same domain via reverse proxy.

Whenever you change anything under `public/`, run `npm run pages:sync` again and commit the updated `docs/` contents so GitHub Pages stays current.

### Automated GitHub Pages publishing

If you prefer CI to handle publishing, keep the new workflow `.github/workflows/pages-deploy.yml` enabled. On every push to `main` that touches `public/`, `docs/`, or the sync script, it:

1. Checks out the repo and installs dependencies with `npm ci`.
2. Runs `npm run pages:sync` so `docs/` is rebuilt in the workflow runner.
3. Uploads `docs/` as a Pages artifact and deploys it via `actions/deploy-pages`.

Because Pages pulls the artifact straight from CI, you don’t have to commit `docs/` for publishing—only when you need a local preview. The workflow uses Node.js 18; adjust the version or trigger paths to match your process.

## Hosting the Node/Express Backend (Render example)

1. **Rotate secrets locally**
   - Generate fresh credentials for SQL Server, JWT secret, SMTP, and default staff logins.
   - Update `.env` with the new values (never commit this file).

2. **Push sanitized code**

   ```bash
   git status   # should show no secrets
   git push origin main
   ```

3. **Create the Render service**
   - Render dashboard → *New → Web Service* → pick this GitHub repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Select the closest region to your SQL Server or your users.

4. **Configure environment variables**
   - In the Render service settings, add every key from your local `.env` (SQL credentials, SMTP, JWT, default passwords, PayMongo keys, etc.).
   - Use the rotated secrets you created in step 1.

5. **Ensure database connectivity**
   - Allow Render’s outbound IP through your SQL Server firewall **or** migrate SQL Server to a host Render can reach.
   - Update `SQL_SERVER`, `SQL_PORT`, or `SQL_CONNECTION_STRING` accordingly.

6. **Deploy and verify**
   - Trigger a deploy from the Render dashboard.
   - Hit the health endpoint (e.g., `https://<your-service>.onrender.com/health`) to confirm it is running.
   - Point your static frontend (GitHub Pages or any other host) to the new backend URL.

You can replicate the same process on Railway, Fly.io, Azure App Service, etc.—the critical pieces are an updated `.env`, a `npm start` entry point, and reachable SQL Server networking.

## Sample Data

- Populate demo reservations and verification codes with `npm run seed`. The script removes prior `SAMPLE-*` records before inserting fresh data so it is safe to run repeatedly.
- The seed uses the same SQL credentials as the app. Confirm `.env` is configured before running it.
- The generated dataset includes bookings within the last 24 hours, last 7/30 days, and older seasonal stays so the owner dashboard’s Daily/Weekly/Monthly/Yearly sales toggles each display different totals out of the box.

## Room Inventory Management

- Room types are stored in `dbo.room_types`. On startup the server seeds the defaults from `.env` (Deluxe King, Twin Suite, etc.) and keeps them in sync when the env numbers change.

## Automated Service Orders

- Guests can place food, beverage, housekeeping, and amenity requests from the new `/order` page. No login is required—only their contact details and the requested items.
- Each submission is stored in `dbo.service_orders` with an auto-generated order code and routed to the department email configured in `.env`. Missing targets fall back to `SERVICE_DESK_EMAIL` and then `RESTAURANT_EMAIL`.
- In-room dining (`orderType: food`) now verifies that the provided email and room code belong to a checked-in reservation before the service team is notified.
- Staff and owners manage these requests under **Service requests** in the admin portal. Filters let you focus on active orders, and quick actions acknowledge, mark in progress, complete, cancel, or reopen an order.
- The API is open for integrations:

  ```http
  POST /api/orders
  Content-Type: application/json

  {
    "fullName": "Lara Dela Cruz",
    "email": "lara@example.com",
    "phone": "+63 917 000 0000",
    "roomNumber": "1203",
    "orderType": "food",          // food | amenity | housekeeping | maintenance | spa | other
    "items": [
      { "name": "Club Sandwich", "quantity": 2, "notes": "No onions" },
      { "name": "Chamomile tea" }
    ],
    "specialInstructions": "Please deliver before 9:30 PM",
    "requestedFor": "2025-02-12T13:30"
  }
  ```

  - `GET /api/orders?status=pending&department=restaurant` returns filtered lists (staff/owner auth required).
  - `PATCH /api/orders/:id` accepts `{ "status": "acknowledged" }`, `{ "status": "in_progress" }`, `{ "status": "completed" }`, `{ "status": "cancelled" }`, or `{ "status": "pending" }` to reopen.

- When SMTP credentials are disabled, the server logs service-order notifications to the console just like verification codes, so you can test the workflow without sending real mail.
- Owners can create or rename room types with `POST /api/room-types`; both owners and staff can adjust the room count with `PATCH /api/room-types/:id` (either by supplying a new total or a `deltaRooms` value).
- Availability calculations now read from the room types table, so the admin dashboard always reflects the latest inventory without code changes.
- Sales aggregates are cached in `dbo.sales_summary`; they refresh on startup and anytime a booking is captured or checked out, powering the dashboard’s Daily/Weekly/Monthly/Yearly cards without heavy queries.
- The Admin portal now includes a **Room management** card for staff/owners—add new room types or review the current list without leaving the dashboard.
- Advanced rate rules live in `dbo.room_rate_rules`. Owners can manage them via:
  - `GET /api/room-types/:id/rates` – list active (or all) rules for a room type.
  - `POST /api/room-types/:id/rates` – create a new flat or percentage adjustment with date windows and stay constraints.
  - `PATCH /api/room-types/:roomTypeId/rates/:rateRuleId` – update, activate, or deactivate a rate rule.
  - `DELETE /api/room-types/:roomTypeId/rates/:rateRuleId` – remove a rule entirely.
  - `POST /api/rates/quote` – compute a full quote for a stay (room name or ID + check-in/check-out) factoring in all matching promotions.

## Guest Profiles & History

- Every confirmed booking now upserts a record in `dbo.guest_profiles`, links the reservation through `guest_id`, and recalculates total stays, nights, spend, and last stay date.
- Profiles capture contact details, preferred room type, marketing consent, VIP tier, notes, and a JSON blob for bespoke preferences (celebrations, pillow choices, dietary needs, etc.).
- Staff and owners can manage guests through:
  - `GET /api/guests` - list profiles with optional `search`, `marketingOptIn`, and `vipStatus` filters plus next expected stay.
  - `POST /api/guests` - create a profile manually for marketing campaigns or concierge prep.
  - `GET /api/guests/:id` - fetch the profile, full booking history, and upcoming stays.
  - `PUT /api/guests/:id` - update contact info, marketing consent, VIP tier, notes, or preference JSON.
- Migrations automatically backfill existing bookings into the new table, so historical guests appear immediately after upgrading.

## Booking Flow

1. Guest supplies contact information, stay dates, guest count, and room type.
2. Click **Send Code** to receive a one-time PIN by email.
3. Pay the PHP down payment via GCash, PayMaya, or credit card and supply the reference details.
4. Enter the six-digit code and submit the form to finalize the booking.

The backend expires codes after 10 minutes, marks them as used after a successful booking, and blocks overlapping stays for the same email address.

## GCash Integration

GCash checkout links are generated through [PayMongo](https://paymongo.com/). To enable the integration:

1. Create a PayMongo account and retrieve your secret key (sk_test_... or sk_live_...).
2. Add the key to .env as PAYMONGO_SECRET_KEY.
3. Restart the server. The booking form will display a *Generate GCash Payment Link* button that opens a PayMongo-hosted checkout page and auto-fills the reference number when available.

If the key is omitted, guests can still pay via GCash manually and supply the reference number in the form.

## Staff & Owner Portal

1. Set the following environment variables:
   - `JWT_SECRET` (a long random string).
   - `STAFF_USERNAME` / `STAFF_DEFAULT_PASSWORD` for team members.
   - `CASHIER_USERNAME` / `CASHIER_DEFAULT_PASSWORD` for the billing/cashier desk.
   - `RESTAURANT_USERNAME` / `RESTAURANT_DEFAULT_PASSWORD` for the food & beverage team to manage dining orders.
   - `HOUSEKEEPING_USERNAME` / `HOUSEKEEPING_DEFAULT_PASSWORD` for the housekeeping crew.
   - `MAINTENANCE_USERNAME` / `MAINTENANCE_DEFAULT_PASSWORD` for the maintenance & engineering crew.
   - `OWNER_USERNAME` / `OWNER_DEFAULT_PASSWORD` for the owner account.
2. Restart the server so default accounts are created with the provided passwords. Existing passwords are preserved on subsequent restarts; set `FORCE_RESET_DEFAULT_CREDENTIALS=true` if you explicitly want to overwrite them with the environment values.
3. Visit `/admin` and sign in. Staff can record walk-in bookings, review reservations, and mark departures. Owners see the same tools plus an overview card with live metrics.
   - Restaurant users land directly on the Service Requests card with the department filter locked to “Restaurant”, so they can acknowledge, progress, and complete in-room dining orders without touching reservations.

Passwords stored in the environment are used solely for bootstrapping; after login, tokens are issued via JWT and expire after 8 hours.


### SQL Server permissions

Harborview performs light auto-migrations on startup (creating tables, adding columns). The SQL login used by the app must have permission to CREATE TABLE and ALTER objects in the dbo schema. If you prefer to keep the login read/write only (or cannot grant those permissions), either supply admin credentials via SQL_ADMIN_* variables so the app can run migrations automatically, or run the script manually as shown below.

1. Run sql/schema.sql in SSMS while connected as a privileged user (e.g., sa or a db_owner member).
2. Grant rights to the app login:

   ```sql
   USE HarborviewBookings;
   EXEC sp_addrolemember 'db_datareader', 'clinicms_app';
   EXEC sp_addrolemember 'db_datawriter', 'clinicms_app';
   GRANT CREATE TABLE, ALTER ON SCHEMA::dbo TO clinicms_app;
   ```
3. Restart the server. Auto-migration will detect that the schema already exists and proceed without needing elevated permissions.

## Project Structure

```
public/
  hotel.html    # Promotional landing page for Harborview Hotel
  index.html    # Booking flow
  rooms.html    # Room catalogue
  styles.css
  app.js
src/server.js      # Express server and API routes
sql/schema.sql     # Optional SSMS schema script
package.json
.env.example
README.md
```

## Production Considerations

- Enforce HTTPS (via reverse proxy) and configure SMTP for reliable code delivery.
- Apply rate limiting such as express-rate-limit to the verification endpoint.
- Monitor bookings table and integrate with your PMS or CRM as needed.
- Add an authenticated admin dashboard for managing upcoming stays.

## License

This project is provided as-is without any warranty. Adapt it for your lodging business.















