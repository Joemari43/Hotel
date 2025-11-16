const express = require('express');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const dotenv = require('dotenv');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;

const { connectionConfig, connectionLabel } = buildSqlConfig();
const connectionPool = new sql.ConnectionPool(connectionConfig);
const poolConnect = connectionPool
  .connect()
  .then(async (pool) => {
    console.log(`Connected to SQL Server ${connectionLabel}`);
    await ensureTables(pool);
    await verifyRequiredTables(pool);
    await ensureRoomTypes(pool);
    await ensureDefaultUsers(pool);
    await refreshSalesSummaryCache(pool);
    return pool;
  })
  .catch((error) => {
    console.error('Failed to connect to SQL Server', error);
    process.exit(1);
  });

const transporter = createTransporter();

app.use(cors());
app.use(express.json());
app.use(
  express.static(path.join(ROOT_DIR, '..', 'public'), {
    index: false,
  })
);

const MINIMUM_DEPOSIT =
  Number.isNaN(Number(process.env.MINIMUM_DEPOSIT))
    ? 2000
    : Number(process.env.MINIMUM_DEPOSIT);

const DEFAULT_ROOM_TYPES = [
  {
    name: 'Deluxe King',
    totalRooms: Number(process.env.ROOMS_DELUXE_KING || 10),
    baseRate: 9200,
    sleeps: 2,
    brochureUrl: 'Choose skyline elegance, artisan coffee, and a copper tub.',
    imageUrl:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    description: 'Spacious king room with premium bedding and city skyline view.',
  },
  {
    name: 'Twin Suite',
    totalRooms: Number(process.env.ROOMS_TWIN_SUITE || 8),
    baseRate: 8400,
    sleeps: 3,
    brochureUrl: 'Modular lounge seating and bay-facing workspace for small crews.',
    imageUrl:
      'https://images.unsplash.com/photo-1562790351-d273a961e0e9?auto=format&fit=crop&w=1200&q=80',
    description: 'Flexible twin-bed suite perfect for friends or small families.',
  },
  {
    name: 'Ocean View Loft',
    totalRooms: Number(process.env.ROOMS_OCEAN_VIEW_LOFT || 4),
    baseRate: 12500,
    sleeps: 4,
    brochureUrl: 'Floating staircase loft with wraparound terrace and espresso bar.',
    imageUrl:
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
    description: 'Two-story loft overlooking the bay with private balcony.',
  },
  {
    name: 'Garden Retreat',
    totalRooms: Number(process.env.ROOMS_GARDEN_RETREAT || 6),
    baseRate: 7800,
    sleeps: 2,
    brochureUrl: 'Fern-filled courtyard, slow mornings on the daybed, spa turn-down.',
    imageUrl:
      'https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1200&q=80',
    description: 'Serene garden-level room surrounded by lush greenery.',
  },
];

const SALES_PERIODS = [
  { key: 'daily', label: 'Daily', shift: { hours: 24 } },
  { key: 'weekly', label: 'Weekly', shift: { days: 7 } },
  { key: 'monthly', label: 'Monthly', shift: { months: 1 } },
  { key: 'yearly', label: 'Yearly', shift: { years: 1 } },
];
const SALES_PERIOD_KEYS = new Set(SALES_PERIODS.map((period) => period.key));

const ORDER_TYPES = new Set(['food', 'amenity', 'housekeeping', 'maintenance', 'spa', 'other']);
const ORDER_STATUSES = new Set(['pending', 'acknowledged', 'in_progress', 'completed', 'cancelled']);
const ORDER_ACTIVE_STATUSES = new Set(['pending', 'acknowledged', 'in_progress']);
const ORDER_ACK_STATUSES = new Set(['acknowledged', 'in_progress', 'completed']);
const ORDER_FINAL_STATUSES = new Set(['completed', 'cancelled']);
const ORDER_DEPARTMENT_DEFAULTS = {
  food: 'restaurant',
  amenity: 'guest_services',
  housekeeping: 'housekeeping',
  maintenance: 'engineering',
  spa: 'spa',
  other: 'guest_services',
};
const ORDER_DEPARTMENT_EMAILS = {
  restaurant: (process.env.RESTAURANT_EMAIL || '').trim() || null,
  guest_services: (process.env.SERVICE_DESK_EMAIL || process.env.RESTAURANT_EMAIL || '').trim() || null,
  housekeeping: (process.env.HOUSEKEEPING_EMAIL || process.env.SERVICE_DESK_EMAIL || '').trim() || null,
  engineering: (process.env.ENGINEERING_EMAIL || process.env.SERVICE_DESK_EMAIL || '').trim() || null,
  spa: (process.env.SPA_EMAIL || process.env.SERVICE_DESK_EMAIL || '').trim() || null,
};
const ORDER_CODE_LENGTH = 10;
const MAX_ROOM_NUMBER_LENGTH = 20;
const SERVICE_TEAM_DEPARTMENTS = new Set(['housekeeping', 'engineering']);
const SERVICE_TEAM_ROLES = new Set(['housekeeping', 'maintenance']);

const SERVICE_TASK_TYPES = new Set(['housekeeping', 'maintenance']);
const SERVICE_TASK_STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'cancelled']);
const SERVICE_TASK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const ROOM_READINESS_STATES = new Set(['ready', 'dirty', 'inspection', 'out_of_service']);
const SERVICE_TASK_ACTIVE_STATUSES = new Set(['scheduled', 'in_progress']);

const ROOM_TYPES_CACHE_TTL_MS = 5 * 60 * 1000;
let roomTypesCache = { rows: null, timestamp: 0 };

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
if (JWT_SECRET === 'change-me-in-production') {
  console.warn('JWT_SECRET is using the default value. Set a strong secret in your environment.');
}

const STAFF_USERNAME = process.env.STAFF_USERNAME || 'staff';
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'owner';
const CASHIER_USERNAME = process.env.CASHIER_USERNAME || 'cashier';
const RESTAURANT_USERNAME = process.env.RESTAURANT_USERNAME || 'restaurant';
const HOUSEKEEPING_USERNAME = process.env.HOUSEKEEPING_USERNAME || 'housekeeping';
const MAINTENANCE_USERNAME = process.env.MAINTENANCE_USERNAME || 'maintenance';
const FORCE_RESET_DEFAULT_CREDENTIALS =
  String(process.env.FORCE_RESET_DEFAULT_CREDENTIALS || '')
    .trim()
    .toLowerCase() === 'true';

app.post('/api/verification/request-code', async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({ message: 'Full name, email, and phone are required.' });
    }

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    const lastRequestResult = await query(
      `SELECT TOP 1 created_at 
         FROM dbo.verification_codes 
        WHERE email = @email 
        ORDER BY created_at DESC`,
      [
        {
          name: 'email',
          type: sql.NVarChar(255),
          value: trimmedEmail,
        },
      ]
    );

    const lastRequest = lastRequestResult.recordset[0];
    if (lastRequest?.created_at) {
      const lastCreated = new Date(lastRequest.created_at);
      const secondsSinceLast = (Date.now() - lastCreated.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return res
          .status(429)
          .json({ message: 'Please wait a minute before requesting a new code.' });
      }
    }

    const verificationCode = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const insertResult = await query(
      `INSERT INTO dbo.verification_codes (email, phone, code, expires_at)
       OUTPUT INSERTED.id
       VALUES (@email, @phone, @code, @expires_at);`,
      [
        { name: 'email', type: sql.NVarChar(255), value: trimmedEmail },
        { name: 'phone', type: sql.NVarChar(50), value: trimmedPhone },
        { name: 'code', type: sql.VarChar(10), value: verificationCode },
        { name: 'expires_at', type: sql.DateTime2, value: expiresAt },
      ]
    );

    sendVerificationEmail(trimmedEmail, verificationCode, fullName).catch((error) => {
      console.warn('Unable to send verification email. Falling back to console log.', error);
      console.info(`Verification code for ${trimmedEmail}: ${verificationCode}`);
    });

    return res.json({
      message: 'Verification code sent. Please check your inbox.',
      verificationRequestId: insertResult.recordset[0]?.id ?? null,
    });
  } catch (error) {
    console.error('Failed to issue verification code', error);
    return res
      .status(500)
      .json({ message: 'Unable to issue verification code. Please try again.' });
  }
});

const ROLE_REDIRECTS = {
  owner: '/admin?role=owner#owner-overview',
  staff: '/admin?role=staff#reservations-section',
  cashier: '/admin?role=cashier#billing-management',
  restaurant: '/admin?role=restaurant#order-management',
  housekeeping: '/service-team#housekeeping',
  maintenance: '/service-team#maintenance',
};

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const pool = await poolConnect;
    const result = await pool
      .request()
      .input('username', sql.NVarChar(100), username.trim())
      .query(`SELECT TOP 1 id, username, password_hash, role FROM dbo.users WHERE username = @username`);

    const userRow = result.recordset[0];
    if (!userRow) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const validPassword = await bcrypt.compare(password, userRow.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const normalizedRole =
      typeof userRow.role === 'string' ? userRow.role.trim().toLowerCase() : '';
    const token = jwt.sign(
      { sub: userRow.id, username: userRow.username, role: normalizedRole || userRow.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      role: normalizedRole || userRow.role,
      username: userRow.username,
      redirect: ROLE_REDIRECTS[normalizedRole] || '/admin',
    });
  } catch (error) {
    console.error('Login failed', error);
    return res.status(500).json({ message: 'Unable to log in right now. Please try again.' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      roomType,
      specialRequests,
      verificationCode,
      paymentMethod,
      paymentReference,
      paymentAmount,
      preferences,
      marketingOptIn,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !checkIn ||
      !checkOut ||
      !guests ||
      !roomType ||
      !verificationCode ||
      !paymentMethod ||
      !paymentReference ||
      paymentAmount === undefined
    ) {
      return res.status(400).json({ message: 'Please supply all required booking details.' });
    }

    const parsedGuests = Number.parseInt(guests, 10);
    if (Number.isNaN(parsedGuests) || parsedGuests <= 0) {
      return res.status(400).json({ message: 'Guest count must be a positive number.' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ message: 'Invalid check-in or check-out date.' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ message: 'Check-out date must be after check-in date.' });
    }

    const allowedPaymentMethods = ['GCash', 'PayMaya', 'Credit Card'];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Select a supported payment method.' });
    }

    const trimmedReference = paymentReference.trim();
    if (trimmedReference.length < 6) {
      return res.status(400).json({ message: 'Enter a valid payment reference.' });
    }

    const parsedPaymentAmount = Number.parseFloat(paymentAmount);
    if (Number.isNaN(parsedPaymentAmount) || parsedPaymentAmount < MINIMUM_DEPOSIT) {
      return res
        .status(400)
        .json({ message: `Deposit must be at least PHP ${MINIMUM_DEPOSIT.toFixed(2)}.` });
    }

    const trimmedEmail = email.trim();
    const trimmedCode = verificationCode.trim();

    const marketingOptInResult = parseBooleanInput(marketingOptIn);
    if (marketingOptInResult.invalid) {
      return res.status(400).json({ message: 'Marketing opt-in must be true or false.' });
    }

    const preferencesResult = serializeGuestPreferencesInput(preferences);
    if (preferencesResult.error) {
      return res.status(400).json({ message: preferencesResult.error });
    }

    const verificationResult = await query(
      `SELECT TOP 1 *
         FROM dbo.verification_codes
        WHERE email = @email
          AND code = @code
        ORDER BY created_at DESC`,
      [
        { name: 'email', type: sql.NVarChar(255), value: trimmedEmail },
        { name: 'code', type: sql.VarChar(10), value: trimmedCode },
      ]
    );

    const verificationRow = verificationResult.recordset[0];
    if (!verificationRow) {
      return res.status(401).json({ message: 'Verification code is incorrect for this email.' });
    }

    const now = new Date();
    if (verificationRow.used) {
      return res.status(401).json({ message: 'Verification code has already been used.' });
    }
    if (now > new Date(verificationRow.expires_at)) {
      return res.status(401).json({ message: 'Verification code has expired.' });
    }

    const overlappingResult = await query(
      `SELECT TOP 1 id
         FROM dbo.bookings
        WHERE email = @email
          AND NOT (
            check_out <= @check_in
            OR check_in >= @check_out
          )`,
      [
        { name: 'email', type: sql.NVarChar(255), value: trimmedEmail },
        { name: 'check_in', type: sql.DateTime2, value: checkInDate },
        { name: 'check_out', type: sql.DateTime2, value: checkOutDate },
      ]
    );

    if (overlappingResult.recordset.length > 0) {
      return res.status(409).json({
        message:
          'You already have a confirmed booking that overlaps these dates. Please contact support to modify it.',
      });
    }

    const pool = await poolConnect;
    const trimmedRoomType = roomType.trim();
    const roomTypeRecord = await getRoomTypeByName(pool, trimmedRoomType);
    if (!roomTypeRecord) {
      return res
        .status(400)
        .json({ message: 'Unknown room type selected. Please choose an available room type.' });
    }

    const trimmedPhone = phone.trim();
    const guestProfilePayload = {
      fullName: fullName.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      preferredRoomType: trimmedRoomType,
    };
    if (marketingOptInResult.provided) {
      guestProfilePayload.marketingOptIn = marketingOptInResult.value;
    }
    if (preferencesResult.provided) {
      guestProfilePayload.preferences = preferencesResult.value;
    }

    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const { guestId } = await upsertGuestProfile(transaction, guestProfilePayload);

      const bookingRequest = new sql.Request(transaction);
      bookingRequest.input('full_name', sql.NVarChar(255), fullName.trim());
      bookingRequest.input('email', sql.NVarChar(255), trimmedEmail);
      bookingRequest.input('phone', sql.NVarChar(50), trimmedPhone);
      bookingRequest.input('check_in', sql.DateTime2, checkInDate);
      bookingRequest.input('check_out', sql.DateTime2, checkOutDate);
      bookingRequest.input('guests', sql.Int, parsedGuests);
      bookingRequest.input('room_type', sql.NVarChar(120), trimmedRoomType);
      bookingRequest.input(
        'special_requests',
        sql.NVarChar(sql.MAX),
        specialRequests?.trim() || null
      );
      bookingRequest.input('verification_code_id', sql.Int, verificationRow.id);
      bookingRequest.input('guest_id', sql.Int, guestId);
      bookingRequest.input('source', sql.NVarChar(20), 'online');
      bookingRequest.input('payment_method', sql.NVarChar(50), paymentMethod);
      bookingRequest.input(
        'payment_reference',
        sql.NVarChar(80),
        trimmedReference
      );
      bookingRequest.input('payment_amount', sql.Decimal(10, 2), parsedPaymentAmount);
      bookingRequest.input('payment_received', sql.Bit, 1);

      const bookingResult = await bookingRequest.query(
        `INSERT INTO dbo.bookings
          (full_name, email, phone, check_in, check_out, guests, room_type, special_requests, verification_code_id, guest_id, source, payment_method, payment_reference, payment_amount, payment_received)
         OUTPUT INSERTED.id
         VALUES (@full_name, @email, @phone, @check_in, @check_out, @guests, @room_type, @special_requests, @verification_code_id, @guest_id, @source, @payment_method, @payment_reference, @payment_amount, @payment_received);`
      );

      const markUsedRequest = new sql.Request(transaction);
      markUsedRequest.input('id', sql.Int, verificationRow.id);
      markUsedRequest.input('used_at', sql.DateTime2, new Date());
      const updateResult = await markUsedRequest.query(
        `UPDATE dbo.verification_codes
            SET used = 1,
                used_at = @used_at
          WHERE id = @id AND used = 0;`
      );

      if (updateResult.rowsAffected[0] !== 1) {
        await transaction.rollback();
        return res.status(401).json({ message: 'Verification code has already been used.' });
      }

      await recordGuestStay(transaction, {
        guestId,
        checkInDate,
        checkOutDate,
        paymentAmount: parsedPaymentAmount,
        preferredRoomType: trimmedRoomType,
      });

      await transaction.commit();

      await refreshSalesSummaryCache(pool).catch((summaryError) => {
        console.warn('Unable to refresh sales summary cache after booking creation.', summaryError);
      });

      return res.status(201).json({
        message: 'Booking confirmed. We look forward to your stay!',
        bookingId: bookingResult.recordset[0]?.id ?? null,
        guestId,
      });
    } catch (transactionError) {
      await transaction.rollback().catch(() => {});
      console.error('Failed to create booking (transaction)', transactionError);
      return res
        .status(500)
        .json({ message: 'Unable to create booking right now. Please retry.' });
    }
  } catch (error) {
    console.error('Failed to create booking', error);
    return res.status(500).json({ message: 'Unable to create booking right now. Please retry.' });
  }
});

app.get('/api/bookings', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const normalizedStart = normalizeDateOnly(startDate);
    if (startDate && !normalizedStart) {
      return res.status(400).json({ message: 'Invalid start date. Use YYYY-MM-DD.' });
    }

    const normalizedEnd = normalizeDateOnly(endDate);
    if (endDate && !normalizedEnd) {
      return res.status(400).json({ message: 'Invalid end date. Use YYYY-MM-DD.' });
    }

    if (normalizedStart && normalizedEnd) {
      const start = new Date(normalizedStart);
      const end = new Date(normalizedEnd);
      if (start > end) {
        return res.status(400).json({ message: 'Start date must be before end date.' });
      }
    }

    const filters = [];
    const parameters = [];

    if (normalizedStart) {
      filters.push('b.check_in >= CAST(@filterStart AS DATETIME2)');
      parameters.push({
        name: 'filterStart',
        type: sql.Date,
        value: normalizedStart,
      });
    }

    if (normalizedEnd) {
      filters.push('b.check_in < DATEADD(DAY, 1, CAST(@filterEnd AS DATETIME2))');
      parameters.push({
        name: 'filterEnd',
        type: sql.Date,
        value: normalizedEnd,
      });
    }

    if (req.query?.guestId !== undefined && req.query.guestId !== '') {
      const guestIdValue = Number.parseInt(req.query.guestId, 10);
      if (Number.isNaN(guestIdValue) || guestIdValue <= 0) {
        return res.status(400).json({ message: 'guestId must be a positive integer.' });
      }
      filters.push('b.guest_id = @guestId');
      parameters.push({
        name: 'guestId',
        type: sql.Int,
        value: guestIdValue,
      });
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query(
      `SELECT b.*, vc.code AS verification_code
         FROM dbo.bookings b
         LEFT JOIN dbo.verification_codes vc ON b.verification_code_id = vc.id
         ${whereClause}
         ORDER BY b.check_in DESC, b.created_at DESC`,
      parameters
    );

    return res.json(result.recordset.map(mapBookingRow));
  } catch (error) {
    console.error('Failed to load bookings for portal', error);
    return res.status(500).json({ message: 'Unable to load bookings right now.' });
  }
});

app.get('/api/room-types', authenticate, requireRole('staff', 'owner'), async (_req, res) => {
  try {
    const pool = await poolConnect;
    const roomTypes = await loadRoomTypes(pool);
    return res.json(roomTypes.map(formatRoomTypeResponse));
  } catch (error) {
    console.error('Failed to load room types', error);
    return res.status(500).json({ message: 'Unable to load room types right now.' });
  }
});

app.post('/api/room-types', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const { name, totalRooms, description, baseRate, sleeps, brochureUrl, imageUrl } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ message: 'Room type name must be at least 3 characters long.' });
    }

    const parsedTotalRooms = Number.parseInt(totalRooms, 10);
    if (Number.isNaN(parsedTotalRooms) || parsedTotalRooms <= 0) {
      return res.status(400).json({ message: 'Total rooms must be a positive integer.' });
    }

    let parsedBaseRate = null;
    if (baseRate !== undefined && baseRate !== null && baseRate !== '') {
      parsedBaseRate = Number(baseRate);
      if (Number.isNaN(parsedBaseRate) || parsedBaseRate < 0) {
        return res.status(400).json({ message: 'Base rate must be a non-negative number.' });
      }
    }

    let parsedSleeps = null;
    if (sleeps !== undefined && sleeps !== null && sleeps !== '') {
      parsedSleeps = Number.parseInt(sleeps, 10);
      if (Number.isNaN(parsedSleeps) || parsedSleeps <= 0) {
        return res.status(400).json({ message: 'Sleeps must be a positive integer.' });
      }
    }

    const pool = await poolConnect;
    const insert = pool.request();
    insert.input('name', sql.NVarChar(120), name.trim());
    insert.input('description', sql.NVarChar(500), description ? String(description).trim() : null);
    insert.input('total_rooms', sql.Int, parsedTotalRooms);
    insert.input('base_rate', sql.Decimal(10, 2), parsedBaseRate);
    insert.input('sleeps', sql.Int, parsedSleeps);
    insert.input('brochure_url', sql.NVarChar(500), brochureUrl ? String(brochureUrl).trim() : null);
    insert.input('image_url', sql.NVarChar(500), imageUrl ? String(imageUrl).trim() : null);

    const result = await insert.query(
      `INSERT INTO dbo.room_types (name, description, total_rooms, base_rate, sleeps, brochure_url, image_url)
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.total_rooms, INSERTED.base_rate, INSERTED.sleeps, INSERTED.brochure_url, INSERTED.image_url, INSERTED.created_at, INSERTED.updated_at
       VALUES (@name, @description, @total_rooms, @base_rate, @sleeps, @brochure_url, @image_url);`
    );

    invalidateRoomTypesCache();

    return res.status(201).json(formatRoomTypeResponse(mapRoomTypeRecord(result.recordset[0])));
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      return res.status(409).json({ message: 'A room type with that name already exists.' });
    }
    console.error('Failed to create room type', error);
    return res.status(500).json({ message: 'Unable to create room type right now.' });
  }
});

app.patch('/api/room-types/:id', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const roomTypeId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(roomTypeId)) {
      return res.status(400).json({ message: 'Invalid room type id.' });
    }

    const pool = await poolConnect;
    const existingResult = await pool
      .request()
      .input('id', sql.Int, roomTypeId)
      .query(
        `SELECT id, name, description, total_rooms, base_rate, sleeps, brochure_url, image_url, created_at, updated_at
           FROM dbo.room_types
          WHERE id = @id;`
      );

    const existingRow = existingResult.recordset[0];
    if (!existingRow) {
      return res.status(404).json({ message: 'Room type not found.' });
    }

    const current = mapRoomTypeRecord(existingRow);
    const isOwner = req.user?.role === 'owner';
    const updates = [];
    const request = pool.request().input('id', sql.Int, roomTypeId);

    const { totalRooms, deltaRooms, name, description, baseRate, sleeps, brochureUrl, imageUrl } = req.body || {};

    if (totalRooms !== undefined) {
      const parsedTotalRooms = Number.parseInt(totalRooms, 10);
      if (Number.isNaN(parsedTotalRooms) || parsedTotalRooms <= 0) {
        return res.status(400).json({ message: 'Total rooms must be a positive integer.' });
      }
      request.input('total_rooms', sql.Int, parsedTotalRooms);
      updates.push('total_rooms = @total_rooms');
    } else if (deltaRooms !== undefined) {
      const parsedDelta = Number.parseInt(deltaRooms, 10);
      if (Number.isNaN(parsedDelta) || parsedDelta === 0) {
        return res.status(400).json({ message: 'Room adjustment must be a non-zero integer.' });
      }
      const newTotal = current.totalRooms + parsedDelta;
      if (newTotal <= 0) {
        return res.status(400).json({ message: 'Resulting total rooms must remain positive.' });
      }
      request.input('total_rooms', sql.Int, newTotal);
      updates.push('total_rooms = @total_rooms');
    }

    if (isOwner && typeof name === 'string' && name.trim() && name.trim() !== current.name) {
      request.input('name', sql.NVarChar(120), name.trim());
      updates.push('name = @name');
    }

    if (isOwner && description !== undefined) {
      request.input('description', sql.NVarChar(500), description ? String(description).trim() : null);
      updates.push('description = @description');
    }

    if (isOwner && baseRate !== undefined) {
      const parsedBaseRate = baseRate === null || baseRate === '' ? null : Number(baseRate);
      if (parsedBaseRate !== null && (Number.isNaN(parsedBaseRate) || parsedBaseRate < 0)) {
        return res.status(400).json({ message: 'Base rate must be a non-negative number.' });
      }
      request.input('base_rate', sql.Decimal(10, 2), parsedBaseRate);
      updates.push('base_rate = @base_rate');
    }

    if (sleeps !== undefined) {
      const parsedSleeps = sleeps === null || sleeps === '' ? null : Number.parseInt(sleeps, 10);
      if (parsedSleeps !== null && (Number.isNaN(parsedSleeps) || parsedSleeps <= 0)) {
        return res.status(400).json({ message: 'Sleeps must be a positive integer.' });
      }
      request.input('sleeps', sql.Int, parsedSleeps);
      updates.push('sleeps = @sleeps');
    }

    if (isOwner && brochureUrl !== undefined) {
      request.input('brochure_url', sql.NVarChar(500), brochureUrl ? String(brochureUrl).trim() : null);
      updates.push('brochure_url = @brochure_url');
    }

    if (isOwner && imageUrl !== undefined) {
      request.input('image_url', sql.NVarChar(500), imageUrl ? String(imageUrl).trim() : null);
      updates.push('image_url = @image_url');
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid changes supplied.' });
    }

    updates.push('updated_at = SYSUTCDATETIME()');

    const updateResult = await request.query(
      `UPDATE dbo.room_types
          SET ${updates.join(', ')}
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.total_rooms, INSERTED.base_rate, INSERTED.sleeps, INSERTED.brochure_url, INSERTED.image_url, INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id;`
    );

    if (updateResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Room type not found.' });
    }

    invalidateRoomTypesCache();

    return res.json(formatRoomTypeResponse(mapRoomTypeRecord(updateResult.recordset[0])));
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      return res.status(409).json({ message: 'Another room type already uses that name.' });
    }
    console.error('Failed to update room type', error);
    return res.status(500).json({ message: 'Unable to update room type right now.' });
  }
});

app.get('/api/room-types/:id/rates', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const roomTypeId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(roomTypeId)) {
      return res.status(400).json({ message: 'Invalid room type id.' });
    }

    const pool = await poolConnect;
    const roomType = await getRoomTypeById(pool, roomTypeId);
    if (!roomType) {
      return res.status(404).json({ message: 'Room type not found.' });
    }

    const rules = await loadRateRulesForRoomType(pool, roomTypeId, {
      activeOnly: req.query.all !== 'true',
    });
    return res.json({
      roomType: formatRoomTypeResponse(roomType),
      rateRules: rules.map(formatRateRuleResponse),
    });
  } catch (error) {
    console.error('Failed to load room rate rules', error);
    return res.status(500).json({ message: 'Unable to load rate rules right now.' });
  }
});

app.post('/api/room-types/:id/rates', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const roomTypeId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(roomTypeId)) {
      return res.status(400).json({ message: 'Invalid room type id.' });
    }

    const pool = await poolConnect;
    const roomType = await getRoomTypeById(pool, roomTypeId);
    if (!roomType) {
      return res.status(404).json({ message: 'Room type not found.' });
    }

    const payload = req.body || {};
    const validationError = validateRateRulePayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const insert = pool.request();
    insert.input('room_type_id', sql.Int, roomTypeId);
    insert.input('name', sql.NVarChar(120), payload.name.trim());
    insert.input('description', sql.NVarChar(500), payload.description ? String(payload.description).trim() : null);
    insert.input('adjustment_type', sql.NVarChar(10), payload.adjustmentType);
    insert.input('adjustment_value', sql.Decimal(10, 2), Number(payload.adjustmentValue));
    insert.input('start_date', sql.Date, payload.startDate);
    insert.input('end_date', sql.Date, payload.endDate);
    insert.input('min_stay', sql.Int, payload.minStay != null ? Number(payload.minStay) : null);
    insert.input('max_stay', sql.Int, payload.maxStay != null ? Number(payload.maxStay) : null);
    insert.input('active', sql.Bit, payload.active === false ? 0 : 1);

    const result = await insert.query(
      `INSERT INTO dbo.room_rate_rules (room_type_id, name, description, adjustment_type, adjustment_value, start_date, end_date, min_stay, max_stay, active)
       OUTPUT INSERTED.id, INSERTED.room_type_id, INSERTED.name, INSERTED.description, INSERTED.adjustment_type,
              INSERTED.adjustment_value, INSERTED.start_date, INSERTED.end_date, INSERTED.min_stay, INSERTED.max_stay,
              INSERTED.active, INSERTED.created_at, INSERTED.updated_at
       VALUES (@room_type_id, @name, @description, @adjustment_type, @adjustment_value, @start_date, @end_date, @min_stay, @max_stay, @active);`
    );

    return res.status(201).json({
      roomType: formatRoomTypeResponse(roomType),
      rateRule: formatRateRuleResponse(mapRateRuleRecord(result.recordset[0])),
    });
  } catch (error) {
    console.error('Failed to create room rate rule', error);
    return res.status(500).json({ message: 'Unable to create room rate rule right now.' });
  }
});

app.patch(
  '/api/room-types/:roomTypeId/rates/:rateRuleId',
  authenticate,
  requireRole('owner'),
  async (req, res) => {
    try {
      const roomTypeId = Number.parseInt(req.params.roomTypeId, 10);
      const rateRuleId = Number.parseInt(req.params.rateRuleId, 10);
      if (Number.isNaN(roomTypeId) || Number.isNaN(rateRuleId)) {
        return res.status(400).json({ message: 'Invalid room type or rate rule id.' });
      }

      const pool = await poolConnect;
      const existing = await getRateRuleById(pool, roomTypeId, rateRuleId);
      if (!existing) {
        return res.status(404).json({ message: 'Rate rule not found.' });
      }

      const updates = [];
      const request = pool.request().input('id', sql.Int, rateRuleId);

      const { name, description, adjustmentType, adjustmentValue, startDate, endDate, minStay, maxStay, active } =
        req.body || {};

      if (name !== undefined) {
        if (!name || typeof name !== 'string' || name.trim().length < 3) {
          return res.status(400).json({ message: 'Rate rule name must be at least 3 characters.' });
        }
        request.input('name', sql.NVarChar(120), name.trim());
        updates.push('name = @name');
      }

      if (description !== undefined) {
        request.input('description', sql.NVarChar(500), description ? String(description).trim() : null);
        updates.push('description = @description');
      }

      if (adjustmentType !== undefined) {
        const normalizedType = String(adjustmentType).toLowerCase();
        if (!['flat', 'percent'].includes(normalizedType)) {
          return res.status(400).json({ message: 'Adjustment type must be "flat" or "percent".' });
        }
        request.input('adjustment_type', sql.NVarChar(10), normalizedType);
        updates.push('adjustment_type = @adjustment_type');
      }

      if (adjustmentValue !== undefined) {
        const parsedValue = Number(adjustmentValue);
        if (Number.isNaN(parsedValue)) {
          return res.status(400).json({ message: 'Adjustment value must be numeric.' });
        }
        request.input('adjustment_value', sql.Decimal(10, 2), parsedValue);
        updates.push('adjustment_value = @adjustment_value');
      }

      if (startDate !== undefined || endDate !== undefined) {
        const newStart =
          startDate !== undefined ? startDate : existing.startDate ? existing.startDate.toISOString().slice(0, 10) : null;
        const newEnd =
          endDate !== undefined ? endDate : existing.endDate ? existing.endDate.toISOString().slice(0, 10) : null;
        if (!newStart || !newEnd || newStart > newEnd) {
          return res.status(400).json({ message: 'Rate rule start date must be on or before end date.' });
        }
        request.input('start_date', sql.Date, newStart);
        request.input('end_date', sql.Date, newEnd);
        updates.push('start_date = @start_date');
        updates.push('end_date = @end_date');
      }

      if (minStay !== undefined) {
        const parsedMinStay = minStay === null || minStay === '' ? null : Number.parseInt(minStay, 10);
        if (parsedMinStay !== null && (Number.isNaN(parsedMinStay) || parsedMinStay < 0)) {
          return res.status(400).json({ message: 'Minimum stay must be a non-negative integer.' });
        }
        request.input('min_stay', sql.Int, parsedMinStay);
        updates.push('min_stay = @min_stay');
      }

      if (maxStay !== undefined) {
        const parsedMaxStay = maxStay === null || maxStay === '' ? null : Number.parseInt(maxStay, 10);
        if (parsedMaxStay !== null && (Number.isNaN(parsedMaxStay) || parsedMaxStay <= 0)) {
          return res.status(400).json({ message: 'Maximum stay must be a positive integer.' });
        }
        request.input('max_stay', sql.Int, parsedMaxStay);
        updates.push('max_stay = @max_stay');
      }

      const finalMin = minStay === undefined ? existing.minStay : minStay;
      const finalMax = maxStay === undefined ? existing.maxStay : maxStay;
      if (finalMin != null && finalMax != null && Number(finalMin) > Number(finalMax)) {
        return res.status(400).json({ message: 'Minimum stay cannot exceed maximum stay.' });
      }

      if (active !== undefined) {
        request.input('active', sql.Bit, active ? 1 : 0);
        updates.push('active = @active');
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid changes supplied.' });
      }

      updates.push('updated_at = SYSUTCDATETIME()');

      const updateResult = await request.query(
        `UPDATE dbo.room_rate_rules
            SET ${updates.join(', ')}
          OUTPUT INSERTED.id, INSERTED.room_type_id, INSERTED.name, INSERTED.description, INSERTED.adjustment_type,
                 INSERTED.adjustment_value, INSERTED.start_date, INSERTED.end_date, INSERTED.min_stay, INSERTED.max_stay,
                 INSERTED.active, INSERTED.created_at, INSERTED.updated_at
          WHERE id = @id;`
      );

      if (updateResult.recordset.length === 0) {
        return res.status(404).json({ message: 'Rate rule not found.' });
      }

      return res.json(formatRateRuleResponse(mapRateRuleRecord(updateResult.recordset[0])));
    } catch (error) {
      console.error('Failed to update room rate rule', error);
      return res.status(500).json({ message: 'Unable to update room rate rule right now.' });
    }
  }
);

app.delete(
  '/api/room-types/:roomTypeId/rates/:rateRuleId',
  authenticate,
  requireRole('owner'),
  async (req, res) => {
    try {
      const roomTypeId = Number.parseInt(req.params.roomTypeId, 10);
      const rateRuleId = Number.parseInt(req.params.rateRuleId, 10);
      if (Number.isNaN(roomTypeId) || Number.isNaN(rateRuleId)) {
        return res.status(400).json({ message: 'Invalid room type or rate rule id.' });
      }

      const pool = await poolConnect;
      const result = await pool
        .request()
        .input('id', sql.Int, rateRuleId)
        .input('room_type_id', sql.Int, roomTypeId)
        .query(
          `DELETE FROM dbo.room_rate_rules WHERE id = @id AND room_type_id = @room_type_id; SELECT @@ROWCOUNT AS affected;`
        );

      if ((result.recordset[0]?.affected ?? 0) === 0) {
        return res.status(404).json({ message: 'Rate rule not found.' });
      }

      return res.json({ message: 'Rate rule removed.' });
    } catch (error) {
      console.error('Failed to delete room rate rule', error);
      return res.status(500).json({ message: 'Unable to delete room rate rule right now.' });
    }
  }
);

app.post('/api/rates/quote', async (req, res) => {
  try {
    const { roomTypeId, roomType, checkIn, checkOut } = req.body || {};

    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: 'Check-in and check-out dates are required for a quote.' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ message: 'Invalid check-in or check-out date.' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ message: 'Check-out date must be after check-in date.' });
    }

    const pool = await poolConnect;
    let roomTypeRecord = null;
    if (roomTypeId != null) {
      roomTypeRecord = await getRoomTypeById(pool, roomTypeId);
    }
    if (!roomTypeRecord && roomType) {
      roomTypeRecord = await getRoomTypeByName(pool, roomType);
    }

    if (!roomTypeRecord) {
      return res.status(404).json({ message: 'Room type not found.' });
    }

    if (roomTypeRecord.baseRate == null) {
      return res.status(400).json({ message: 'Room type does not have a base rate configured yet.' });
    }

    const windowStart = checkInDate.toISOString().slice(0, 10);
    const windowEndDate = new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = windowEndDate.toISOString().slice(0, 10);

    const rateRules = await loadRateRulesForRoomType(pool, roomTypeRecord.id, {
      activeOnly: true,
      dateRange: { start: windowStart, end: windowEnd },
    });

    const quote = calculateRateQuote(roomTypeRecord, rateRules, checkInDate, checkOutDate);
    const appliedRules = rateRules
      .filter((rule) => quote.appliedRateRuleIds.includes(rule.id))
      .map(formatRateRuleResponse);

    return res.json({
      roomType: formatRoomTypeResponse(roomTypeRecord),
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      nights: quote.nights,
      baseRate: quote.baseRate,
      baseTotal: quote.baseTotal,
      total: quote.total,
      nightly: quote.nightly,
      appliedRules,
    });
  } catch (error) {
    console.error('Failed to build rate quote', error);
    return res.status(500).json({ message: 'Unable to calculate rate quote right now.' });
  }
});

app.get('/api/public/room-types', async (_req, res) => {
  try {
    const pool = await poolConnect;
    const roomTypes = await loadRoomTypes(pool);
    return res.json(roomTypes.map(formatRoomTypeResponse));
  } catch (error) {
    console.error('Failed to load public room types', error);
    return res.status(500).json({ message: 'Unable to load room types right now.' });
  }
});

app.post('/api/bookings/direct', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      roomType,
      specialRequests,
      paymentMethod,
      paymentReference,
      paymentAmount,
      preferences,
      marketingOptIn,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !checkIn ||
      !checkOut ||
      !guests ||
      !roomType ||
      !paymentMethod ||
      !paymentReference ||
      paymentAmount === undefined
    ) {
      return res.status(400).json({ message: 'All booking details and deposit information are required.' });
    }

    const parsedGuests = Number.parseInt(guests, 10);
    if (Number.isNaN(parsedGuests) || parsedGuests <= 0) {
      return res.status(400).json({ message: 'Guest count must be a positive number.' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ message: 'Invalid check-in or check-out date.' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ message: 'Check-out date must be after check-in date.' });
    }

    const depositAmount = Number.parseFloat(paymentAmount);
    if (Number.isNaN(depositAmount) || depositAmount < MINIMUM_DEPOSIT) {
      return res
        .status(400)
        .json({ message: `Deposit must be at least PHP ${MINIMUM_DEPOSIT.toFixed(2)}.` });
    }

    const marketingOptInResult = parseBooleanInput(marketingOptIn);
    if (marketingOptInResult.invalid) {
      return res.status(400).json({ message: 'Marketing opt-in must be true or false.' });
    }

    const preferencesResult = serializeGuestPreferencesInput(preferences);
    if (preferencesResult.error) {
      return res.status(400).json({ message: preferencesResult.error });
    }

    const normalizedMethod = String(paymentMethod).trim();
    if (!normalizedMethod) {
      return res.status(400).json({ message: 'Select a payment method.' });
    }

    const normalizedReference = String(paymentReference).trim();
    if (normalizedReference.length < 3) {
      return res.status(400).json({ message: 'Enter a valid payment reference.' });
    }

    const pool = await poolConnect;
    const trimmedRoomType = roomType.trim();
    const roomTypeRecord = await getRoomTypeByName(pool, trimmedRoomType);
    if (!roomTypeRecord) {
      return res
        .status(400)
        .json({ message: 'Unknown room type selected. Please choose an available room type.' });
    }

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const guestProfilePayload = {
      fullName: fullName.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      preferredRoomType: trimmedRoomType,
    };
    if (marketingOptInResult.provided) {
      guestProfilePayload.marketingOptIn = marketingOptInResult.value;
    }
    if (preferencesResult.provided) {
      guestProfilePayload.preferences = preferencesResult.value;
    }

    const transaction = new sql.Transaction(pool);
    let bookingId = null;
    let guestId = null;

    try {
      await transaction.begin();

      const upsertResult = await upsertGuestProfile(transaction, guestProfilePayload);
      guestId = upsertResult.guestId;

      const bookingResult = await transaction
        .request()
        .input('full_name', sql.NVarChar(255), fullName.trim())
        .input('email', sql.NVarChar(255), trimmedEmail)
        .input('phone', sql.NVarChar(50), trimmedPhone)
        .input('check_in', sql.DateTime2, checkInDate)
        .input('check_out', sql.DateTime2, checkOutDate)
        .input('guests', sql.Int, parsedGuests)
        .input('room_type', sql.NVarChar(120), trimmedRoomType)
        .input('special_requests', sql.NVarChar(sql.MAX), specialRequests?.trim() || null)
        .input('source', sql.NVarChar(20), 'direct')
        .input('payment_method', sql.NVarChar(50), normalizedMethod)
        .input('payment_reference', sql.NVarChar(80), normalizedReference)
        .input('payment_amount', sql.Decimal(10, 2), depositAmount)
        .input('payment_received', sql.Bit, 1)
        .input('status', sql.NVarChar(20), 'confirmed')
        .input('guest_id', sql.Int, guestId)
        .query(
          `INSERT INTO dbo.bookings
             (full_name, email, phone, check_in, check_out, guests, room_type, special_requests,
              verification_code_id, guest_id, source, payment_method, payment_reference, payment_amount, payment_received, status)
           OUTPUT INSERTED.id
           VALUES
             (@full_name, @email, @phone, @check_in, @check_out, @guests, @room_type, @special_requests,
              NULL, @guest_id, @source, @payment_method, @payment_reference, @payment_amount, @payment_received, @status);`
        );

      bookingId = bookingResult.recordset[0]?.id ?? null;

      await recordGuestStay(transaction, {
        guestId,
        checkInDate,
        checkOutDate,
        paymentAmount: depositAmount,
        preferredRoomType: trimmedRoomType,
      });

      await transaction.commit();
    } catch (transactionError) {
      await transaction.rollback().catch(() => {});
      throw transactionError;
    }

    await refreshSalesSummaryCache(pool).catch((summaryError) => {
      console.warn('Unable to refresh sales summary cache after direct booking.', summaryError);
    });

    return res.status(201).json({
      message: 'Booking recorded successfully.',
      bookingId,
      guestId,
    });
  } catch (error) {
    console.error('Failed to create direct booking', error);
    return res
      .status(500)
      .json({ message: 'Unable to create direct booking right now. Please retry.' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      roomNumber,
      orderType,
      items,
      itemsSummary,
      itemsText,
      specialInstructions,
      requestedFor,
      targetDepartment,
    } = req.body || {};

    const trimmedName = typeof fullName === 'string' ? fullName.trim() : '';
    if (trimmedName.length < 2) {
      return res.status(400).json({ message: 'Guest name must be at least 2 characters long.' });
    }

    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return res.status(400).json({ message: 'A valid email address is required for service orders.' });
    }

    const normalizedType = typeof orderType === 'string' ? orderType.trim().toLowerCase() : '';
    if (!ORDER_TYPES.has(normalizedType)) {
      return res.status(400).json({
        message: 'orderType must be one of food, amenity, housekeeping, maintenance, spa, or other.',
      });
    }

    const fallbackItemsText =
      itemsSummary ?? itemsText ?? req.body?.customItems ?? req.body?.orderItems ?? null;

    let itemsPayload;
    try {
      itemsPayload = normalizeServiceOrderItems(items, fallbackItemsText);
    } catch (validationError) {
      return res.status(400).json({
        message: validationError?.message || 'Add at least one item to your request.',
      });
    }

    const normalizedDepartment = resolveTargetDepartment(normalizedType, targetDepartment);
    const requestedForDate = requestedFor ? parseOptionalDateTime(requestedFor) : null;
    if (requestedFor && !requestedForDate) {
      return res.status(400).json({ message: 'requestedFor must be a valid date/time.' });
    }

    const trimmedPhoneInput = typeof phone === 'string' ? phone.trim() : '';
    if (!trimmedPhoneInput) {
      return res.status(400).json({ message: 'Phone number is required for service requests.' });
    }
    const trimmedRoomInput = typeof roomNumber === 'string' ? roomNumber.trim() : '';
    if (!trimmedRoomInput) {
      return res.status(400).json({ message: 'Room number is required for service requests.' });
    }

    const trimmedPhone = trimmedPhoneInput.slice(0, 50);
    const trimmedRoom = trimmedRoomInput.slice(0, MAX_ROOM_NUMBER_LENGTH);
    const instructions =
      specialInstructions == null ? null : String(specialInstructions).trim() || null;
    if (instructions && instructions.length > 2000) {
      return res
        .status(400)
        .json({ message: 'Special instructions must be 2000 characters or less.' });
    }

    const pool = await poolConnect;

    if (normalizedType === 'food') {
      const verification = await pool
        .request()
        .input('order_email', sql.NVarChar(255), trimmedEmail)
        .input('order_room', sql.NVarChar(MAX_ROOM_NUMBER_LENGTH), trimmedRoom)
        .query(`
          SELECT TOP 1 id
            FROM dbo.bookings
           WHERE status = 'checked_in'
             AND room_number IS NOT NULL
             AND LOWER(email) = LOWER(@order_email)
             AND room_number = @order_room;
        `);

      if (!verification.recordset.length) {
        return res.status(403).json({
          message:
            'Room service dining is limited to checked-in guests. Please contact the front desk to confirm your stay.',
        });
      }
    }

    const orderCode = await generateUniqueOrderCode(pool);

    let guestId = null;
    try {
      const guestLookup = await pool
        .request()
        .input('email', sql.NVarChar(255), trimmedEmail)
        .query(`SELECT TOP 1 id FROM dbo.guest_profiles WHERE email = @email`);
      guestId = guestLookup.recordset[0]?.id ?? null;
    } catch (lookupError) {
      console.warn('Guest lookup for service order failed', lookupError);
    }

    let totalAmount = null;
    const providedTotal =
      req.body?.totalAmount ?? req.body?.estimatedTotal ?? req.body?.amount ?? req.body?.total;
    if (providedTotal !== undefined) {
      if (providedTotal === null || providedTotal === '') {
        totalAmount = null;
      } else {
        const numeric = Number.parseFloat(providedTotal);
        if (Number.isNaN(numeric) || numeric < 0) {
          return res.status(400).json({ message: 'totalAmount must be a non-negative number.' });
        }
        totalAmount = Math.round(numeric * 100) / 100;
      }
    }

    const insertRequest = pool
      .request()
      .input('order_code', sql.NVarChar(16), orderCode)
      .input('guest_id', sql.Int, guestId)
      .input('full_name', sql.NVarChar(255), trimmedName)
      .input('email', sql.NVarChar(255), trimmedEmail)
      .input('phone', sql.NVarChar(50), trimmedPhone)
      .input('room_number', sql.NVarChar(20), trimmedRoom)
      .input('order_type', sql.NVarChar(50), normalizedType)
      .input('target_department', sql.NVarChar(80), normalizedDepartment)
      .input('items', sql.NVarChar(sql.MAX), itemsPayload.json)
      .input('special_instructions', sql.NVarChar(sql.MAX), instructions)
      .input('requested_for', sql.DateTime2, requestedForDate)
      .input('total_amount', sql.Decimal(10, 2), totalAmount === null ? null : totalAmount);

    const insertResult = await insertRequest.query(`
      INSERT INTO dbo.service_orders
        (order_code, guest_id, full_name, email, phone, room_number, order_type, target_department, items, special_instructions, total_amount, status, requested_for)
      OUTPUT INSERTED.*
      VALUES (
        @order_code,
        @guest_id,
        @full_name,
        @email,
        @phone,
        @room_number,
        @order_type,
        @target_department,
        @items,
        @special_instructions,
        @total_amount,
        'pending',
        @requested_for
      );
    `);

    const insertedRow = insertResult.recordset[0];
    const order = mapServiceOrderRow(insertedRow);
    if (order) {
      order.itemsSummary = order.itemsSummary || itemsPayload.summary;
      await sendServiceOrderNotification(order).catch((notifyError) => {
        console.error('Failed to dispatch service order notification', notifyError);
      });
    }

    return res.status(201).json({
      message: 'Request received. Our team will reach out shortly.',
      orderId: order?.id ?? null,
      orderCode,
      targetDepartment: order?.targetDepartment ?? normalizedDepartment,
    });
  } catch (error) {
    console.error('Failed to create service order', error);
    return res
      .status(500)
      .json({ message: 'Unable to submit your request right now. Please contact the front desk.' });
  }
});

app.get(
  '/api/orders',
  authenticate,
  requireRole('staff', 'owner', 'restaurant', 'housekeeping', 'maintenance'),
  async (req, res) => {
  try {
    const pool = await poolConnect;
    const limit = Math.max(
      1,
      Math.min(200, Number.parseInt(req.query?.limit, 10) || 50)
    );

    const filters = [];
    const request = pool.request().input('limit', sql.Int, limit);

    const statusFilter =
      typeof req.query?.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    if (statusFilter) {
      if (statusFilter === 'active') {
        const activeStatusParams = Array.from(ORDER_ACTIVE_STATUSES).map((status, index) => {
          const paramName = `active_status_${index}`;
          request.input(paramName, sql.NVarChar(20), status);
          return `@${paramName}`;
        });
        filters.push(`o.status IN (${activeStatusParams.join(', ')})`);
      } else {
        if (!ORDER_STATUSES.has(statusFilter)) {
          return res.status(400).json({ message: 'Invalid status filter.' });
        }
        request.input('status', sql.NVarChar(20), statusFilter);
        filters.push('o.status = @status');
      }
    }

    const departmentFilter =
      typeof req.query?.department === 'string' ? req.query.department.trim().toLowerCase() : '';
    if (departmentFilter) {
      request.input('department', sql.NVarChar(80), departmentFilter);
      filters.push('o.target_department = @department');
    }

    const sinceDate = req.query?.since ? parseOptionalDateTime(req.query.since) : null;
    if (req.query?.since && !sinceDate) {
      return res.status(400).json({ message: 'since must be a valid ISO date/time.' });
    }
    if (sinceDate) {
      request.input('since', sql.DateTime2, sinceDate);
      filters.push('o.created_at >= @since');
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await request.query(`
      SELECT TOP (@limit)
        o.*
      FROM dbo.service_orders o
      ${whereClause}
      ORDER BY
        CASE WHEN o.status IN ('pending', 'acknowledged', 'in_progress') THEN 0 ELSE 1 END,
        o.created_at DESC;
    `);

    const orders = result.recordset.map((row) => mapServiceOrderRow(row));
    return res.json(orders);
  } catch (error) {
    console.error('Failed to load service orders', error);
    return res.status(500).json({ message: 'Unable to load service orders right now.' });
  }
  }
);

app.patch(
  '/api/orders/:id',
  authenticate,
  requireRole('staff', 'owner', 'cashier', 'restaurant', 'housekeeping', 'maintenance'),
  async (req, res) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id.' });
    }

    const pool = await poolConnect;
    const existingResult = await pool
      .request()
      .input('id', sql.Int, orderId)
      .query(`SELECT TOP 1 * FROM dbo.service_orders WHERE id = @id`);

    const existingRow = existingResult.recordset[0];
    if (!existingRow) {
      return res.status(404).json({ message: 'Service order not found.' });
    }

    const requestRole = typeof req.user?.role === 'string' ? req.user.role.trim().toLowerCase() : '';
    const existingTargetDepartment = (existingRow.target_department || '').toLowerCase();
    const isServiceTeamRequest = SERVICE_TEAM_DEPARTMENTS.has(existingTargetDepartment);
    if (isServiceTeamRequest && !SERVICE_TEAM_ROLES.has(requestRole)) {
      return res
        .status(403)
        .json({ message: 'Only housekeeping or maintenance can update this request.' });
    }

    const {
      status,
      statusNote,
      targetDepartment,
      requestedFor,
      totalAmount,
      estimatedTotal,
    } = req.body || {};

    const updates = [];
    const updateRequest = pool.request().input('id', sql.Int, orderId);

    const normalizedStatus =
      typeof status === 'string' ? status.trim().toLowerCase() : null;
    if (normalizedStatus) {
      if (!ORDER_STATUSES.has(normalizedStatus)) {
        return res.status(400).json({ message: 'Invalid order status.' });
      }
      updateRequest.input('status', sql.NVarChar(20), normalizedStatus);
      updates.push('status = @status');

      if (normalizedStatus === 'pending') {
        updates.push('acknowledged_at = NULL', 'completed_at = NULL', 'handled_by = NULL');
      } else {
        if (ORDER_ACK_STATUSES.has(normalizedStatus)) {
          updates.push(
            'acknowledged_at = CASE WHEN acknowledged_at IS NULL THEN SYSUTCDATETIME() ELSE acknowledged_at END'
          );
          if (req.user?.username) {
            updateRequest.input('handled_by', sql.NVarChar(120), req.user.username);
            updates.push('handled_by = COALESCE(@handled_by, handled_by)');
          }
        } else if (req.user?.username) {
          updateRequest.input('handled_by', sql.NVarChar(120), req.user.username);
          updates.push('handled_by = COALESCE(@handled_by, handled_by)');
        }

        if (ORDER_FINAL_STATUSES.has(normalizedStatus)) {
          updates.push(
            'completed_at = CASE WHEN completed_at IS NULL THEN SYSUTCDATETIME() ELSE completed_at END'
          );
        } else {
          updates.push('completed_at = NULL');
        }
      }
    }

    if (statusNote !== undefined) {
      const trimmedNote =
        statusNote == null ? null : String(statusNote).trim().slice(0, 2000) || null;
      updateRequest.input('status_note', sql.NVarChar(sql.MAX), trimmedNote);
      updates.push('status_note = @status_note');
    }

    if (targetDepartment !== undefined) {
      const normalizedDepartment = resolveTargetDepartment(
        existingRow.order_type,
        targetDepartment
      );
      updateRequest.input('target_department', sql.NVarChar(80), normalizedDepartment);
      updates.push('target_department = @target_department');
    }

    if (requestedFor !== undefined) {
      const requestedDate = requestedFor ? parseOptionalDateTime(requestedFor) : null;
      if (requestedFor && !requestedDate) {
        return res.status(400).json({ message: 'requestedFor must be a valid date/time.' });
      }
      updateRequest.input('requested_for', sql.DateTime2, requestedDate);
      updates.push('requested_for = @requested_for');
    }

    if (totalAmount !== undefined || estimatedTotal !== undefined) {
      const provided = totalAmount !== undefined ? totalAmount : estimatedTotal;
      if (provided === null || provided === '') {
        updateRequest.input('total_amount', sql.Decimal(10, 2), null);
        updates.push('total_amount = @total_amount');
      } else {
        const numeric = Number.parseFloat(provided);
        if (Number.isNaN(numeric) || numeric < 0) {
          return res.status(400).json({ message: 'totalAmount must be a non-negative number.' });
        }
        const normalized = Math.round(numeric * 100) / 100;
        updateRequest.input('total_amount', sql.Decimal(10, 2), normalized);
        updates.push('total_amount = @total_amount');
      }
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No order changes supplied.' });
    }

    updates.push('updated_at = SYSUTCDATETIME()');

    const updateResult = await updateRequest.query(`
      UPDATE dbo.service_orders
         SET ${updates.join(', ')}
       OUTPUT INSERTED.*
       WHERE id = @id;
    `);

    if (updateResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Service order not found.' });
    }

    const updatedOrder = mapServiceOrderRow(updateResult.recordset[0]);
    return res.json(updatedOrder);
  } catch (error) {
    console.error('Failed to update service order', error);
    return res.status(500).json({ message: 'Unable to update the service order right now.' });
  }
  }
);

app.post(
  '/api/orders/:id/follow-up',
  authenticate,
  requireRole('staff', 'owner', 'cashier', 'restaurant'),
  async (req, res) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id.' });
    }

    const pool = await poolConnect;
    const existingResult = await pool
      .request()
      .input('id', sql.Int, orderId)
      .query(`SELECT TOP 1 * FROM dbo.service_orders WHERE id = @id`);

    const existingRow = existingResult.recordset[0];
    if (!existingRow) {
      return res.status(404).json({ message: 'Service order not found.' });
    }

    const targetDepartment = (existingRow.target_department || '').toLowerCase();
    if (!SERVICE_TEAM_DEPARTMENTS.has(targetDepartment)) {
      return res
        .status(400)
        .json({ message: 'Follow-up alerts are only available for housekeeping and maintenance requests.' });
    }

    if (ORDER_FINAL_STATUSES.has(existingRow.status)) {
      return res.status(400).json({ message: 'This request is already closed.' });
    }

    const mappedOrder = mapServiceOrderRow(existingRow);
    await sendServiceOrderNotification(mappedOrder);

    return res.json({ message: 'Housekeeping and maintenance have been alerted again.' });
  } catch (error) {
    console.error('Failed to trigger service order follow-up', error);
    return res.status(500).json({ message: 'Unable to send the follow-up alert right now.' });
  }
  }
);

app.get(
  '/api/rooms/service-tasks/summary',
  authenticate,
  requireRole('staff', 'owner', 'housekeeping', 'maintenance'),
  async (req, res) => {
    const filterInput = {
      status: typeof req.query?.status === 'string' ? req.query.status : 'active',
      type: typeof req.query?.type === 'string' ? req.query.type : undefined,
      readiness: typeof req.query?.readiness === 'string' ? req.query.readiness : undefined,
      priority: typeof req.query?.priority === 'string' ? req.query.priority : undefined,
      roomNumber:
        typeof req.query?.roomNumber === 'string'
          ? req.query.roomNumber
          : typeof req.query?.room === 'string'
          ? req.query.room
          : undefined,
    };

    let filters;
    try {
      filters = buildServiceTaskFilters(filterInput);
    } catch (error) {
      if (error.message === 'INVALID_TASK_TYPE') {
        return res.status(400).json({ message: 'taskType must be housekeeping or maintenance.' });
      }
      if (error.message === 'INVALID_TASK_STATUS') {
        return res
          .status(400)
          .json({ message: 'status must be active, all, scheduled, in_progress, completed, or cancelled.' });
      }
      if (error.message === 'INVALID_TASK_READINESS') {
        return res.status(400).json({ message: 'readiness must be ready, dirty, inspection, or out_of_service.' });
      }
      if (error.message === 'INVALID_TASK_PRIORITY') {
        return res.status(400).json({ message: 'priority must be low, normal, high, or urgent.' });
      }
      console.error('Failed to build service task summary filters', error);
      return res.status(500).json({ message: 'Unable to load task summary right now.' });
    }

    try {
      const pool = await poolConnect;
      const applyParameters = (request) => {
        filters.parameters.forEach((param) => {
          request.input(param.name, param.type, param.value);
        });
        return request;
      };

      const statusWhere = filters.clauses.length ? `WHERE ${filters.clauses.join(' AND ')}` : '';
      const readinessClauses = filters.clauses.slice();
      readinessClauses.push('readiness IS NOT NULL');
      const readinessWhere = `WHERE ${readinessClauses.join(' AND ')}`;

      const statusRequest = applyParameters(pool.request());
      const statusResult = await statusRequest.query(`
        SELECT status, COUNT(*) AS count
        FROM dbo.room_service_tasks
        ${statusWhere}
        GROUP BY status;
      `);

      const readinessRequest = applyParameters(pool.request());
      const readinessResult = await readinessRequest.query(`
        SELECT readiness, COUNT(*) AS count
        FROM dbo.room_service_tasks
        ${readinessWhere}
        GROUP BY readiness;
      `);

      const statusCounts = {};
      statusResult.recordset.forEach((row) => {
        if (row.status) {
          statusCounts[row.status] = Number(row.count) || 0;
        }
      });

      const readinessCounts = {};
      readinessResult.recordset.forEach((row) => {
        if (row.readiness) {
          readinessCounts[row.readiness] = Number(row.count) || 0;
        }
      });

      return res.json({ status: statusCounts, readiness: readinessCounts });
    } catch (error) {
      console.error('Failed to load service task summary', error);
      return res.status(500).json({ message: 'Unable to load task summary right now.' });
    }
  }
);

app.get(
  '/api/rooms/service-tasks',
  authenticate,
  requireRole('staff', 'owner', 'housekeeping', 'maintenance'),
  async (req, res) => {
  const filterInput = {
    status: typeof req.query?.status === 'string' ? req.query.status : 'active',
    type: typeof req.query?.type === 'string' ? req.query.type : undefined,
    readiness: typeof req.query?.readiness === 'string' ? req.query.readiness : undefined,
    priority: typeof req.query?.priority === 'string' ? req.query.priority : undefined,
    roomNumber:
      typeof req.query?.roomNumber === 'string'
        ? req.query.roomNumber
        : typeof req.query?.room === 'string'
        ? req.query.room
        : undefined,
  };

  let filters;
  try {
    filters = buildServiceTaskFilters(filterInput);
  } catch (error) {
    if (error.message === 'INVALID_TASK_TYPE') {
      return res.status(400).json({ message: 'taskType must be housekeeping or maintenance.' });
    }
    if (error.message === 'INVALID_TASK_STATUS') {
      return res
        .status(400)
        .json({ message: 'status must be active, all, scheduled, in_progress, completed, or cancelled.' });
    }
    if (error.message === 'INVALID_TASK_READINESS') {
      return res.status(400).json({ message: 'readiness must be ready, dirty, inspection, or out_of_service.' });
    }
    if (error.message === 'INVALID_TASK_PRIORITY') {
      return res.status(400).json({ message: 'priority must be low, normal, high, or urgent.' });
    }
    console.error('Failed to build service task filters', error);
    return res.status(500).json({ message: 'Unable to load service tasks right now.' });
  }

  try {
    const pool = await poolConnect;
    const limit = Math.max(1, Math.min(500, Number.parseInt(req.query?.limit, 10) || 200));
    const request = pool.request().input('limit', sql.Int, limit);
    filters.parameters.forEach((param) => request.input(param.name, param.type, param.value));

    const whereClause = filters.clauses.length ? `WHERE ${filters.clauses.join(' AND ')}` : '';

    const result = await request.query(`
      SELECT TOP (@limit)
        id,
        room_number,
        task_type,
        title,
        details,
        priority,
        status,
        readiness,
        scheduled_for,
        started_at,
        completed_at,
        reported_by,
        assigned_to,
        last_updated_by,
        created_at,
        updated_at
      FROM dbo.room_service_tasks
      ${whereClause}
      ORDER BY
        CASE status
          WHEN 'scheduled' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'completed' THEN 2
          WHEN 'cancelled' THEN 3
          ELSE 4
        END,
        ISNULL(scheduled_for, created_at) ASC,
        created_at DESC;
    `);

    return res.json(result.recordset.map((row) => mapServiceTaskRow(row)));
  } catch (error) {
    console.error('Failed to load service tasks', error);
    return res.status(500).json({ message: 'Unable to load service tasks right now.' });
  }
  }
);

app.post(
  '/api/rooms/service-tasks',
  authenticate,
  requireRole('staff', 'owner', 'housekeeping', 'maintenance'),
  async (req, res) => {
  try {
    const {
      roomNumber,
      taskType,
      title,
      details,
      priority,
      status,
      readiness,
      scheduledFor,
      assignedTo,
    } = req.body || {};

    const normalizedRoom = typeof roomNumber === 'string' ? roomNumber.trim() : '';
    if (!normalizedRoom) {
      return res.status(400).json({ message: 'roomNumber is required.' });
    }

    const normalizedType = typeof taskType === 'string' ? taskType.trim().toLowerCase() : '';
    if (!SERVICE_TASK_TYPES.has(normalizedType)) {
      return res.status(400).json({ message: 'taskType must be housekeeping or maintenance.' });
    }

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    if (!normalizedTitle) {
      return res.status(400).json({ message: 'title is required.' });
    }

    let normalizedPriority =
      typeof priority === 'string' && priority.trim() ? priority.trim().toLowerCase() : 'normal';
    if (!SERVICE_TASK_PRIORITIES.has(normalizedPriority)) {
      normalizedPriority = 'normal';
    }

    let normalizedStatus =
      typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : 'scheduled';
    if (!SERVICE_TASK_STATUSES.has(normalizedStatus)) {
      normalizedStatus = 'scheduled';
    }

    let normalizedReadiness =
      typeof readiness === 'string' && readiness.trim() ? readiness.trim().toLowerCase() : '';
    if (normalizedReadiness && !ROOM_READINESS_STATES.has(normalizedReadiness)) {
      return res
        .status(400)
        .json({ message: 'readiness must be ready, dirty, inspection, or out_of_service.' });
    }
    if (!normalizedReadiness) {
      normalizedReadiness = null;
    }

    const scheduledDate = scheduledFor ? parseOptionalDateTime(scheduledFor) : null;
    if (scheduledFor && !scheduledDate) {
      return res.status(400).json({ message: 'scheduledFor must be a valid date/time.' });
    }

    const trimmedDetails =
      details == null ? null : String(details).trim().slice(0, 4000) || null;
    const trimmedAssigned =
      assignedTo == null ? null : String(assignedTo).trim().slice(0, 120) || null;
    const username = req.user?.username ? String(req.user.username).trim().slice(0, 120) : null;

    const now = new Date();
    let initialStartedAt = null;
    let initialCompletedAt = null;
    if (normalizedStatus === 'in_progress') {
      initialStartedAt = now;
    } else if (normalizedStatus === 'completed') {
      initialStartedAt = now;
      initialCompletedAt = now;
    } else if (normalizedStatus === 'cancelled') {
      initialCompletedAt = now;
    }

    const pool = await poolConnect;
    const insertRequest = pool
      .request()
      .input('room_number', sql.NVarChar(20), normalizedRoom)
      .input('task_type', sql.NVarChar(20), normalizedType)
      .input('title', sql.NVarChar(200), normalizedTitle)
      .input('details', sql.NVarChar(sql.MAX), trimmedDetails)
      .input('priority', sql.NVarChar(20), normalizedPriority)
      .input('status', sql.NVarChar(20), normalizedStatus)
      .input('readiness', sql.NVarChar(20), normalizedReadiness)
      .input('scheduled_for', sql.DateTime2, scheduledDate)
      .input('started_at', sql.DateTime2, initialStartedAt)
      .input('completed_at', sql.DateTime2, initialCompletedAt)
      .input('reported_by', sql.NVarChar(120), username)
      .input('assigned_to', sql.NVarChar(120), trimmedAssigned)
      .input('last_updated_by', sql.NVarChar(120), username);

    const insertResult = await insertRequest.query(`
      INSERT INTO dbo.room_service_tasks (
        room_number,
        task_type,
        title,
        details,
        priority,
        status,
        readiness,
        scheduled_for,
        started_at,
        completed_at,
        reported_by,
        assigned_to,
        last_updated_by
      )
      OUTPUT INSERTED.*
      VALUES (
        @room_number,
        @task_type,
        @title,
        @details,
        @priority,
        @status,
        @readiness,
        @scheduled_for,
        @started_at,
        @completed_at,
        @reported_by,
        @assigned_to,
        @last_updated_by
      );
    `);

    if (!insertResult.recordset.length) {
      return res.status(500).json({ message: 'Unable to create the service task right now.' });
    }

    const created = mapServiceTaskRow(insertResult.recordset[0]);
    return res.status(201).json({
      message: 'Task created.',
      task: created,
    });
  } catch (error) {
    console.error('Failed to create service task', error);
    return res.status(500).json({ message: 'Unable to create the service task right now.' });
  }
  }
);

app.patch(
  '/api/rooms/service-tasks/:id',
  authenticate,
  requireRole('staff', 'owner', 'housekeeping', 'maintenance'),
  async (req, res) => {
    try {
      const taskId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(taskId) || taskId <= 0) {
        return res.status(400).json({ message: 'Invalid task id.' });
      }

      const pool = await poolConnect;
      const existingResult = await pool
        .request()
        .input('id', sql.Int, taskId)
        .query(`SELECT TOP 1 * FROM dbo.room_service_tasks WHERE id = @id;`);

      const existingTask = existingResult.recordset[0];
      if (!existingTask) {
        return res.status(404).json({ message: 'Task not found.' });
      }

      const {
        roomNumber,
        title,
        details,
        status,
        readiness,
        scheduledFor,
        priority,
        assignedTo,
      } = req.body || {};

      const updates = [];
      const updateRequest = pool.request().input('id', sql.Int, taskId);

      if (roomNumber !== undefined) {
        const normalizedRoom = roomNumber == null ? null : String(roomNumber).trim();
        if (!normalizedRoom) {
          return res.status(400).json({ message: 'roomNumber cannot be empty.' });
        }
        updateRequest.input('room_number', sql.NVarChar(20), normalizedRoom);
        updates.push('room_number = @room_number');
      }

      if (title !== undefined) {
        const normalizedTitle = title == null ? null : String(title).trim();
        if (!normalizedTitle) {
          return res.status(400).json({ message: 'title cannot be empty.' });
        }
        updateRequest.input('title', sql.NVarChar(200), normalizedTitle);
        updates.push('title = @title');
      }

      if (details !== undefined) {
        const normalizedDetails = details == null ? null : String(details).trim().slice(0, 4000) || null;
        updateRequest.input('details', sql.NVarChar(sql.MAX), normalizedDetails);
        updates.push('details = @details');
      }

      if (priority !== undefined) {
        const normalizedPriority = priority == null ? null : String(priority).trim().toLowerCase();
        if (!normalizedPriority || !SERVICE_TASK_PRIORITIES.has(normalizedPriority)) {
          return res.status(400).json({ message: 'priority must be low, normal, high, or urgent.' });
        }
        updateRequest.input('priority', sql.NVarChar(20), normalizedPriority);
        updates.push('priority = @priority');
      }

      if (assignedTo !== undefined) {
        const normalizedAssigned = assignedTo == null ? null : String(assignedTo).trim().slice(0, 120) || null;
        updateRequest.input('assigned_to', sql.NVarChar(120), normalizedAssigned);
        updates.push('assigned_to = @assigned_to');
      }

      if (readiness !== undefined) {
        const normalizedReadiness = readiness == null ? null : String(readiness).trim().toLowerCase();
        if (normalizedReadiness && !ROOM_READINESS_STATES.has(normalizedReadiness)) {
          return res
            .status(400)
            .json({ message: 'readiness must be ready, dirty, inspection, or out_of_service.' });
        }
        updateRequest.input('readiness', sql.NVarChar(20), normalizedReadiness || null);
        updates.push('readiness = @readiness');
      }

      if (scheduledFor !== undefined) {
        const scheduledDate = scheduledFor ? parseOptionalDateTime(scheduledFor) : null;
        if (scheduledFor && !scheduledDate) {
          return res.status(400).json({ message: 'scheduledFor must be a valid date/time.' });
        }
        updateRequest.input('scheduled_for', sql.DateTime2, scheduledDate);
        updates.push('scheduled_for = @scheduled_for');
      }

      if (status !== undefined) {
        const normalizedStatus = status == null ? null : String(status).trim().toLowerCase();
        if (!normalizedStatus || !SERVICE_TASK_STATUSES.has(normalizedStatus)) {
          return res
            .status(400)
            .json({ message: 'status must be scheduled, in_progress, completed, or cancelled.' });
        }
        updateRequest.input('status', sql.NVarChar(20), normalizedStatus);
        updates.push('status = @status');

        if (normalizedStatus === 'scheduled') {
          updates.push('started_at = NULL', 'completed_at = NULL');
        } else if (normalizedStatus === 'in_progress') {
          updates.push(
            'started_at = CASE WHEN started_at IS NULL THEN SYSUTCDATETIME() ELSE started_at END',
            'completed_at = NULL'
          );
        } else if (normalizedStatus === 'completed') {
          updates.push(
            'started_at = CASE WHEN started_at IS NULL THEN SYSUTCDATETIME() ELSE started_at END',
            'completed_at = CASE WHEN completed_at IS NULL THEN SYSUTCDATETIME() ELSE completed_at END'
          );
        } else if (normalizedStatus === 'cancelled') {
          updates.push('completed_at = CASE WHEN completed_at IS NULL THEN SYSUTCDATETIME() ELSE completed_at END');
        }
      }

      if (!updates.length) {
        return res.status(400).json({ message: 'No task changes supplied.' });
      }

      const username = req.user?.username ? String(req.user.username).trim().slice(0, 120) : null;
      if (username) {
        updateRequest.input('updated_by', sql.NVarChar(120), username);
        updates.push('last_updated_by = @updated_by');
      }

      updates.push('updated_at = SYSUTCDATETIME()');

      const updateResult = await updateRequest.query(`
        UPDATE dbo.room_service_tasks
           SET ${updates.join(', ')}
         OUTPUT INSERTED.*
         WHERE id = @id;
      `);

      if (!updateResult.recordset.length) {
        return res.status(404).json({ message: 'Task not found.' });
      }

      const updatedTask = mapServiceTaskRow(updateResult.recordset[0]);
      return res.json({
        message: 'Task updated.',
        task: updatedTask,
      });
    } catch (error) {
      console.error('Failed to update service task', error);
      return res.status(500).json({ message: 'Unable to update the service task right now.' });
    }
  }
);

app.get('/api/guests', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const filters = [];
    const parameters = [
      { name: 'now', type: sql.DateTime2, value: new Date() },
    ];

    const searchTerm =
      typeof req.query?.search === 'string' ? req.query.search.trim().replace(/%/g, '') : '';
    if (searchTerm) {
      filters.push(
        '(gp.full_name LIKE @search OR gp.email LIKE @search OR gp.phone LIKE @search OR gp.notes LIKE @search)'
      );
      parameters.push({
        name: 'search',
        type: sql.NVarChar(400),
        value: `%${searchTerm}%`,
      });
    }

    const marketingFilter = parseBooleanInput(req.query?.marketingOptIn);
    if (marketingFilter.invalid) {
      return res.status(400).json({ message: 'marketingOptIn must be true or false.' });
    }
    if (marketingFilter.provided) {
      filters.push('gp.marketing_opt_in = @marketingOptIn');
      parameters.push({
        name: 'marketingOptIn',
        type: sql.Bit,
        value: marketingFilter.value ? 1 : 0,
      });
    }

    const vipStatusFilter =
      typeof req.query?.vipStatus === 'string' ? req.query.vipStatus.trim() : '';
    if (vipStatusFilter) {
      filters.push('gp.vip_status = @vipStatus');
      parameters.push({
        name: 'vipStatus',
        type: sql.NVarChar(50),
        value: vipStatusFilter,
      });
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query(
      `SELECT gp.*, upcoming.next_check_in, recent.last_room_type
         FROM dbo.guest_profiles gp
         OUTER APPLY (
           SELECT TOP 1 b.check_in AS next_check_in
             FROM dbo.bookings b
            WHERE b.guest_id = gp.id
              AND b.check_in >= @now
            ORDER BY b.check_in ASC
         ) AS upcoming
         OUTER APPLY (
           SELECT TOP 1 b.room_type AS last_room_type
             FROM dbo.bookings b
            WHERE b.guest_id = gp.id
            ORDER BY b.check_in DESC
         ) AS recent
         ${whereClause}
         ORDER BY gp.full_name ASC, gp.email ASC`,
      parameters
    );

    const guests = result.recordset.map((row) => mapGuestProfileRow(row));
    return res.json(guests);
  } catch (error) {
    console.error('Failed to load guest profiles', error);
    return res.status(500).json({ message: 'Unable to load guest profiles right now.' });
  }
});

app.post('/api/guests', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      preferredRoomType,
      marketingOptIn,
      vipStatus,
      notes,
      preferences,
    } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ message: 'Guest name must be at least 2 characters long.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ message: 'A valid guest email address is required.' });
    }

    const marketingResult = parseBooleanInput(marketingOptIn);
    if (marketingResult.invalid) {
      return res.status(400).json({ message: 'marketingOptIn must be true or false.' });
    }

    const preferencesResult = serializeGuestPreferencesInput(preferences);
    if (preferencesResult.error) {
      return res.status(400).json({ message: preferencesResult.error });
    }

    const pool = await poolConnect;
    const request = pool
      .request()
      .input('full_name', sql.NVarChar(255), fullName.trim())
      .input('email', sql.NVarChar(255), email.trim())
      .input('phone', sql.NVarChar(50), phone ? String(phone).trim() || null : null)
      .input(
        'preferred_room_type',
        sql.NVarChar(120),
        preferredRoomType ? String(preferredRoomType).trim() || null : null
      )
      .input(
        'marketing_opt_in',
        sql.Bit,
        marketingResult.provided ? (marketingResult.value ? 1 : 0) : 0
      )
      .input('vip_status', sql.NVarChar(50), vipStatus ? String(vipStatus).trim() || null : null)
      .input('notes', sql.NVarChar(sql.MAX), notes ? String(notes).trim() || null : null)
      .input(
        'preferences',
        sql.NVarChar(sql.MAX),
        preferencesResult.provided ? preferencesResult.value : null
      );

    const insertResult = await request.query(`
      INSERT INTO dbo.guest_profiles
        (full_name, email, phone, preferred_room_type, marketing_opt_in, vip_status, notes, preferences)
      OUTPUT INSERTED.*, NULL AS next_check_in, NULL AS last_room_type
      VALUES
        (@full_name, @email, @phone, @preferred_room_type, @marketing_opt_in, @vip_status, @notes, @preferences);
    `);

    const guest = mapGuestProfileRow(insertResult.recordset[0]);
    return res.status(201).json(guest);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ message: 'A guest profile with that email already exists.' });
    }
    console.error('Failed to create guest profile', error);
    return res.status(500).json({ message: 'Unable to create guest profile right now.' });
  }
});

app.get('/api/guests/:id', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const guestId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(guestId) || guestId <= 0) {
      return res.status(400).json({ message: 'Invalid guest id.' });
    }

    const pool = await poolConnect;
    const detailResult = await pool
      .request()
      .input('id', sql.Int, guestId)
      .input('now', sql.DateTime2, new Date())
      .query(
        `SELECT gp.*, upcoming.next_check_in, recent.last_room_type
           FROM dbo.guest_profiles gp
           OUTER APPLY (
             SELECT TOP 1 b.check_in AS next_check_in
               FROM dbo.bookings b
              WHERE b.guest_id = gp.id
                AND b.check_in >= @now
              ORDER BY b.check_in ASC
           ) AS upcoming
           OUTER APPLY (
             SELECT TOP 1 b.room_type AS last_room_type
               FROM dbo.bookings b
              WHERE b.guest_id = gp.id
              ORDER BY b.check_in DESC
           ) AS recent
          WHERE gp.id = @id;`
      );

    const guestRow = detailResult.recordset[0];
    if (!guestRow) {
      return res.status(404).json({ message: 'Guest profile not found.' });
    }

    const bookingsResult = await pool
      .request()
      .input('guest_id', sql.Int, guestId)
      .query(
        `SELECT b.*, vc.code AS verification_code
           FROM dbo.bookings b
           LEFT JOIN dbo.verification_codes vc ON b.verification_code_id = vc.id
          WHERE b.guest_id = @guest_id
          ORDER BY b.check_in DESC, b.created_at DESC;`
      );

    const history = bookingsResult.recordset.map((row) => ({
      ...mapBookingRow(row),
      nights: calculateStayNightsFromRow(row),
    }));

    const guest = mapGuestProfileRow(guestRow);
    guest.history = history;
    const now = Date.now();
    guest.upcomingBookings = history.filter((booking) => {
      if (!booking.checkIn) {
        return false;
      }
      const checkInTime = new Date(booking.checkIn).getTime();
      return !Number.isNaN(checkInTime) && checkInTime >= now;
    });

    return res.json(guest);
  } catch (error) {
    console.error('Failed to load guest profile', error);
    return res.status(500).json({ message: 'Unable to load guest profile right now.' });
  }
});

app.put('/api/guests/:id', authenticate, requireRole('staff', 'owner'), async (req, res) => {
  try {
    const guestId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(guestId) || guestId <= 0) {
      return res.status(400).json({ message: 'Invalid guest id.' });
    }

    const {
      fullName,
      phone,
      preferredRoomType,
      marketingOptIn,
      vipStatus,
      notes,
      preferences,
    } = req.body || {};

    const setClauses = [];
    const parameters = [{ name: 'id', type: sql.Int, value: guestId }];

    if (fullName !== undefined) {
      if (fullName === null || typeof fullName !== 'string' || fullName.trim().length < 2) {
        return res.status(400).json({ message: 'Guest name must be at least 2 characters long.' });
      }
      setClauses.push('full_name = @full_name');
      parameters.push({
        name: 'full_name',
        type: sql.NVarChar(255),
        value: fullName.trim(),
      });
    }

    if (phone !== undefined) {
      const normalizedPhone =
        phone === null ? null : String(phone).trim() || null;
      setClauses.push('phone = @phone');
      parameters.push({
        name: 'phone',
        type: sql.NVarChar(50),
        value: normalizedPhone,
      });
    }

    if (preferredRoomType !== undefined) {
      const normalizedRoom =
        preferredRoomType === null ? null : String(preferredRoomType).trim() || null;
      setClauses.push('preferred_room_type = @preferred_room_type');
      parameters.push({
        name: 'preferred_room_type',
        type: sql.NVarChar(120),
        value: normalizedRoom,
      });
    }

    if (vipStatus !== undefined) {
      const normalizedVip = vipStatus === null ? null : String(vipStatus).trim() || null;
      setClauses.push('vip_status = @vip_status');
      parameters.push({
        name: 'vip_status',
        type: sql.NVarChar(50),
        value: normalizedVip,
      });
    }

    if (notes !== undefined) {
      const normalizedNotes = notes === null ? null : String(notes).trim() || null;
      setClauses.push('notes = @notes');
      parameters.push({
        name: 'notes',
        type: sql.NVarChar(sql.MAX),
        value: normalizedNotes,
      });
    }

    const marketingResult = parseBooleanInput(marketingOptIn);
    if (marketingResult.invalid) {
      return res.status(400).json({ message: 'marketingOptIn must be true or false.' });
    }
    if (marketingResult.provided) {
      setClauses.push('marketing_opt_in = @marketing_opt_in');
      parameters.push({
        name: 'marketing_opt_in',
        type: sql.Bit,
        value: marketingResult.value ? 1 : 0,
      });
    }

    const preferencesResult = serializeGuestPreferencesInput(preferences);
    if (preferencesResult.error) {
      return res.status(400).json({ message: preferencesResult.error });
    }
    if (preferencesResult.provided) {
      setClauses.push('preferences = @preferences');
      parameters.push({
        name: 'preferences',
        type: sql.NVarChar(sql.MAX),
        value: preferencesResult.value,
      });
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ message: 'No guest profile changes supplied.' });
    }

    setClauses.push('updated_at = SYSUTCDATETIME()');

    const pool = await poolConnect;
    const updateRequest = pool.request();
    for (const param of parameters) {
      updateRequest.input(param.name, param.type, param.value);
    }

    const updateResult = await updateRequest.query(
      `UPDATE dbo.guest_profiles
          SET ${setClauses.join(', ')}
        WHERE id = @id;`
    );

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Guest profile not found.' });
    }

    const detailResult = await pool
      .request()
      .input('id', sql.Int, guestId)
      .input('now', sql.DateTime2, new Date())
      .query(
        `SELECT gp.*, upcoming.next_check_in, recent.last_room_type
           FROM dbo.guest_profiles gp
           OUTER APPLY (
             SELECT TOP 1 b.check_in AS next_check_in
               FROM dbo.bookings b
              WHERE b.guest_id = gp.id
                AND b.check_in >= @now
              ORDER BY b.check_in ASC
           ) AS upcoming
           OUTER APPLY (
             SELECT TOP 1 b.room_type AS last_room_type
               FROM dbo.bookings b
              WHERE b.guest_id = gp.id
              ORDER BY b.check_in DESC
           ) AS recent
          WHERE gp.id = @id;`
      );

    const guest = mapGuestProfileRow(detailResult.recordset[0]);
    return res.json(guest);
  } catch (error) {
    console.error('Failed to update guest profile', error);
    return res.status(500).json({ message: 'Unable to update guest profile right now.' });
  }
});

app.patch(
  '/api/bookings/:id/checkin',
  authenticate,
  requireRole('staff', 'owner'),
  async (req, res) => {
  try {
    const bookingId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(bookingId)) {
      return res.status(400).json({ message: 'Invalid booking id.' });
    }

    const roomNumberInput = typeof req.body?.roomNumber === 'string' ? req.body.roomNumber.trim() : '';
    if (!roomNumberInput) {
      return res.status(400).json({ message: 'roomNumber is required to check a guest in.' });
    }
    if (roomNumberInput.length > MAX_ROOM_NUMBER_LENGTH) {
      return res
        .status(400)
        .json({ message: `roomNumber must be ${MAX_ROOM_NUMBER_LENGTH} characters or less.` });
    }

    const pool = await poolConnect;
    const result = await pool
      .request()
      .input('id', sql.Int, bookingId)
      .input('room_number', sql.NVarChar(MAX_ROOM_NUMBER_LENGTH), roomNumberInput)
      .query(
        `UPDATE dbo.bookings
            SET status = 'checked_in',
                checked_in_at = SYSUTCDATETIME(),
                room_number = @room_number
          WHERE id = @id AND status NOT IN ('checked_in', 'checked_out');
         SELECT @@ROWCOUNT AS affected;`
      );

      const affected = result.recordset?.[0]?.affected ?? 0;
      if (!affected) {
        return res
          .status(404)
          .json({ message: 'Booking not found or already checked in/out.' });
      }

      return res.json({ message: 'Guest checked in successfully.' });
    } catch (error) {
      console.error('Failed to check in booking', error);
      return res.status(500).json({ message: 'Unable to check in right now.' });
    }
  }
);

app.patch(
  '/api/bookings/:id/checkout',
  authenticate,
  requireRole('staff', 'owner'),
  async (req, res) => {
    try {
      const bookingId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(bookingId)) {
        return res.status(400).json({ message: 'Invalid booking id.' });
      }

      const pool = await poolConnect;
      const result = await pool
        .request()
        .input('id', sql.Int, bookingId)
        .query(
          `UPDATE dbo.bookings
              SET status = 'checked_out',
                  checked_out_at = SYSUTCDATETIME(),
                  room_number = NULL
            WHERE id = @id AND status <> 'checked_out';
           SELECT @@ROWCOUNT AS affected;`
        );

      const affected = result.recordset?.[0]?.affected ?? 0;
      if (!affected) {
        return res.status(404).json({ message: 'Booking not found or already checked out.' });
      }

      await refreshSalesSummaryCache(pool).catch((summaryError) => {
        console.warn('Unable to refresh sales summary cache after checkout.', summaryError);
      });

      return res.json({ message: 'Guest checked out successfully.' });
    } catch (error) {
      console.error('Failed to checkout booking', error);
      return res.status(500).json({ message: 'Unable to checkout booking right now.' });
    }
  }
);

app.get('/api/overview', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const pool = await poolConnect;
    const { windowKey: salesWindowKey, label: salesWindowLabel } = resolveSalesWindow(req.query?.salesWindow);
    if (process.env.LOG_OVERVIEW_QUERIES === 'true') {
      console.info(`[overview] window=${req.query?.salesWindow ?? 'default'} => ${salesWindowKey} (${salesWindowLabel})`);
    }

    const result = await pool.request().query(`
      DECLARE @now DATETIME2 = SYSUTCDATETIME();
      DECLARE @startOfDay DATETIME2 = DATEADD(DAY, DATEDIFF(DAY, 0, @now), 0);

      SELECT COUNT(*) AS totalBookings FROM dbo.bookings;

      SELECT COUNT(*) AS checkedInGuests
        FROM dbo.bookings
        WHERE status = 'checked_in';

      SELECT COUNT(*) AS checkedOutToday
        FROM dbo.bookings
        WHERE status = 'checked_out'
          AND checked_out_at >= @startOfDay;

      SELECT
        SUM(CASE WHEN source = 'direct' THEN 1 ELSE 0 END) AS walkIns,
        SUM(CASE WHEN source <> 'direct' THEN 1 ELSE 0 END) AS onlineReservations
      FROM dbo.bookings;

      SELECT room_type, COUNT(*) AS occupiedCount
        FROM dbo.bookings
        WHERE status <> 'checked_out'
          AND (check_out IS NULL OR check_out >= @now)
        GROUP BY room_type;

      SELECT id, name, description, total_rooms, base_rate, created_at, updated_at
        FROM dbo.room_types
        ORDER BY name;

      SELECT period_type, period_start, period_end, total_amount, updated_at
        FROM dbo.sales_summary;
    `);

    const totalBookings = result.recordsets[0][0]?.totalBookings ?? 0;
    const checkedInGuests = result.recordsets[1][0]?.checkedInGuests ?? 0;
    const checkedOutToday = result.recordsets[2][0]?.checkedOutToday ?? 0;
    const walkIns = Number(result.recordsets[3][0]?.walkIns ?? 0);
    const onlineReservations = Number(result.recordsets[3][0]?.onlineReservations ?? 0);
    const occupancyRows = result.recordsets[4] || [];
    const roomTypeRows = result.recordsets[5] || [];

    let salesSummaryRows = result.recordsets[6] || [];
    if (!salesSummaryRows || salesSummaryRows.length < SALES_PERIODS.length) {
      await refreshSalesSummaryCache(pool);
      salesSummaryRows = (
        await pool
          .request()
          .query(
            `SELECT period_type, period_start, period_end, total_amount, updated_at
               FROM dbo.sales_summary;`
          )
      ).recordset;
    }

    const roomTypes = roomTypeRows.map(mapRoomTypeRecord);
    const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType.name, roomType]));
    const occupancyMap = new Map(
      occupancyRows.map((row) => [row.room_type, Number(row.occupiedCount || 0)])
    );

    const availabilityByType = roomTypes.map((roomType) => {
      const occupied = occupancyMap.get(roomType.name) || 0;
      const available = Math.max(roomType.totalRooms - occupied, 0);
      return {
        roomType: roomType.name,
        totalRooms: roomType.totalRooms,
        occupied,
        available,
        baseRate: roomType.baseRate,
        description: roomType.description,
      };
    });

    for (const [roomTypeName, occupied] of occupancyMap.entries()) {
      if (!roomTypeMap.has(roomTypeName)) {
        availabilityByType.push({
          roomType: roomTypeName,
          totalRooms: occupied,
          occupied,
          available: 0,
        });
      }
    }

    const totalRooms = roomTypes.reduce((sum, roomType) => sum + roomType.totalRooms, 0);
    const availableRooms = availabilityByType.reduce((sum, entry) => sum + entry.available, 0);

    const summaryMap = new Map();
    for (const row of salesSummaryRows) {
      summaryMap.set(row.period_type, row);
    }

    const selectedSummary = summaryMap.get(salesWindowKey);
    const fallbackRange = calculateSalesPeriodRange(getPeriodDefinition(salesWindowKey), new Date());
    const salesWindowRange = selectedSummary
      ? {
          start: selectedSummary.period_start ? new Date(selectedSummary.period_start).toISOString() : null,
          end: selectedSummary.period_end ? new Date(selectedSummary.period_end).toISOString() : null,
        }
      : {
          start: fallbackRange.start.toISOString(),
          end: fallbackRange.end.toISOString(),
        };

    const overview = {
      totalBookings,
      availableRooms,
      checkedInGuests,
      checkedOutToday,
      walkIns,
      onlineReservations,
      totalRooms,
      sales: {
        daily: Number(summaryMap.get('daily')?.total_amount || 0),
        weekly: Number(summaryMap.get('weekly')?.total_amount || 0),
        monthly: Number(summaryMap.get('monthly')?.total_amount || 0),
        yearly: Number(summaryMap.get('yearly')?.total_amount || 0),
        selected: {
          window: salesWindowKey,
          label: salesWindowLabel,
          total: Number(summaryMap.get(salesWindowKey)?.total_amount || 0),
          range: salesWindowRange,
          updatedAt: selectedSummary?.updated_at ? new Date(selectedSummary.updated_at).toISOString() : null,
        },
      },
      availabilityByType,
    };

    return res.json(overview);
  } catch (error) {
    console.error('Failed to load overview', error);
    return res.status(500).json({ message: 'Unable to load dashboard metrics currently.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  res.json({
    minimumDeposit: MINIMUM_DEPOSIT,
    paymentOptions: ['GCash', 'PayMaya', 'Credit Card'],
    gcashIntegrationEnabled: Boolean(process.env.PAYMONGO_SECRET_KEY),
    staffPortalEnabled: true,
  });
});

app.get('/api/billing', authenticate, requireRole('cashier', 'staff', 'owner'), async (_req, res) => {
  try {
    const pool = await poolConnect;
    const summary = await fetchBillingSummary(pool);
    return res.json(summary);
  } catch (error) {
    console.error('Failed to load billing summary', error);
    return res.status(500).json({ message: 'Unable to load billing summary right now.' });
  }
});

app.get(
  '/api/billing/:id/receipt',
  authenticate,
  requireRole('cashier', 'staff', 'owner'),
  async (req, res) => {
    try {
      const bookingId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(bookingId) || bookingId <= 0) {
        return res.status(400).json({ message: 'Invalid booking id.' });
      }

      const pool = await poolConnect;
      const entry = await fetchBillingSummary(pool, { bookingId });
      if (!entry) {
        return res.status(404).json({ message: 'Booking not found.' });
      }
      return res.json(entry);
    } catch (error) {
      console.error('Failed to load billing receipt', error);
      return res.status(500).json({ message: 'Unable to load receipt details right now.' });
    }
  }
);

app.patch(
  '/api/billing/:id/payment',
  authenticate,
  requireRole('cashier', 'owner'),
  async (req, res) => {
    try {
      const bookingId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(bookingId) || bookingId <= 0) {
        return res.status(400).json({ message: 'Invalid booking id.' });
      }

      const { paymentMethod, paymentReference, paymentAmount, paymentReceived } = req.body || {};

      if (
        paymentMethod === undefined &&
        paymentReference === undefined &&
        paymentAmount === undefined &&
        paymentReceived === undefined
      ) {
        return res.status(400).json({ message: 'No payment updates supplied.' });
      }

      const pool = await poolConnect;
      const updateRequest = pool.request().input('id', sql.Int, bookingId);
      const updates = [];

      if (paymentMethod !== undefined) {
        const trimmedMethod =
          paymentMethod == null ? null : String(paymentMethod).trim().slice(0, 50) || null;
        updateRequest.input('payment_method', sql.NVarChar(50), trimmedMethod);
        updates.push('payment_method = @payment_method');
      }

      if (paymentReference !== undefined) {
        const trimmedReference =
          paymentReference == null ? null : String(paymentReference).trim().slice(0, 80) || null;
        updateRequest.input('payment_reference', sql.NVarChar(80), trimmedReference);
        updates.push('payment_reference = @payment_reference');
      }

      if (paymentAmount !== undefined) {
        if (paymentAmount === null || paymentAmount === '') {
          updateRequest.input('payment_amount', sql.Decimal(10, 2), 0);
          updates.push('payment_amount = @payment_amount');
        } else {
          const numericAmount = Number.parseFloat(paymentAmount);
          if (Number.isNaN(numericAmount) || numericAmount < 0) {
            return res.status(400).json({ message: 'Payment amount must be a non-negative number.' });
          }
          const normalizedAmount = Math.round(numericAmount * 100) / 100;
          updateRequest.input('payment_amount', sql.Decimal(10, 2), normalizedAmount);
          updates.push('payment_amount = @payment_amount');
        }
      }

      if (paymentReceived !== undefined) {
        const receivedResult = parseBooleanInput(paymentReceived);
        if (receivedResult.invalid) {
          return res.status(400).json({ message: 'paymentReceived must be true or false.' });
        }
        if (receivedResult.provided) {
          updateRequest.input('payment_received', sql.Bit, receivedResult.value ? 1 : 0);
          updates.push('payment_received = @payment_received');
        }
      }

      if (!updates.length) {
        return res.status(400).json({ message: 'No payment updates supplied.' });
      }

      const updateResult = await updateRequest.query(`
        UPDATE dbo.bookings
           SET ${updates.join(', ')}
         OUTPUT INSERTED.*
         WHERE id = @id;
      `);

      if (updateResult.recordset.length === 0) {
        return res.status(404).json({ message: 'Booking not found.' });
      }

      const entry = await fetchBillingSummary(pool, { bookingId });
      return res.json({
        message: 'Payment details updated.',
        entry,
      });
    } catch (error) {
      console.error('Failed to update payment details', error);
      return res.status(500).json({ message: 'Unable to update payment details right now.' });
    }
  }
);

app.get('/api/rooms/inventory', async (_req, res) => {
  try {
    const pool = await poolConnect;
    const roomTypes = await loadRoomTypes(pool, { forceRefresh: true });

    const rooms = [];
    for (const type of roomTypes) {
      const totalRooms = Number(type.totalRooms ?? type.total_rooms ?? 0);
      if (!Number.isFinite(totalRooms) || totalRooms <= 0) {
        continue;
      }
      const limit = Math.min(Math.max(totalRooms, 0), 500);
      const name = type.name || 'Room';
      const padding = String(limit).length > 2 ? String(limit).length : 2;
      for (let i = 1; i <= limit; i += 1) {
        const code = generateRoomCode(name, i, padding);
        rooms.push({
          id: `${type.id}-${i}`,
          value: code,
          code,
          label: `${name} • ${code}`,
          roomTypeId: type.id,
          roomType: name,
          sequence: i,
        });
      }
    }

    rooms.sort((a, b) => {
      if (a.roomType === b.roomType) {
        return a.sequence - b.sequence;
      }
      return a.roomType.localeCompare(b.roomType);
    });

    return res.json({ rooms });
  } catch (error) {
    console.error('Failed to load room inventory', error);
    return res.status(500).json({ message: 'Unable to load room list right now.' });
  }
});

app.post('/api/payments/gcash', async (req, res) => {
  try {
    if (!process.env.PAYMONGO_SECRET_KEY) {
      return res.status(503).json({
        message: 'GCash integration is not configured. Please contact the hotel team for assistance.',
      });
    }

    const { amount, customerName, email, remarks } = req.body;

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount specified.' });
    }

    if (!customerName) {
      return res.status(400).json({ message: 'Customer name is required to generate a GCash link.' });
    }

    const cents = Math.round(Number(amount) * 100);

    const payload = {
      data: {
        attributes: {
          amount: cents,
          currency: 'PHP',
          description: `Harborview deposit for ${customerName}`,
          remarks: remarks || 'Booking deposit',
          payment_method_types: ['gcash'],
          statement_descriptor: 'Harborview Deposit',
          send_email_receipt: Boolean(email),
          customer: email
            ? {
                name: customerName,
                email,
              }
            : undefined,
        },
      },
    };

    const response = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('PayMongo link creation failed', result);
      const message =
        result?.errors?.[0]?.detail || 'Unable to generate GCash payment link. Please try again later.';
      return res.status(502).json({ message });
    }

    const linkData = result?.data;
    return res.status(201).json({
      message: 'GCash payment link created.',
      checkoutUrl: linkData?.attributes?.checkout_url,
      referenceNumber: linkData?.attributes?.reference_number,
    });
  } catch (error) {
    console.error('Failed to create GCash payment link', error);
    return res
      .status(500)
      .json({ message: 'Unable to create GCash payment link at the moment. Please try again.' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'hotel.html'));
});

app.get('/hotel', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'hotel.html'));
});

app.get('/rooms', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'rooms.html'));
});

app.get('/order', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'order.html'));
});

app.get('/menu', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'menu.html'));
});

app.get('/service', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'service.html'));
});

app.get('/service-team', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'service-team.html'));
});

app.get('/menu/preview', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'menu-preview.html'));
});

app.get('/book', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'index.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'admin.html'));
});

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Hotel booking server listening on http://localhost:${PORT}`);
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      'SMTP credentials not fully configured. Verification codes will be logged to the console.'
    );
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendVerificationEmail(email, code, fullName) {
  if (!transporter) {
    console.info(`Verification code for ${email}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Hotel Reservation" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Hotel Booking Verification Code',
    text: [
      `Hi ${fullName || 'guest'},`,
      '',
      'Use the verification code below to finish your hotel booking:',
      '',
      code,
      '',
      'This code expires in 10 minutes. If you did not request it, please ignore this email.',
      '',
      'We look forward to hosting you!',
    ].join('\n'),
  });
}

function buildSqlConfig(options = {}) {
  const isAdmin = options.admin === true;
  const connectionString = isAdmin
    ? process.env.SQL_ADMIN_CONNECTION_STRING
    : process.env.SQL_CONNECTION_STRING;

  if (connectionString) {
    return {
      connectionConfig: connectionString,
      connectionLabel: isAdmin ? 'admin connection string' : 'via connection string',
    };
  }

  const prefix = isAdmin ? 'SQL_ADMIN_' : 'SQL_';
  const read = (key, fallback) => process.env[`${prefix}${key}`] ?? (!isAdmin ? process.env[`SQL_${key}`] : fallback);

  const server = read('SERVER');
  const database = read('DATABASE');
  const user = read('USER');
  const password = read('PASSWORD');
  const port = read('PORT');
  const encrypt = read('ENCRYPT');
  const trustCert = read('TRUST_CERT');
  const poolMax = read('POOL_MAX');
  const domain = read('DOMAIN');
  const authType = read('AUTH_TYPE');

  if (!server || !database) {
    if (isAdmin) {
      return null;
    }
    console.error(
      'Missing SQL Server configuration. Please set SQL_SERVER and SQL_DATABASE, or provide SQL_CONNECTION_STRING in your environment.'
    );
    process.exit(1);
  }

  const config = {
    server,
    database,
    port: Number(port || 1433),
    options: {
      encrypt: encrypt === 'true',
      trustServerCertificate: trustCert !== 'false',
    },
    pool: {
      max: Number(poolMax || 10),
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (domain) {
    config.domain = domain;
  }

  if (authType === 'ntlm') {
    if (!user || !password || !domain) {
      if (isAdmin) {
        return null;
      }
      console.error('NTLM authentication requires SQL_USER, SQL_PASSWORD, and SQL_DOMAIN to be set.');
      process.exit(1);
    }
    config.authentication = {
      type: 'ntlm',
      options: {
        userName: user,
        password,
        domain,
      },
    };
  } else if (user && password) {
    config.user = user;
    config.password = password;
  } else if (user || password) {
    if (isAdmin) {
      return null;
    }
    console.warn(
      'Both SQL_USER and SQL_PASSWORD are required for SQL authentication. Either supply both or use SQL_CONNECTION_STRING.'
    );
  }

  return {
    connectionConfig: config,
    connectionLabel: `${server}/${database}${isAdmin ? ' (admin)' : ''}`,
  };
}

async function query(queryText, parameters = []) {
  const pool = await poolConnect;
  const request = pool.request();
  for (const param of parameters) {
    request.input(param.name, param.type, param.value);
  }
  return request.query(queryText);
}

async function ensureTables(pool) {
  try {
    await performSchemaMigrations(pool);
  } catch (error) {
    if (!isSchemaPermissionError(error)) {
      throw error;
    }

    const adminConfig = buildSqlConfig({ admin: true });
    if (!adminConfig) {
      const wrapped = new Error(
        'Schema migration skipped: The SQL login is missing CREATE/ALTER permissions. Provide admin credentials or run sql/schema.sql manually.'
      );
      wrapped.code = 'MIGRATION_PERMISSION_DENIED';
      wrapped.original = error.original || error;
      throw wrapped;
    }

    console.warn('Insufficient permissions detected. Attempting migrations with admin credentials...');
    const adminPool = new sql.ConnectionPool(adminConfig.connectionConfig);
    try {
      await adminPool.connect();
      await performSchemaMigrations(adminPool);
    } finally {
      adminPool.close();
    }

    // Retry with application pool to ensure everything is ready.
    await performSchemaMigrations(pool);
  }
}

async function performSchemaMigrations(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.verification_codes', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.verification_codes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL,
        phone NVARCHAR(50) NOT NULL,
        code VARCHAR(10) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at DATETIME2 NOT NULL,
        used BIT NOT NULL DEFAULT 0,
        used_at DATETIME2 NULL
      );
      CREATE INDEX IX_verification_codes_email_created
        ON dbo.verification_codes (email, created_at);
    END;

    IF OBJECT_ID('dbo.bookings', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.bookings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        phone NVARCHAR(50) NOT NULL,
        check_in DATETIME2 NOT NULL,
        check_out DATETIME2 NOT NULL,
        guests INT NOT NULL,
        room_type NVARCHAR(120) NOT NULL,
        room_number NVARCHAR(20) NULL,
        special_requests NVARCHAR(MAX) NULL,
        verification_code_id INT NULL,
        guest_id INT NULL,
        source NVARCHAR(20) NOT NULL DEFAULT 'online',
        payment_method NVARCHAR(50) NOT NULL,
        payment_reference NVARCHAR(80) NOT NULL,
        payment_amount DECIMAL(10,2) NOT NULL,
        payment_received BIT NOT NULL DEFAULT 0,
        status NVARCHAR(20) NOT NULL DEFAULT 'confirmed',
        checked_in_at DATETIME2 NULL,
        checked_out_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_bookings_verification_codes FOREIGN KEY (verification_code_id)
          REFERENCES dbo.verification_codes(id)
      );
      CREATE INDEX IX_bookings_email_dates
        ON dbo.bookings (email, check_in, check_out);
    END;

    IF OBJECT_ID('dbo.users', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.room_types', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.room_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(120) NOT NULL UNIQUE,
        description NVARCHAR(500) NULL,
        total_rooms INT NOT NULL,
        base_rate DECIMAL(10,2) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.sales_summary', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.sales_summary (
        period_type NVARCHAR(20) NOT NULL PRIMARY KEY,
        period_start DATETIME2 NOT NULL,
        period_end DATETIME2 NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END;

    IF OBJECT_ID('dbo.room_rate_rules', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.room_rate_rules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        room_type_id INT NOT NULL,
        name NVARCHAR(120) NOT NULL,
        description NVARCHAR(500) NULL,
        adjustment_type NVARCHAR(10) NOT NULL,
        adjustment_value DECIMAL(10,2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        min_stay INT NULL,
        max_stay INT NULL,
        active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_room_rate_rules_adjustment CHECK (adjustment_type IN ('flat', 'percent')),
        CONSTRAINT FK_room_rate_rules_room_types FOREIGN KEY (room_type_id) REFERENCES dbo.room_types(id) ON DELETE CASCADE
      );
      CREATE INDEX IX_room_rate_rules_room_type_dates
        ON dbo.room_rate_rules (room_type_id, start_date, end_date);
    END;

    IF OBJECT_ID('dbo.service_orders', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.service_orders (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_code NVARCHAR(16) NOT NULL UNIQUE,
        guest_id INT NULL,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        phone NVARCHAR(50) NULL,
        room_number NVARCHAR(20) NULL,
        order_type NVARCHAR(50) NOT NULL,
        target_department NVARCHAR(80) NOT NULL,
        items NVARCHAR(MAX) NOT NULL,
        special_instructions NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_for DATETIME2 NULL,
        acknowledged_at DATETIME2 NULL,
        completed_at DATETIME2 NULL,
        handled_by NVARCHAR(120) NULL,
        status_note NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_service_orders_guest_profiles FOREIGN KEY (guest_id)
          REFERENCES dbo.guest_profiles(id) ON DELETE SET NULL
      );
      CREATE INDEX IX_service_orders_status_department
        ON dbo.service_orders (status, target_department, created_at DESC);
      CREATE INDEX IX_service_orders_guest_email
        ON dbo.service_orders (email);
    END;

    IF OBJECT_ID('dbo.room_service_tasks', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.room_service_tasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        room_number NVARCHAR(20) NOT NULL,
        task_type NVARCHAR(20) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        details NVARCHAR(MAX) NULL,
        priority NVARCHAR(20) NOT NULL DEFAULT 'normal',
        status NVARCHAR(20) NOT NULL DEFAULT 'scheduled',
        readiness NVARCHAR(20) NULL,
        scheduled_for DATETIME2 NULL,
        started_at DATETIME2 NULL,
        completed_at DATETIME2 NULL,
        reported_by NVARCHAR(120) NULL,
        assigned_to NVARCHAR(120) NULL,
        last_updated_by NVARCHAR(120) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_room_service_tasks_type CHECK (task_type IN ('housekeeping', 'maintenance')),
        CONSTRAINT CK_room_service_tasks_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        CONSTRAINT CK_room_service_tasks_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'))
      );
      CREATE INDEX IX_room_service_tasks_status_type
        ON dbo.room_service_tasks (status, task_type, scheduled_for, room_number);
      CREATE INDEX IX_room_service_tasks_room
        ON dbo.room_service_tasks (room_number, status);
    END;

    IF OBJECT_ID('dbo.guest_profiles', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.guest_profiles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        phone NVARCHAR(50) NULL,
        preferred_room_type NVARCHAR(120) NULL,
        marketing_opt_in BIT NOT NULL DEFAULT 0,
        vip_status NVARCHAR(50) NULL,
        preferences NVARCHAR(MAX) NULL,
        notes NVARCHAR(MAX) NULL,
        total_stays INT NOT NULL DEFAULT 0,
        total_nights INT NOT NULL DEFAULT 0,
        lifetime_value DECIMAL(12,2) NOT NULL DEFAULT 0,
        last_stay_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE UNIQUE INDEX UX_guest_profiles_email
        ON dbo.guest_profiles (email);
    END;
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.bookings', 'U') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.bookings', 'payment_method') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD payment_method NVARCHAR(50) NULL;');
        EXEC ('UPDATE dbo.bookings SET payment_method = ''Pending'' WHERE payment_method IS NULL;');
        EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_method NVARCHAR(50) NOT NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'payment_reference') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD payment_reference NVARCHAR(80) NULL;');
        EXEC ('UPDATE dbo.bookings SET payment_reference = ''N/A'' WHERE payment_reference IS NULL;');
        EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_reference NVARCHAR(80) NOT NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'payment_amount') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD payment_amount DECIMAL(10,2) NULL;');
        EXEC ('UPDATE dbo.bookings SET payment_amount = 0 WHERE payment_amount IS NULL;');
        EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_amount DECIMAL(10,2) NOT NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'payment_received') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD payment_received BIT NULL;');
        EXEC ('UPDATE dbo.bookings SET payment_received = 0 WHERE payment_received IS NULL;');
        EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_received BIT NOT NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'status') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD status NVARCHAR(20) NOT NULL DEFAULT ''confirmed'';');
      END;

      IF COL_LENGTH('dbo.bookings', 'checked_out_at') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD checked_out_at DATETIME2 NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'source') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD source NVARCHAR(20) NOT NULL DEFAULT ''online'';');
      END;

      IF COL_LENGTH('dbo.bookings', 'checked_in_at') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD checked_in_at DATETIME2 NULL;');
      END;

      IF COLUMNPROPERTY(OBJECT_ID('dbo.bookings'), 'verification_code_id', 'AllowsNull') = 0
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN verification_code_id INT NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'guest_id') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD guest_id INT NULL;');
      END;

      IF COL_LENGTH('dbo.bookings', 'room_number') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.bookings ADD room_number NVARCHAR(20) NULL;');
      END;

      IF NOT EXISTS (
        SELECT 1
          FROM sys.foreign_keys
         WHERE name = 'FK_bookings_guest_profiles'
           AND parent_object_id = OBJECT_ID('dbo.bookings')
      )
      BEGIN
        ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_guest_profiles FOREIGN KEY (guest_id) REFERENCES dbo.guest_profiles(id);
      END;
    END;

    IF OBJECT_ID('dbo.service_orders', 'U') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.service_orders', 'handled_by') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD handled_by NVARCHAR(120) NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'total_amount') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD total_amount DECIMAL(10,2) NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'status_note') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD status_note NVARCHAR(MAX) NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'requested_for') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD requested_for DATETIME2 NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'acknowledged_at') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD acknowledged_at DATETIME2 NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'completed_at') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD completed_at DATETIME2 NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'target_department') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD target_department NVARCHAR(80) NULL;');
        EXEC ('UPDATE dbo.service_orders SET target_department = ''guest_services'' WHERE target_department IS NULL;');
        EXEC ('ALTER TABLE dbo.service_orders ALTER COLUMN target_department NVARCHAR(80) NOT NULL;');
      END;

      IF COL_LENGTH('dbo.service_orders', 'order_code') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.service_orders ADD order_code NVARCHAR(16) NULL;');
        EXEC ('
          UPDATE dbo.service_orders
             SET order_code = RIGHT(CONVERT(NVARCHAR(32), NEWID()), 10)
           WHERE order_code IS NULL;
        ');
        EXEC ('ALTER TABLE dbo.service_orders ALTER COLUMN order_code NVARCHAR(16) NOT NULL;');
      END;

      IF NOT EXISTS (
        SELECT 1
          FROM sys.key_constraints
         WHERE name = 'UX_service_orders_code'
           AND parent_object_id = OBJECT_ID('dbo.service_orders')
      )
      BEGIN
        ALTER TABLE dbo.service_orders ADD CONSTRAINT UX_service_orders_code UNIQUE (order_code);
      END;

      IF NOT EXISTS (
        SELECT 1
          FROM sys.indexes
         WHERE name = 'IX_service_orders_status_department'
           AND object_id = OBJECT_ID('dbo.service_orders')
      )
      BEGIN
        EXEC ('CREATE INDEX IX_service_orders_status_department ON dbo.service_orders (status, target_department, created_at DESC);');
      END;

      IF NOT EXISTS (
        SELECT 1
          FROM sys.indexes
         WHERE name = 'IX_service_orders_guest_email'
           AND object_id = OBJECT_ID('dbo.service_orders')
      )
      BEGIN
        EXEC ('CREATE INDEX IX_service_orders_guest_email ON dbo.service_orders (email);');
      END;
    END;

    IF OBJECT_ID('dbo.guest_profiles', 'U') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.guest_profiles', 'preferences') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD preferences NVARCHAR(MAX) NULL;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'notes') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD notes NVARCHAR(MAX) NULL;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'preferred_room_type') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD preferred_room_type NVARCHAR(120) NULL;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'marketing_opt_in') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD marketing_opt_in BIT NOT NULL DEFAULT 0;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'vip_status') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD vip_status NVARCHAR(50) NULL;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'total_stays') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD total_stays INT NOT NULL DEFAULT 0;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'total_nights') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD total_nights INT NOT NULL DEFAULT 0;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'lifetime_value') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD lifetime_value DECIMAL(12,2) NOT NULL DEFAULT 0;');
      END;

      IF COL_LENGTH('dbo.guest_profiles', 'last_stay_at') IS NULL
      BEGIN
        EXEC ('ALTER TABLE dbo.guest_profiles ADD last_stay_at DATETIME2 NULL;');
      END;
    END;
  `);

  await pool.request().query(`
    IF OBJECT_ID('dbo.guest_profiles', 'U') IS NOT NULL
    BEGIN
      ;WITH guest_seed AS (
        SELECT
          b.email,
          MAX(b.full_name) AS latest_full_name,
          MAX(b.phone) AS latest_phone,
          COUNT(1) AS total_stays,
          SUM(CASE WHEN b.check_in IS NOT NULL AND b.check_out IS NOT NULL
                   THEN DATEDIFF(DAY, b.check_in, b.check_out)
                   ELSE 0 END) AS total_nights,
          SUM(ISNULL(b.payment_amount, 0)) AS total_amount,
          MAX(b.check_out) AS last_stay_at
        FROM dbo.bookings b
        WHERE b.email IS NOT NULL
        GROUP BY b.email
      )
      INSERT INTO dbo.guest_profiles (full_name, email, phone, total_stays, total_nights, lifetime_value, last_stay_at)
      SELECT
        gs.latest_full_name,
        gs.email,
        gs.latest_phone,
        gs.total_stays,
        gs.total_nights,
        gs.total_amount,
        gs.last_stay_at
      FROM guest_seed gs
      WHERE NOT EXISTS (SELECT 1 FROM dbo.guest_profiles gp WHERE gp.email = gs.email);

      UPDATE b
        SET guest_id = gp.id
      FROM dbo.bookings b
      INNER JOIN dbo.guest_profiles gp
              ON gp.email = b.email
      WHERE b.guest_id IS NULL
        AND b.email IS NOT NULL;

      UPDATE gp
        SET
          gp.total_stays = COALESCE(agg.total_stays, 0),
          gp.total_nights = COALESCE(agg.total_nights, 0),
          gp.lifetime_value = COALESCE(agg.total_amount, 0),
          gp.last_stay_at = agg.last_stay_at,
          gp.updated_at = SYSUTCDATETIME()
      FROM dbo.guest_profiles gp
      INNER JOIN (
        SELECT
          gp_inner.email,
          COUNT(b_inner.id) AS total_stays,
          SUM(CASE WHEN b_inner.check_in IS NOT NULL AND b_inner.check_out IS NOT NULL
                   THEN DATEDIFF(DAY, b_inner.check_in, b_inner.check_out)
                   ELSE 0 END) AS total_nights,
          SUM(ISNULL(b_inner.payment_amount, 0)) AS total_amount,
          MAX(b_inner.check_out) AS last_stay_at
        FROM dbo.guest_profiles gp_inner
        LEFT JOIN dbo.bookings b_inner
          ON b_inner.guest_id = gp_inner.id
        GROUP BY gp_inner.email
      ) AS agg
        ON gp.email = agg.email;
    END;
  `);
}

async function ensureDefaultUsers(pool) {
  const tasks = [];
  const staffPassword = process.env.STAFF_DEFAULT_PASSWORD;
  if (staffPassword) {
    tasks.push(upsertUser(pool, STAFF_USERNAME, staffPassword, 'staff'));
  } else {
    console.warn(
      'STAFF_DEFAULT_PASSWORD is not set. Staff portal will not have a default credential until you add one.'
    );
  }

  const ownerPassword = process.env.OWNER_DEFAULT_PASSWORD;
  if (ownerPassword) {
    tasks.push(upsertUser(pool, OWNER_USERNAME, ownerPassword, 'owner'));
  } else {
    console.warn(
      'OWNER_DEFAULT_PASSWORD is not set. Owner portal will not have a default credential until you add one.'
    );
  }

  const cashierPassword = process.env.CASHIER_DEFAULT_PASSWORD;
  if (cashierPassword) {
    tasks.push(upsertUser(pool, CASHIER_USERNAME, cashierPassword, 'cashier'));
  } else {
    console.warn(
      'CASHIER_DEFAULT_PASSWORD is not set. Cashier portal will not have a default credential until you add one.'
    );
  }

  const restaurantPassword = process.env.RESTAURANT_DEFAULT_PASSWORD;
  if (restaurantPassword) {
    tasks.push(upsertUser(pool, RESTAURANT_USERNAME, restaurantPassword, 'restaurant'));
  } else {
    console.warn(
      'RESTAURANT_DEFAULT_PASSWORD is not set. Restaurant portal will not have a default credential until you add one.'
    );
  }

  const housekeepingPassword = process.env.HOUSEKEEPING_DEFAULT_PASSWORD;
  if (housekeepingPassword) {
    tasks.push(upsertUser(pool, HOUSEKEEPING_USERNAME, housekeepingPassword, 'housekeeping'));
  } else {
    console.warn(
      'HOUSEKEEPING_DEFAULT_PASSWORD is not set. Housekeeping portal will not have a default credential until you add one.'
    );
  }

  const maintenancePassword = process.env.MAINTENANCE_DEFAULT_PASSWORD;
  if (maintenancePassword) {
    tasks.push(upsertUser(pool, MAINTENANCE_USERNAME, maintenancePassword, 'maintenance'));
  } else {
    console.warn(
      'MAINTENANCE_DEFAULT_PASSWORD is not set. Maintenance portal will not have a default credential until you add one.'
    );
  }

  await Promise.all(tasks);
}

async function upsertUser(pool, username, plainTextPassword, role) {
  const existing = await pool
    .request()
    .input('username', sql.NVarChar(100), username)
    .query(`SELECT id, password_hash FROM dbo.users WHERE username = @username`);

  if (existing.recordset.length === 0) {
    const passwordHash = await bcrypt.hash(plainTextPassword, 10);
    await pool
      .request()
      .input('username', sql.NVarChar(100), username)
      .input('password_hash', sql.NVarChar(255), passwordHash)
      .input('role', sql.NVarChar(20), role)
      .query(
        `INSERT INTO dbo.users (username, password_hash, role) VALUES (@username, @password_hash, @role)`
      );
    console.log(`Created default ${role} account "${username}".`);
    return;
  }

  const currentHash = existing.recordset[0].password_hash;
  const matches = await bcrypt.compare(plainTextPassword, currentHash);
  if (!matches) {
    if (!FORCE_RESET_DEFAULT_CREDENTIALS) {
      console.info(
        `Skipping default password update for ${role} account "${username}" because FORCE_RESET_DEFAULT_CREDENTIALS is not enabled.`
      );
      return;
    }
    const passwordHash = await bcrypt.hash(plainTextPassword, 10);
    await pool
      .request()
      .input('username', sql.NVarChar(100), username)
      .input('password_hash', sql.NVarChar(255), passwordHash)
      .query(`UPDATE dbo.users SET password_hash = @password_hash WHERE username = @username`);
    console.log(`Updated password for ${role} account "${username}".`);
  }
}

async function verifyRequiredTables(pool) {
  const result = await pool.request().query(`
    SELECT name FROM sys.tables WHERE name IN ('verification_codes', 'bookings', 'users', 'room_types', 'sales_summary', 'guest_profiles', 'service_orders', 'room_service_tasks');
  `);

  const tableNames = new Set(result.recordset.map((row) => row.name));
  const missing = [
    'verification_codes',
    'bookings',
    'users',
    'room_types',
    'sales_summary',
    'guest_profiles',
    'service_orders',
    'room_service_tasks',
  ].filter((name) => !tableNames.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Required database tables are missing (${missing.join(
        ', '
      )}). Run sql/schema.sql with a privileged account to create them before starting the server.`
    );
  }
}

function isSchemaPermissionError(error) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.number === 262 || message.includes('permission denied') || message.includes('create table');
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

function normalizeDateOnly(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (`${year}-${month}-${day}` !== trimmed) {
    return null;
  }

  return trimmed;
}

function resolveSalesWindow(requestedWindow) {
  const now = new Date();
  const normalized =
    typeof requestedWindow === 'string' && SALES_PERIOD_KEYS.has(requestedWindow.toLowerCase())
      ? requestedWindow.toLowerCase()
      : 'daily';

  const period = getPeriodDefinition(normalized);
  const range = calculateSalesPeriodRange(period, now);

  return {
    windowKey: normalized,
    label: period.label,
    start: range.start,
    end: range.end,
  };
}

function calculateSalesWindowStart(referenceDate, windowKey) {
  const period = getPeriodDefinition(windowKey);
  return calculateSalesPeriodRange(period, referenceDate).start;
}

function invalidateRoomTypesCache() {
  roomTypesCache.rows = null;
  roomTypesCache.timestamp = 0;
}

function mapRoomTypeRecord(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    totalRooms: Number(row.total_rooms ?? row.totalRooms ?? 0),
    baseRate: row.base_rate == null ? null : Number(row.base_rate),
    sleeps: row.sleeps == null ? null : Number(row.sleeps),
    brochureUrl: row.brochure_url || row.brochureUrl || '',
    imageUrl: row.image_url || row.imageUrl || '',
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function formatRoomTypeResponse(roomType) {
  return {
    id: roomType.id,
    name: roomType.name,
    description: roomType.description || '',
    totalRooms: Number(roomType.totalRooms || 0),
    baseRate: roomType.baseRate != null ? Number(roomType.baseRate) : null,
    sleeps: roomType.sleeps != null ? Number(roomType.sleeps) : null,
    brochureUrl: roomType.brochureUrl || '',
    imageUrl: roomType.imageUrl || '',
    updatedAt: roomType.updatedAt ? roomType.updatedAt.toISOString() : null,
    createdAt: roomType.createdAt ? roomType.createdAt.toISOString() : null,
  };
}

function parseBooleanInput(value) {
  if (value === undefined) {
    return { provided: false, value: undefined, invalid: false };
  }

  if (value === null) {
    return { provided: true, value: false, invalid: false };
  }

  if (typeof value === 'boolean') {
    return { provided: true, value, invalid: false };
  }

  if (typeof value === 'number') {
    return { provided: true, value: value !== 0, invalid: false };
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return { provided: false, value: undefined, invalid: false };
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return { provided: true, value: true, invalid: false };
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return { provided: true, value: false, invalid: false };
    }
  }

  return { provided: true, value: undefined, invalid: true };
}

function serializeGuestPreferencesInput(preferences) {
  if (preferences === undefined) {
    return { provided: false };
  }

  if (preferences === null) {
    return { provided: true, value: null };
  }

  let serialized;
  if (typeof preferences === 'string') {
    const trimmed = preferences.trim();
    if (!trimmed) {
      return { provided: true, value: null };
    }
    try {
      const parsed = JSON.parse(trimmed);
      serialized = JSON.stringify(parsed);
    } catch (_error) {
      serialized = JSON.stringify(trimmed);
    }
  } else if (typeof preferences === 'object') {
    try {
      serialized = JSON.stringify(preferences);
    } catch (_error) {
      return { provided: true, error: 'Guest preferences must be valid JSON data.' };
    }
  } else {
    return { provided: true, error: 'Guest preferences must be an object, array, string, or null.' };
  }

  if (serialized && serialized.length > 4000) {
    return {
      provided: true,
      error: 'Guest preferences cannot exceed 4000 characters when stored.',
    };
  }

  return { provided: true, value: serialized };
}

function normalizeServiceOrderItems(rawItems, fallbackText) {
  const collected = [];

  const pushNormalized = (name, quantity, notes) => {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return;
    }
    const parsedQuantity = Number.parseInt(quantity, 10);
    const safeQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.min(parsedQuantity, 99) : 1;
    const trimmedNotes = notes == null ? null : String(notes).trim() || null;
    collected.push({
      name: trimmedName,
      quantity: safeQuantity,
      notes: trimmedNotes,
    });
  };

  const handleStructuredItem = (item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const candidateName = item.name ?? item.item ?? item.title ?? '';
    const candidateQuantity = item.quantity ?? item.qty ?? item.count ?? 1;
    const candidateNotes = item.notes ?? item.note ?? item.instructions ?? item.specialInstructions ?? null;
    pushNormalized(candidateName, candidateQuantity, candidateNotes);
  };

  if (Array.isArray(rawItems)) {
    for (const entry of rawItems) {
      if (typeof entry === 'string') {
        const parsed = parseOrderItemsText(entry);
        for (const line of parsed) {
          pushNormalized(line.name, line.quantity, line.notes);
        }
      } else {
        handleStructuredItem(entry);
      }
    }
  } else if (rawItems && typeof rawItems === 'object') {
    handleStructuredItem(rawItems);
  } else if (typeof rawItems === 'string') {
    const parsed = parseOrderItemsText(rawItems);
    for (const line of parsed) {
      pushNormalized(line.name, line.quantity, line.notes);
    }
  }

  if (!collected.length && typeof fallbackText === 'string') {
    const parsed = parseOrderItemsText(fallbackText);
    for (const line of parsed) {
      pushNormalized(line.name, line.quantity, line.notes);
    }
  }

  if (!collected.length) {
    throw new Error('Add at least one item to your request.');
  }

  const limited = collected.slice(0, 50);
  return {
    items: limited,
    json: JSON.stringify(limited),
    summary: formatOrderItemsSummary(limited),
  };
}

function parseOrderItemsText(text) {
  if (typeof text !== 'string') {
    return [];
  }

  const segments = text
    .split(/\r?\n|;/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const parsed = [];
  for (const segment of segments) {
    let working = segment;
    let notes = null;

    const parenMatch = working.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) {
      notes = parenMatch[1].trim();
      working = working.slice(0, parenMatch.index).trim();
    } else {
      const dashIndex = working.indexOf(' - ');
      if (dashIndex > -1) {
        notes = working.slice(dashIndex + 3).trim();
        working = working.slice(0, dashIndex).trim();
      }
    }

    const quantityMatch = working.match(/^(\d{1,2})\s*(?:x|×)\s*(.+)$/i);
    let quantity = 1;
    if (quantityMatch) {
      quantity = Number.parseInt(quantityMatch[1], 10);
      working = quantityMatch[2].trim();
    }

    const trimmedName = working.trim();
    if (!trimmedName) {
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      quantity = 1;
    }

    parsed.push({
      name: trimmedName,
      quantity: Math.min(quantity, 99),
      notes: notes || null,
    });
  }

  return parsed;
}

function parseOptionalDateTime(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

async function generateUniqueOrderCode(pool) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateOrderCodeCandidate();
    const existsResult = await pool
      .request()
      .input('order_code', sql.NVarChar(16), candidate)
      .query(`SELECT 1 FROM dbo.service_orders WHERE order_code = @order_code`);
    if (existsResult.recordset.length === 0) {
      return candidate;
    }
  }
  throw new Error('Unable to reserve a unique order code at this time.');
}

function generateOrderCodeCandidate() {
  return crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, ORDER_CODE_LENGTH);
}

function resolveTargetDepartment(orderType, requestedDepartment) {
  const requested = typeof requestedDepartment === 'string' ? requestedDepartment.trim().toLowerCase() : '';
  if (requested) {
    return requested;
  }
  const normalizedType = typeof orderType === 'string' ? orderType.trim().toLowerCase() : '';
  return ORDER_DEPARTMENT_DEFAULTS[normalizedType] || 'guest_services';
}

function resolveDepartmentEmail(department) {
  const normalized = typeof department === 'string' ? department.trim().toLowerCase() : '';
  const direct = ORDER_DEPARTMENT_EMAILS[normalized];
  if (direct) {
    return direct;
  }
  if (ORDER_DEPARTMENT_EMAILS.guest_services) {
    return ORDER_DEPARTMENT_EMAILS.guest_services;
  }
  if (ORDER_DEPARTMENT_EMAILS.restaurant) {
    return ORDER_DEPARTMENT_EMAILS.restaurant;
  }
  const fallback =
    (process.env.SERVICE_DESK_EMAIL ||
      process.env.RESTAURANT_EMAIL ||
      process.env.SMTP_USER ||
      '').trim() || null;
  return fallback;
}

async function sendServiceOrderNotification(order) {
  if (!order) {
    return;
  }

  const summary = order.itemsSummary || formatOrderItemsSummary(order.items);
  const recipient = resolveDepartmentEmail(order.targetDepartment);

  const subject = `New ${humanizeOrderLabel(order.orderType)} request (${order.orderCode})`;
  const bodyLines = [
    `Order code: ${order.orderCode}`,
    `Requested by: ${order.fullName}`,
    `Email: ${order.email}${order.phone ? ` | Phone: ${order.phone}` : ''}`,
    order.roomNumber ? `Room: ${order.roomNumber}` : null,
    `Department: ${humanizeOrderLabel(order.targetDepartment)}`,
    `Items: ${summary || 'n/a'}`,
    order.specialInstructions ? `Instructions: ${order.specialInstructions}` : null,
    order.requestedFor ? `Requested for: ${order.requestedFor}` : null,
    `Submitted at: ${order.createdAt || new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const fromAddress =
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER ? `"Harborview Service Desk" <${process.env.SMTP_USER}>` : undefined);

  if (!recipient || !transporter) {
    console.info('[service-orders] Notification', { recipient: recipient || 'none', subject, body: bodyLines });
    return;
  }

  await transporter.sendMail({
    from: fromAddress,
    to: recipient,
    replyTo: order.email,
    subject,
    text: bodyLines,
  });
}

function safeParseOrderItems(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    const normalized = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        normalized.push(...parseOrderItemsText(entry));
      } else if (entry && typeof entry === 'object') {
        const name = String(entry.name ?? entry.item ?? entry.title ?? '').trim();
        if (!name) {
          continue;
        }
        const rawQuantity = entry.quantity ?? entry.qty ?? entry.count ?? 1;
        const parsedQuantity = Number.parseInt(rawQuantity, 10);
        const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.min(parsedQuantity, 99) : 1;
        const rawNotes = entry.notes ?? entry.note ?? entry.instructions ?? entry.specialInstructions ?? null;
        const notes = rawNotes == null ? null : String(rawNotes).trim() || null;
        normalized.push({ name, quantity, notes });
      }
    }
    return normalized;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return safeParseOrderItems(parsed);
      }
    } catch (_error) {
      // treat as plain text
    }
    return parseOrderItemsText(value);
  }

  if (typeof value === 'object') {
    return safeParseOrderItems([value]);
  }

  return [];
}

function formatOrderItemsSummary(items) {
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        const base = `${item.quantity > 1 ? `${item.quantity} \u00D7 ` : ''}${item.name}`;
        return item.notes ? `${base} (${item.notes})` : base;
      })
      .join('; ');
  }
  if (typeof items === 'string') {
    return items.trim();
  }
  return '';
}

function generateRoomCode(roomTypeName, sequence, padding = 2) {
  const prefix = String(roomTypeName || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3);
  const safePrefix = prefix || 'RM';
  const width = Number.isFinite(padding) ? Math.max(2, Math.min(4, padding)) : 2;
  const padded = String(sequence).padStart(width, '0');
  return `${safePrefix}-${padded}`;
}

function mapServiceOrderRow(row) {
  if (!row) {
    return null;
  }

  const items = safeParseOrderItems(row.items);
  const summary = formatOrderItemsSummary(items);

  return {
    id: row.id,
    orderCode: row.order_code,
    guestId: row.guest_id == null ? null : Number(row.guest_id),
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    roomNumber: row.room_number,
    orderType: row.order_type,
    targetDepartment: row.target_department,
    items,
    itemsSummary: summary || (typeof row.items === 'string' ? row.items : ''),
    specialInstructions: row.special_instructions || null,
    status: row.status,
    requestedFor: row.requested_for ? new Date(row.requested_for).toISOString() : null,
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
    handledBy: row.handled_by || null,
    statusNote: row.status_note || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function mapServiceTaskRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    roomNumber: row.room_number,
    taskType: row.task_type,
    title: row.title,
    details: row.details || null,
    priority: row.priority,
    status: row.status,
    readiness: row.readiness || null,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    reportedBy: row.reported_by || null,
    assignedTo: row.assigned_to || null,
    lastUpdatedBy: row.last_updated_by || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function buildServiceTaskFilters(filters = {}) {
  const clauses = [];
  const parameters = [];

  const typeFilter =
    typeof filters.type === 'string' && filters.type.trim().toLowerCase() !== 'all'
      ? filters.type.trim().toLowerCase()
      : '';
  if (typeFilter) {
    if (!SERVICE_TASK_TYPES.has(typeFilter)) {
      throw new Error('INVALID_TASK_TYPE');
    }
    clauses.push('task_type = @task_type');
    parameters.push({ name: 'task_type', type: sql.NVarChar(20), value: typeFilter });
  }

  const statusFilter =
    typeof filters.status === 'string' && filters.status.trim().toLowerCase() ? filters.status.trim().toLowerCase() : '';
  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'active') {
      clauses.push(
        `status IN (${Array.from(SERVICE_TASK_ACTIVE_STATUSES)
          .map((status, index) => {
            const paramName = `active_status_${index}`;
            parameters.push({ name: paramName, type: sql.NVarChar(20), value: status });
            return `@${paramName}`;
          })
          .join(', ')})`
      );
    } else {
      if (!SERVICE_TASK_STATUSES.has(statusFilter)) {
        throw new Error('INVALID_TASK_STATUS');
      }
      clauses.push('status = @task_status');
      parameters.push({ name: 'task_status', type: sql.NVarChar(20), value: statusFilter });
    }
  }

  const readinessFilter =
    typeof filters.readiness === 'string' && filters.readiness.trim().toLowerCase() !== 'all'
      ? filters.readiness.trim().toLowerCase()
      : '';
  if (readinessFilter) {
    if (!ROOM_READINESS_STATES.has(readinessFilter)) {
      throw new Error('INVALID_TASK_READINESS');
    }
    clauses.push('readiness = @readiness');
    parameters.push({ name: 'readiness', type: sql.NVarChar(20), value: readinessFilter });
  }

  const priorityFilter =
    typeof filters.priority === 'string' && filters.priority.trim().toLowerCase()
      ? filters.priority.trim().toLowerCase()
      : '';
  if (priorityFilter) {
    if (!SERVICE_TASK_PRIORITIES.has(priorityFilter)) {
      throw new Error('INVALID_TASK_PRIORITY');
    }
    clauses.push('priority = @priority');
    parameters.push({ name: 'priority', type: sql.NVarChar(20), value: priorityFilter });
  }

  const roomFilter =
    typeof filters.roomNumber === 'string' && filters.roomNumber.trim()
      ? filters.roomNumber.trim()
      : '';
  if (roomFilter) {
    clauses.push('UPPER(room_number) LIKE UPPER(@room_number)');
    parameters.push({ name: 'room_number', type: sql.NVarChar(50), value: `%${roomFilter}%` });
  }

  return { clauses, parameters };
}

function humanizeOrderLabel(value) {
  if (!value) {
    return '';
  }
  return String(value)
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ')
    .trim();
}

function safeParseGuestPreferences(value) {
  if (value == null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

function calculateStayNights(checkInDate, checkOutDate) {
  if (!(checkInDate instanceof Date) || Number.isNaN(checkInDate.getTime())) {
    return 0;
  }
  if (!(checkOutDate instanceof Date) || Number.isNaN(checkOutDate.getTime())) {
    return 0;
  }

  const diffMs = checkOutDate.getTime() - checkInDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  const nights = diffMs / (24 * 60 * 60 * 1000);
  return Math.max(1, Math.round(nights));
}

function calculateStayNightsFromRow(row) {
  if (!row?.check_in || !row?.check_out) {
    return 0;
  }

  const checkInDate = new Date(row.check_in);
  const checkOutDate = new Date(row.check_out);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return 0;
  }

  return calculateStayNights(checkInDate, checkOutDate);
}

function roundCurrency(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value * 100) / 100;
  return Number.isNaN(rounded) ? 0 : rounded;
}

function buildBillingEntry(row, ordersByEmail) {
  const nights = calculateStayNightsFromRow(row);
  const baseRate = row.base_rate != null ? Number(row.base_rate) : null;
  const accommodationRaw = baseRate != null && nights > 0 ? baseRate * nights : 0;
  const accommodationTotal = roundCurrency(accommodationRaw);
  const rateSource = baseRate != null ? 'room_type' : 'unspecified';

  const emailKey = (row.email || '').toLowerCase();
  const relatedOrders = ordersByEmail.get(emailKey) || [];

  let mealsRaw = 0;
  let servicesRaw = 0;
  const serviceOrders = relatedOrders.map((order) => {
    const total = Number(order.totalAmount || 0);
    if (order.orderType === 'food') {
      mealsRaw += total;
    } else {
      servicesRaw += total;
    }
    return {
      id: order.id,
      orderCode: order.orderCode,
      orderType: order.orderType,
      status: order.status,
      totalAmount: roundCurrency(total),
      itemsSummary: order.itemsSummary,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
    };
  });

  const mealsTotal = roundCurrency(mealsRaw);
  const servicesTotal = roundCurrency(servicesRaw);
  const extrasTotal = roundCurrency(mealsRaw + servicesRaw);
  const depositAmount = roundCurrency(Number(row.payment_amount || 0));
  const totalDue = roundCurrency(accommodationTotal + extrasTotal);
  const balanceDue = roundCurrency(totalDue - depositAmount);

  return {
    bookingId: row.id,
    guest: {
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
    },
    roomType: row.room_type,
    guests: row.guests,
    status: row.status,
    checkIn: row.check_in ? new Date(row.check_in).toISOString() : null,
    checkOut: row.check_out ? new Date(row.check_out).toISOString() : null,
    nights,
    accommodation: {
      nightlyRate: baseRate != null ? roundCurrency(baseRate) : null,
      rateSource,
      nights,
      total: accommodationTotal,
    },
    meals: {
      total: mealsTotal,
    },
    services: {
      total: servicesTotal,
    },
    extrasTotal,
    totalDue,
    payment: {
      method: row.payment_method,
      reference: row.payment_reference,
      amount: depositAmount,
      received: Boolean(row.payment_received),
      source: row.source,
    },
    balanceDue,
    serviceOrders,
    specialRequests: row.special_requests || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function fetchBillingSummary(pool, options = {}) {
  const bookingRequest = pool.request();
  let whereClause = '';
  if (options.bookingId) {
    bookingRequest.input('bookingId', sql.Int, options.bookingId);
    whereClause = 'WHERE b.id = @bookingId';
  }

  const bookingsResult = await bookingRequest.query(`
    SELECT b.*, rt.base_rate
      FROM dbo.bookings b
      LEFT JOIN dbo.room_types rt ON LOWER(rt.name) = LOWER(b.room_type)
      ${whereClause}
      ORDER BY b.check_in DESC;
  `);

  if (options.bookingId && bookingsResult.recordset.length === 0) {
    return null;
  }

  const serviceOrdersResult = await pool
    .request()
    .query(`SELECT * FROM dbo.service_orders WHERE status <> 'cancelled'`);

  const serviceOrders = serviceOrdersResult.recordset
    .map((row) => mapServiceOrderRow(row))
    .filter(Boolean);

  const ordersByEmail = new Map();
  for (const order of serviceOrders) {
    const emailKey = (order.email || '').toLowerCase();
    if (!emailKey) {
      continue;
    }
    if (!ordersByEmail.has(emailKey)) {
      ordersByEmail.set(emailKey, []);
    }
    ordersByEmail.get(emailKey).push(order);
  }

  const summary = bookingsResult.recordset.map((row) => buildBillingEntry(row, ordersByEmail));

  if (options.bookingId) {
    return summary[0] || null;
  }

  const totals = summary.reduce(
    (acc, entry) => {
      acc.accommodation += entry.accommodation.total;
      acc.meals += entry.meals.total;
      acc.services += entry.services.total;
      acc.extras += entry.extrasTotal;
      acc.payments += entry.payment.amount;
      acc.balance += entry.balanceDue;
      return acc;
    },
    { accommodation: 0, meals: 0, services: 0, extras: 0, payments: 0, balance: 0 }
  );

  Object.keys(totals).forEach((key) => {
    totals[key] = roundCurrency(totals[key]);
  });

  return {
    summary,
    totals,
    paymentOptions: ['Cash', 'GCash', 'PayMaya', 'Credit Card'],
    generatedAt: new Date().toISOString(),
  };
}

async function upsertGuestProfile(sqlContext, profile) {
  if (!profile?.email) {
    throw new Error('Guest email is required to upsert a profile.');
  }

  const trimmedEmail = profile.email.trim();
  const trimmedFullName =
    typeof profile.fullName === 'string' && profile.fullName.trim().length > 0
      ? profile.fullName.trim()
      : trimmedEmail;

  const phoneProvided = profile.phone !== undefined;
  const normalizedPhone =
    profile.phone === null
      ? null
      : phoneProvided
      ? String(profile.phone).trim() || null
      : undefined;

  const roomProvided = profile.preferredRoomType !== undefined;
  const normalizedRoom =
    profile.preferredRoomType === null
      ? null
      : roomProvided
      ? String(profile.preferredRoomType).trim() || null
      : undefined;

  const notesProvided = profile.notes !== undefined;
  const normalizedNotes =
    profile.notes === null
      ? null
      : notesProvided
      ? String(profile.notes).trim() || null
      : undefined;

  const vipProvided = profile.vipStatus !== undefined;
  const normalizedVip =
    profile.vipStatus === null
      ? null
      : vipProvided
      ? String(profile.vipStatus).trim() || null
      : undefined;

  const marketingProvided = profile.marketingOptIn !== undefined;
  const marketingValue = profile.marketingOptIn === true;
  const preferencesProvided = profile.preferences !== undefined;
  const preferencesValue = profile.preferences === undefined ? undefined : profile.preferences;

  const lookup = await sqlContext
    .request()
    .input('email', sql.NVarChar(255), trimmedEmail)
    .query(`SELECT id FROM dbo.guest_profiles WHERE email = @email`);

  if (lookup.recordset.length === 0) {
    const insertRequest = sqlContext
      .request()
      .input('full_name', sql.NVarChar(255), trimmedFullName)
      .input('email', sql.NVarChar(255), trimmedEmail)
      .input('phone', sql.NVarChar(50), normalizedPhone ?? null)
      .input('preferred_room_type', sql.NVarChar(120), normalizedRoom ?? null)
      .input('marketing_opt_in', sql.Bit, marketingProvided ? (marketingValue ? 1 : 0) : 0)
      .input('vip_status', sql.NVarChar(50), normalizedVip ?? null)
      .input('notes', sql.NVarChar(sql.MAX), normalizedNotes ?? null)
      .input('preferences', sql.NVarChar(sql.MAX), preferencesValue ?? null);

    const insertResult = await insertRequest.query(`
      INSERT INTO dbo.guest_profiles
        (full_name, email, phone, preferred_room_type, marketing_opt_in, vip_status, notes, preferences)
      OUTPUT INSERTED.id
      VALUES
        (@full_name, @email, @phone, @preferred_room_type, @marketing_opt_in, @vip_status, @notes, @preferences);
    `);

    return { guestId: insertResult.recordset[0].id };
  }

  const guestId = lookup.recordset[0].id;
  const updateRequest = sqlContext.request();
  updateRequest.input('id', sql.Int, guestId);
  updateRequest.input('full_name', sql.NVarChar(255), trimmedFullName);
  const setClauses = ['full_name = @full_name', 'updated_at = SYSUTCDATETIME()'];

  if (phoneProvided) {
    updateRequest.input('phone', sql.NVarChar(50), normalizedPhone ?? null);
    setClauses.push('phone = @phone');
  }

  if (roomProvided) {
    updateRequest.input('preferred_room_type', sql.NVarChar(120), normalizedRoom ?? null);
    setClauses.push('preferred_room_type = @preferred_room_type');
  }

  if (vipProvided) {
    updateRequest.input('vip_status', sql.NVarChar(50), normalizedVip ?? null);
    setClauses.push('vip_status = @vip_status');
  }

  if (notesProvided) {
    updateRequest.input('notes', sql.NVarChar(sql.MAX), normalizedNotes ?? null);
    setClauses.push('notes = @notes');
  }

  if (marketingProvided) {
    updateRequest.input('marketing_opt_in', sql.Bit, marketingValue ? 1 : 0);
    setClauses.push('marketing_opt_in = @marketing_opt_in');
  }

  if (preferencesProvided) {
    updateRequest.input('preferences', sql.NVarChar(sql.MAX), preferencesValue ?? null);
    setClauses.push('preferences = @preferences');
  }

  await updateRequest.query(
    `UPDATE dbo.guest_profiles
        SET ${setClauses.join(', ')}
      WHERE id = @id;`
  );

  return { guestId };
}

async function recordGuestStay(sqlContext, details) {
  if (!details?.guestId) {
    return;
  }

  const nights = calculateStayNights(details.checkInDate, details.checkOutDate);
  const amount = Number.isFinite(details.paymentAmount) ? Number(details.paymentAmount) : 0;

  await sqlContext
    .request()
    .input('guest_id', sql.Int, details.guestId)
    .input('nights', sql.Int, nights)
    .input('amount', sql.Decimal(12, 2), amount)
    .input('last_stay_at', sql.DateTime2, details.checkOutDate || null)
    .input(
      'preferred_room_type',
      sql.NVarChar(120),
      details.preferredRoomType ? String(details.preferredRoomType).trim() || null : null
    )
    .query(
      `UPDATE dbo.guest_profiles
          SET total_stays = total_stays + 1,
              total_nights = total_nights + @nights,
              lifetime_value = lifetime_value + @amount,
              preferred_room_type = COALESCE(@preferred_room_type, preferred_room_type),
              last_stay_at = CASE
                WHEN last_stay_at IS NULL OR (@last_stay_at IS NOT NULL AND @last_stay_at > last_stay_at)
                  THEN @last_stay_at
                ELSE last_stay_at
              END,
              updated_at = SYSUTCDATETIME()
        WHERE id = @guest_id;`
    );
}

function mapGuestProfileRow(row) {
  if (!row) {
    return null;
  }

  const preferences = safeParseGuestPreferences(row.preferences);
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    preferredRoomType: row.preferred_room_type || null,
    marketingOptIn: Boolean(row.marketing_opt_in),
    vipStatus: row.vip_status || null,
    notes: row.notes || null,
    preferences,
    totalStays: Number(row.total_stays ?? 0),
    totalNights: Number(row.total_nights ?? 0),
    lifetimeValue: Number(row.lifetime_value ?? 0),
    lastStayAt: row.last_stay_at ? new Date(row.last_stay_at).toISOString() : null,
    nextStayAt: row.next_check_in ? new Date(row.next_check_in).toISOString() : null,
    lastRoomType: row.last_room_type || row.preferred_room_type || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function isUniqueConstraintError(error) {
  return error?.number === 2627 || error?.number === 2601;
}

async function loadRoomTypes(pool, options = {}) {
  const forceRefresh = options.forceRefresh === true;
  const now = Date.now();
  if (!forceRefresh && roomTypesCache.rows && now - roomTypesCache.timestamp < ROOM_TYPES_CACHE_TTL_MS) {
    return roomTypesCache.rows;
  }

  const result = await pool
    .request()
    .query(
      `SELECT id, name, description, total_rooms, base_rate, sleeps, brochure_url, image_url, created_at, updated_at
         FROM dbo.room_types
        ORDER BY name;`
    );

  roomTypesCache = {
    rows: result.recordset.map(mapRoomTypeRecord),
    timestamp: Date.now(),
  };
  return roomTypesCache.rows;
}

async function getRoomTypeById(pool, id) {
  if (!id) {
    return null;
  }
  const roomTypes = await loadRoomTypes(pool);
  return roomTypes.find((roomType) => roomType.id === Number(id)) || null;
}

async function getRoomTypeByName(pool, name) {
  if (!name) {
    return null;
  }
  const normalized = name.trim().toLowerCase();
  const roomTypes = await loadRoomTypes(pool);
  return roomTypes.find((roomType) => roomType.name.toLowerCase() === normalized) || null;
}

function mapRateRuleRecord(row) {
  return {
    id: row.id,
    roomTypeId: row.room_type_id,
    name: row.name,
    description: row.description || '',
    adjustmentType: row.adjustment_type,
    adjustmentValue: Number(row.adjustment_value || 0),
    startDate: row.start_date ? new Date(row.start_date) : null,
    endDate: row.end_date ? new Date(row.end_date) : null,
    minStay: row.min_stay != null ? Number(row.min_stay) : null,
    maxStay: row.max_stay != null ? Number(row.max_stay) : null,
    active: Boolean(row.active),
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function formatRateRuleResponse(rule) {
  return {
    id: rule.id,
    roomTypeId: rule.roomTypeId,
    name: rule.name,
    description: rule.description || '',
    adjustmentType: rule.adjustmentType,
    adjustmentValue: rule.adjustmentValue,
    startDate: rule.startDate ? rule.startDate.toISOString().slice(0, 10) : null,
    endDate: rule.endDate ? rule.endDate.toISOString().slice(0, 10) : null,
    minStay: rule.minStay,
    maxStay: rule.maxStay,
    active: Boolean(rule.active),
    updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null,
    createdAt: rule.createdAt ? rule.createdAt.toISOString() : null,
  };
}

async function loadRateRulesForRoomType(pool, roomTypeId, options = {}) {
  const request = pool.request().input('room_type_id', sql.Int, roomTypeId);
  const filters = ['room_type_id = @room_type_id'];

  if (options.activeOnly) {
    filters.push('active = 1');
  }

  if (options.dateRange) {
    request.input('windowStart', sql.Date, options.dateRange.start);
    request.input('windowEnd', sql.Date, options.dateRange.end);
    filters.push('start_date <= @windowEnd', 'end_date >= @windowStart');
  }

  const query = `
    SELECT id, room_type_id, name, description, adjustment_type, adjustment_value,
           start_date, end_date, min_stay, max_stay, active, created_at, updated_at
      FROM dbo.room_rate_rules
     WHERE ${filters.join(' AND ')}
     ORDER BY start_date, name;
  `;

  const result = await request.query(query);
  return result.recordset.map(mapRateRuleRecord);
}

async function getRateRuleById(pool, roomTypeId, rateRuleId) {
  const result = await pool
    .request()
    .input('id', sql.Int, rateRuleId)
    .input('room_type_id', sql.Int, roomTypeId)
    .query(
      `SELECT id, room_type_id, name, description, adjustment_type, adjustment_value,
              start_date, end_date, min_stay, max_stay, active, created_at, updated_at
         FROM dbo.room_rate_rules
        WHERE id = @id AND room_type_id = @room_type_id;`
    );
  const row = result.recordset[0];
  return row ? mapRateRuleRecord(row) : null;
}

async function ensureRoomTypes(pool) {
  const existingResult = await pool
    .request()
    .query(`SELECT id, name, description, total_rooms, base_rate, sleeps, brochure_url, image_url FROM dbo.room_types;`);
  const existingByName = new Map(existingResult.recordset.map((row) => [row.name, row]));
  let changed = false;

  for (const definition of DEFAULT_ROOM_TYPES) {
    const existing = existingByName.get(definition.name);
    if (!existing) {
      const insert = pool.request();
      insert.input('name', sql.NVarChar(120), definition.name);
      insert.input('description', sql.NVarChar(500), definition.description || null);
      insert.input('total_rooms', sql.Int, definition.totalRooms);
      insert.input('base_rate', sql.Decimal(10, 2), definition.baseRate != null ? definition.baseRate : null);
      insert.input('sleeps', sql.Int, definition.sleeps != null ? definition.sleeps : null);
      insert.input('brochure_url', sql.NVarChar(500), definition.brochureUrl || null);
      insert.input('image_url', sql.NVarChar(500), definition.imageUrl || null);
      await insert.query(
        `INSERT INTO dbo.room_types (name, description, total_rooms, base_rate, sleeps, brochure_url, image_url)
         VALUES (@name, @description, @total_rooms, @base_rate, @sleeps, @brochure_url, @image_url);`
      );
      changed = true;
      continue;
    }

    const updates = [];
    const request = pool.request().input('id', sql.Int, existing.id);

    if (Number(existing.total_rooms) !== Number(definition.totalRooms)) {
      request.input('total_rooms', sql.Int, definition.totalRooms);
      updates.push('total_rooms = @total_rooms');
    }

    if (
      definition.baseRate != null &&
      (existing.base_rate == null || Number(existing.base_rate) !== Number(definition.baseRate))
    ) {
      request.input('base_rate', sql.Decimal(10, 2), definition.baseRate);
      updates.push('base_rate = @base_rate');
    }

    if (definition.description && definition.description !== existing.description) {
      request.input('description', sql.NVarChar(500), definition.description);
      updates.push('description = @description');
    }

    if (definition.sleeps != null && Number(existing.sleeps ?? 0) !== Number(definition.sleeps)) {
      request.input('sleeps', sql.Int, definition.sleeps);
      updates.push('sleeps = @sleeps');
    }

    if ((definition.brochureUrl || '') !== (existing.brochure_url || '')) {
      request.input('brochure_url', sql.NVarChar(500), definition.brochureUrl || null);
      updates.push('brochure_url = @brochure_url');
    }

    if ((definition.imageUrl || '') !== (existing.image_url || '')) {
      request.input('image_url', sql.NVarChar(500), definition.imageUrl || null);
      updates.push('image_url = @image_url');
    }

    if (updates.length > 0) {
      updates.push('updated_at = SYSUTCDATETIME()');
      await request.query(`UPDATE dbo.room_types SET ${updates.join(', ')} WHERE id = @id;`);
      changed = true;
    }
  }

  if (changed) {
    invalidateRoomTypesCache();
  }
}

async function refreshSalesSummaryCache(pool) {
  const reference = new Date();
  for (const period of SALES_PERIODS) {
    const { start, end } = calculateSalesPeriodRange(period, reference);
    const totalResult = await pool
      .request()
      .input('start', sql.DateTime2, start)
      .input('end', sql.DateTime2, end)
      .query(
        `SELECT SUM(payment_amount) AS total
           FROM dbo.bookings
          WHERE payment_received = 1
            AND created_at >= @start
            AND created_at < @end;`
      );
    const total = Number(totalResult.recordset[0]?.total || 0);
    await pool
      .request()
      .input('period_type', sql.NVarChar(20), period.key)
      .input('period_start', sql.DateTime2, start)
      .input('period_end', sql.DateTime2, end)
      .input('total_amount', sql.Decimal(12, 2), total)
      .query(
        `MERGE dbo.sales_summary AS target
           USING (SELECT @period_type AS period_type) AS source
           ON target.period_type = source.period_type
         WHEN MATCHED THEN
           UPDATE SET period_start = @period_start,
                     period_end = @period_end,
                     total_amount = @total_amount,
                     updated_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN
           INSERT (period_type, period_start, period_end, total_amount, updated_at)
           VALUES (@period_type, @period_start, @period_end, @total_amount, SYSUTCDATETIME());`
      );
  }
}

function validateRateRulePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Missing rate rule details.';
  }

  if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 3) {
    return 'Rate rule name must be at least 3 characters long.';
  }

  const type = String(payload.adjustmentType || '').toLowerCase();
  if (!['flat', 'percent'].includes(type)) {
    return 'Adjustment type must be "flat" or "percent".';
  }

  const value = Number(payload.adjustmentValue);
  if (Number.isNaN(value)) {
    return 'Adjustment value must be numeric.';
  }

  if (!payload.startDate || !payload.endDate) {
    return 'Start date and end date are required.';
  }

  if (payload.startDate > payload.endDate) {
    return 'Rate rule start date must be on or before end date.';
  }

  if (payload.minStay !== undefined && payload.minStay !== null && payload.minStay !== '') {
    const minStay = Number.parseInt(payload.minStay, 10);
    if (Number.isNaN(minStay) || minStay < 0) {
      return 'Minimum stay must be a non-negative integer.';
    }
  }

  if (payload.maxStay !== undefined && payload.maxStay !== null && payload.maxStay !== '') {
    const maxStay = Number.parseInt(payload.maxStay, 10);
    if (Number.isNaN(maxStay) || maxStay <= 0) {
      return 'Maximum stay must be a positive integer.';
    }
    if (payload.minStay !== undefined && payload.minStay !== null && payload.minStay !== '' && Number(payload.minStay) > maxStay) {
      return 'Minimum stay cannot exceed maximum stay.';
    }
  }

  return null;
}

function ruleAppliesToStay(rule, nights) {
  if (rule.minStay != null && nights < Number(rule.minStay)) {
    return false;
  }
  if (rule.maxStay != null && nights > Number(rule.maxStay)) {
    return false;
  }
  return true;
}

function ruleAppliesToDate(rule, date) {
  const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const start =
    rule.startDate != null
      ? new Date(Date.UTC(rule.startDate.getUTCFullYear(), rule.startDate.getUTCMonth(), rule.startDate.getUTCDate()))
      : null;
  const end =
    rule.endDate != null
      ? new Date(Date.UTC(rule.endDate.getUTCFullYear(), rule.endDate.getUTCMonth(), rule.endDate.getUTCDate()))
      : null;

  if (start && dateOnly < start) {
    return false;
  }
  if (end && dateOnly > end) {
    return false;
  }
  return true;
}

function calculateRateQuote(roomType, rules, checkInDate, checkOutDate) {
  const baseRate = Number(roomType.baseRate || 0);
  const totalNights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));
  const nightlyBreakdown = [];
  let baseTotal = 0;
  let finalTotal = 0;
  const appliedRuleIds = new Set();

  for (let offset = 0; offset < totalNights; offset += 1) {
    const current = new Date(checkInDate.getTime());
    current.setUTCDate(current.getUTCDate() + offset);

    let nightlyRate = baseRate;
    const appliedAdjustments = [];

    for (const rule of rules) {
      if (!rule.active) {
        continue;
      }
      if (!ruleAppliesToStay(rule, totalNights) || !ruleAppliesToDate(rule, current)) {
        continue;
      }

      let adjustmentAmount = 0;
      if (rule.adjustmentType === 'percent') {
        adjustmentAmount = (baseRate * rule.adjustmentValue) / 100;
      } else {
        adjustmentAmount = rule.adjustmentValue;
      }

      nightlyRate += adjustmentAmount;
      appliedAdjustments.push({
        id: rule.id,
        name: rule.name,
        adjustmentType: rule.adjustmentType,
        adjustmentValue: rule.adjustmentValue,
        appliedAmount: adjustmentAmount,
      });
      appliedRuleIds.add(rule.id);
    }

    nightlyRate = Math.max(0, nightlyRate);
    baseTotal += baseRate;
    finalTotal += nightlyRate;
    nightlyBreakdown.push({
      date: current.toISOString().split('T')[0],
      baseRate,
      finalRate: nightlyRate,
      adjustments: appliedAdjustments,
    });
  }

  return {
    baseRate,
    nights: totalNights,
    baseTotal,
    total: finalTotal,
    nightly: nightlyBreakdown,
    appliedRateRuleIds: Array.from(appliedRuleIds),
  };
}

function calculateSalesPeriodRange(period, referenceDate = new Date()) {
  const end = new Date(referenceDate.getTime());
  const start = new Date(referenceDate.getTime());

  if (period.shift?.hours) {
    start.setUTCHours(start.getUTCHours() - period.shift.hours);
  }
  if (period.shift?.days) {
    start.setUTCDate(start.getUTCDate() - period.shift.days);
  }
  if (period.shift?.months) {
    start.setUTCMonth(start.getUTCMonth() - period.shift.months);
  }
  if (period.shift?.years) {
    start.setUTCFullYear(start.getUTCFullYear() - period.shift.years);
  }

  return { start, end };
}

function getPeriodDefinition(windowKey) {
  return SALES_PERIODS.find((period) => period.key === windowKey) || SALES_PERIODS[0];
}

async function loadSalesSummaryMap(pool) {
  const result = await pool
    .request()
    .query(
      `SELECT period_type, period_start, period_end, total_amount, updated_at
         FROM dbo.sales_summary;`
    );
  const map = new Map();
  for (const row of result.recordset) {
    map.set(row.period_type, row);
  }
  return map;
}

function mapBookingRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    guestId: row.guest_id == null ? null : Number(row.guest_id),
    checkIn: row.check_in ? new Date(row.check_in).toISOString() : null,
    checkOut: row.check_out ? new Date(row.check_out).toISOString() : null,
    guests: row.guests,
    roomType: row.room_type,
    specialRequests: row.special_requests,
    verificationCode: row.verification_code,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paymentAmount: Number(row.payment_amount || 0),
    paymentReceived: Boolean(row.payment_received),
    status: row.status,
    source: row.source,
    roomNumber: row.room_number || null,
    checkedInAt: row.checked_in_at ? new Date(row.checked_in_at).toISOString() : null,
    checkedOutAt: row.checked_out_at ? new Date(row.checked_out_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

async function shutdown() {
  try {
    await connectionPool.close();
    console.log('Closed SQL Server connection.');
  } catch (error) {
    console.error('Error closing SQL Server connection', error);
  }
}





