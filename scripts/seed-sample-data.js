const DEFAULT_ROOM_TYPES = [
  {
    name: 'Deluxe King',
    totalRooms: Number(process.env.ROOMS_DELUXE_KING || 10),
    baseRate: 9200,
    sleeps: 2,
    brochureUrl: 'Choose skyline elegance, artisan coffee, and a copper tub.',
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    description: 'Spacious king room with premium bedding and city skyline view.',
  },
  {
    name: 'Twin Suite',
    totalRooms: Number(process.env.ROOMS_TWIN_SUITE || 8),
    baseRate: 8400,
    sleeps: 3,
    brochureUrl: 'Modular lounge seating and bay-facing workspace for small crews.',
    imageUrl: 'https://images.unsplash.com/photo-1562790351-d273a961e0e9?auto=format&fit=crop&w=1200&q=80',
    description: 'Flexible twin-bed suite perfect for friends or small families.',
  },
  {
    name: 'Ocean View Loft',
    totalRooms: Number(process.env.ROOMS_OCEAN_VIEW_LOFT || 4),
    baseRate: 12500,
    sleeps: 4,
    brochureUrl: 'Floating staircase loft with wraparound terrace and espresso bar.',
    imageUrl: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
    description: 'Two-story loft overlooking the bay with private balcony.',
  },
  {
    name: 'Garden Retreat',
    totalRooms: Number(process.env.ROOMS_GARDEN_RETREAT || 6),
    baseRate: 7800,
    sleeps: 2,
    brochureUrl: 'Fern-filled courtyard, slow mornings on the daybed, spa turn-down.',
    imageUrl: 'https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1200&q=80',
    description: 'Serene garden-level room surrounded by lush greenery.',
  },
];

const SALES_PERIODS = [
  { key: 'daily', shift: { hours: 24 } },
  { key: 'weekly', shift: { days: 7 } },
  { key: 'monthly', shift: { months: 1 } },
  { key: 'yearly', shift: { years: 1 } },
];

async function seedSampleData(pool) {
  await seedRoomTypes(pool);
  await seedRoomRateRules(pool);
  await purgeExistingSampleData(pool);
  const verificationMap = await seedVerificationCodes(pool);
  await seedBookings(pool, verificationMap);
  await seedServiceOrders(pool);
  await seedServiceTasks(pool);
  await refreshSalesSummary(pool);
}

async function purgeExistingSampleData(pool) {
  console.log('Removing existing sample data (if any)...');
  await pool.request().query(`
    IF OBJECT_ID('dbo.service_orders', 'U') IS NOT NULL
      DELETE FROM dbo.service_orders WHERE order_code LIKE 'SAMPLE-%';
    IF OBJECT_ID('dbo.room_service_tasks', 'U') IS NOT NULL
      DELETE FROM dbo.room_service_tasks WHERE reported_by = 'Sample Seeder' OR title LIKE 'Sample%';
    DELETE FROM dbo.bookings WHERE payment_reference LIKE 'SAMPLE-%';
    DELETE FROM dbo.verification_codes WHERE code LIKE 'SAMPLE%';
  `);
}

async function seedVerificationCodes(pool) {
  console.log('Seeding verification codes...');
  const entries = [
    {
      key: 'maria',
      email: 'maria.santos@example.com',
      phone: '09171234567',
      code: 'SAMPLE01',
      expiresAt: daysFromNow(3),
      used: true,
      usedAt: daysFromNow(-15),
    },
    {
      key: 'daniel',
      email: 'daniel.reyes@example.com',
      phone: '09998887777',
      code: 'SAMPLE02',
      expiresAt: daysFromNow(2),
      used: false,
      usedAt: null,
    },
    {
      key: 'elena',
      email: 'elena.cruz@example.com',
      phone: '09225554444',
      code: 'SAMPLE03',
      expiresAt: daysFromNow(1),
      used: true,
      usedAt: daysFromNow(-2),
    },
    {
      key: 'liam',
      email: 'liam.delacruz@example.com',
      phone: '09183456789',
      code: 'SAMPLE04',
      expiresAt: daysFromNow(5),
      used: false,
      usedAt: null,
    },
    {
      key: 'amelia',
      email: 'amelia.garcia@example.com',
      phone: '09081239876',
      code: 'SAMPLE05',
      expiresAt: daysFromNow(7),
      used: false,
      usedAt: null,
    },
  ];

  const insertStatement = `
    INSERT INTO dbo.verification_codes (email, phone, code, expires_at, used, used_at)
    OUTPUT INSERTED.id
    VALUES (@email, @phone, @code, @expires_at, @used, @used_at);
  `;

  const map = new Map();
  for (const entry of entries) {
    const request = pool.request();
    request.input('email', sql.NVarChar(255), entry.email);
    request.input('phone', sql.NVarChar(50), entry.phone);
    request.input('code', sql.VarChar(10), entry.code);
    request.input('expires_at', sql.DateTime2, entry.expiresAt);
    request.input('used', sql.Bit, entry.used ? 1 : 0);
    request.input('used_at', sql.DateTime2, entry.usedAt);

    const result = await request.query(insertStatement);
    const insertedId = result.recordset[0]?.id;
    if (!insertedId) {
      throw new Error(`Failed to insert verification code for ${entry.email}`);
    }
    map.set(entry.key, { id: insertedId, code: entry.code });
  }

  console.log(`Inserted ${entries.length} verification codes.`);
  return map;
}

async function seedBookings(pool, verificationMap) {
  console.log('Seeding bookings...');
  const sampleBookings = [
    {
      fullName: 'Harper Lee',
      email: 'harper.lee@example.com',
      phone: '+63 917 555 1010',
      checkIn: hoursFromNow(18),
      checkOut: hoursFromNow(66),
      guests: 2,
      roomType: 'Deluxe King',
      specialRequests: 'Please prepare welcome chocolates.',
      verificationKey: null,
      paymentMethod: 'GCash',
      paymentReference: 'SAMPLE-GCASH-DAILY',
      paymentAmount: 6800,
      paymentReceived: true,
      status: 'confirmed',
      source: 'online',
      createdAt: hoursFromNow(-6),
    },
    {
      fullName: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '+63 917 123 4567',
      checkIn: '2025-10-24T14:00:00Z',
      checkOut: '2025-10-27T05:00:00Z',
      guests: 2,
      roomType: 'Deluxe King',
      specialRequests: 'High floor with ocean view if available.',
      verificationKey: 'maria',
      paymentMethod: 'GCash',
      paymentReference: 'SAMPLE-GCASH-001',
      paymentAmount: 4500,
      paymentReceived: true,
      status: 'confirmed',
      source: 'online',
      createdAt: daysFromNow(-20),
    },
    {
      fullName: 'Daniel Reyes',
      email: 'daniel.reyes@example.com',
      phone: '+63 999 888 7777',
      checkIn: '2025-10-21T06:00:00Z',
      checkOut: '2025-10-22T04:00:00Z',
      guests: 1,
      roomType: 'Garden Retreat',
      specialRequests: 'Late check-in around 9 PM.',
      verificationKey: 'daniel',
      paymentMethod: 'PayMaya',
      paymentReference: 'SAMPLE-PAYMAYA-002',
      paymentAmount: 2800,
      paymentReceived: false,
      status: 'confirmed',
      source: 'online',
      createdAt: daysFromNow(-5),
    },
    {
      fullName: 'Elena Cruz',
      email: 'elena.cruz@example.com',
      phone: '+63 922 555 4444',
      checkIn: '2025-10-19T06:00:00Z',
      checkOut: '2025-10-22T04:00:00Z',
      guests: 3,
      roomType: 'Twin Suite',
      roomNumber: 'TS-05',
      specialRequests: 'Crib for toddler and airport pickup.',
      verificationKey: 'elena',
      paymentMethod: 'Credit Card',
      paymentReference: 'SAMPLE-CC-003',
      paymentAmount: 7500,
      paymentReceived: true,
      status: 'checked_in',
      source: 'direct',
      checkedInAt: daysFromNow(-1),
      createdAt: daysFromNow(-10),
    },
    {
      fullName: 'Liam Dela Cruz',
      email: 'liam.delacruz@example.com',
      phone: '+63 918 345 6789',
      checkIn: '2025-10-10T06:00:00Z',
      checkOut: '2025-10-12T04:00:00Z',
      guests: 2,
      roomType: 'Ocean View Loft',
      roomNumber: 'OV-02',
      specialRequests: 'Breakfast in room on Saturday.',
      verificationKey: 'liam',
      paymentMethod: 'GCash',
      paymentReference: 'SAMPLE-GCASH-004',
      paymentAmount: 9600,
      paymentReceived: true,
      status: 'checked_out',
      source: 'online',
      checkedInAt: daysFromNow(-11),
      checkedOutAt: daysFromNow(-9),
      createdAt: daysFromNow(-25),
    },
    {
      fullName: 'Amelia Garcia',
      email: 'amelia.garcia@example.com',
      phone: '+63 908 123 9876',
      checkIn: '2025-11-05T06:00:00Z',
      checkOut: '2025-11-09T04:00:00Z',
      guests: 4,
      roomType: 'Twin Suite',
      specialRequests: null,
      verificationKey: 'amelia',
      paymentMethod: 'Credit Card',
      paymentReference: 'SAMPLE-CC-005',
      paymentAmount: 12400,
      paymentReceived: true,
      status: 'confirmed',
      source: 'direct',
      createdAt: daysFromNow(-2),
    },
    {
      fullName: 'Noah Ramirez',
      email: 'noah.ramirez@example.com',
      phone: '+63 927 654 3210',
      checkIn: '2025-10-30T06:00:00Z',
      checkOut: '2025-11-02T04:00:00Z',
      guests: 2,
      roomType: 'Garden Retreat',
      specialRequests: 'Allergy-friendly pillows.',
      verificationKey: null,
      paymentMethod: 'GCash',
      paymentReference: 'SAMPLE-GCASH-006',
      paymentAmount: 5200,
      paymentReceived: true,
      status: 'confirmed',
      source: 'online',
      createdAt: daysFromNow(-4),
    },
    {
      fullName: 'Sophia Mendoza',
      email: 'sophia.mendoza@example.com',
      phone: '+63 916 741 2580',
      checkIn: '2025-10-15T06:00:00Z',
      checkOut: '2025-10-19T04:00:00Z',
      guests: 5,
      roomType: 'Twin Suite',
      specialRequests: 'Connecting room if possible.',
      verificationKey: null,
      paymentMethod: 'PayMaya',
      paymentReference: 'SAMPLE-PAYMAYA-007',
      paymentAmount: 13800,
      paymentReceived: true,
      status: 'checked_out',
      source: 'direct',
      checkedInAt: daysFromNow(-6),
      checkedOutAt: daysFromNow(-2),
      createdAt: daysFromNow(-18),
    },
    {
      fullName: 'Carlos Navarro',
      email: 'carlos.navarro@example.com',
      phone: '+63 915 222 3344',
      checkIn: daysFromNow(-190),
      checkOut: daysFromNow(-186),
      guests: 2,
      roomType: 'Garden Retreat',
      specialRequests: 'Quiet room near spa if available.',
      verificationKey: null,
      paymentMethod: 'Credit Card',
      paymentReference: 'SAMPLE-CC-YEARLY',
      paymentAmount: 8200,
      paymentReceived: true,
      status: 'checked_out',
      source: 'online',
      checkedInAt: daysFromNow(-190),
      checkedOutAt: daysFromNow(-186),
      createdAt: daysFromNow(-200),
    },
  ];

  const insertStatement = `
    INSERT INTO dbo.bookings (
      full_name,
      email,
      phone,
      check_in,
      check_out,
      guests,
      room_type,
      room_number,
      special_requests,
      verification_code_id,
      payment_method,
      payment_reference,
      payment_amount,
      payment_received,
      status,
      source,
      checked_in_at,
      checked_out_at,
      created_at
    )
    VALUES (
      @full_name,
      @email,
      @phone,
      @check_in,
      @check_out,
      @guests,
      @room_type,
      @room_number,
      @special_requests,
      @verification_code_id,
      @payment_method,
      @payment_reference,
      @payment_amount,
      @payment_received,
      @status,
      @source,
      @checked_in_at,
      @checked_out_at,
      @created_at
    );
  `;

  for (const booking of sampleBookings) {
    const request = pool.request();
    request.input('full_name', sql.NVarChar(255), booking.fullName);
    request.input('email', sql.NVarChar(255), booking.email);
    request.input('phone', sql.NVarChar(50), booking.phone);
    request.input('check_in', sql.DateTime2, new Date(booking.checkIn));
    request.input('check_out', sql.DateTime2, new Date(booking.checkOut));
    request.input('guests', sql.Int, booking.guests);
    request.input('room_type', sql.NVarChar(120), booking.roomType);
    request.input('room_number', sql.NVarChar(20), booking.roomNumber ? booking.roomNumber : null);
    request.input('special_requests', sql.NVarChar(sql.MAX), booking.specialRequests);

    const verification = booking.verificationKey ? verificationMap.get(booking.verificationKey) : null;
    request.input('verification_code_id', sql.Int, verification ? verification.id : null);

    request.input('payment_method', sql.NVarChar(50), booking.paymentMethod);
    request.input('payment_reference', sql.NVarChar(80), booking.paymentReference);
    request.input('payment_amount', sql.Decimal(10, 2), booking.paymentAmount);
    request.input('payment_received', sql.Bit, booking.paymentReceived ? 1 : 0);
    request.input('status', sql.NVarChar(20), booking.status);
    request.input('source', sql.NVarChar(20), booking.source || 'online');
    request.input('checked_in_at', sql.DateTime2, booking.checkedInAt ? new Date(booking.checkedInAt) : null);
    request.input('checked_out_at', sql.DateTime2, booking.checkedOutAt ? new Date(booking.checkedOutAt) : null);
    request.input('created_at', sql.DateTime2, booking.createdAt ? new Date(booking.createdAt) : new Date());

    await request.query(insertStatement);
  }

  console.log(`Inserted ${sampleBookings.length} bookings.`);
}

async function seedServiceOrders(pool) {
  if (!(await tableExists(pool, 'dbo.service_orders'))) {
    console.log('Skipping service order seeding (table not found).');
    return;
  }

  console.log('Seeding service orders...');
  const sampleOrders = [
    {
      code: 'SAMPLE-FOOD1',
      fullName: 'Harper Lee',
      email: 'harper.lee@example.com',
      phone: '+63 917 555 1010',
      roomNumber: '1608',
      orderType: 'food',
      department: 'restaurant',
      items: [
        { name: 'Sunrise Breakfast Set', quantity: 2, notes: 'Gluten-free toast' },
        { name: 'Fresh Mango Juice', quantity: 2 },
      ],
      instructions: 'Please deliver at 7:30 AM.',
      status: 'acknowledged',
      requestedFor: hoursFromNow(6),
      acknowledgedAt: hoursFromNow(-0.5),
      handledBy: 'Chef Mara',
      statusNote: 'Kitchen prepping trays.',
      totalAmount: 1250,
      createdAt: hoursFromNow(-1),
    },
    {
      code: 'SAMPLE-AMEN1',
      fullName: 'Maria Santos',
      email: 'maria.santos@example.com',
      phone: '+63 917 123 4567',
      roomNumber: '1204',
      orderType: 'amenity',
      department: 'guest_services',
      items: [
        { name: 'Feather Pillow', quantity: 2 },
        { name: 'Baby Crib Setup', quantity: 1, notes: 'Include extra linens' },
      ],
      instructions: 'Set up before 9 PM arrival.',
      status: 'in_progress',
      requestedFor: hoursFromNow(2),
      acknowledgedAt: hoursFromNow(-1),
      handledBy: 'Front Desk Carla',
      statusNote: 'Crib assembled, pillows being delivered.',
      totalAmount: null,
      createdAt: hoursFromNow(-3),
    },
    {
      code: 'SAMPLE-HK01',
      fullName: 'Elena Cruz',
      email: 'elena.cruz@example.com',
      phone: '+63 922 555 4444',
      roomNumber: '901',
      orderType: 'housekeeping',
      department: 'housekeeping',
      items: [
        { name: 'Evening Turn-down Service', quantity: 1 },
        { name: 'Fresh Towels', quantity: 1, notes: 'Add kids robe size S' },
      ],
      instructions: 'Guest will be out for dinner 7-9 PM.',
      status: 'completed',
      requestedFor: hoursFromNow(-10),
      acknowledgedAt: hoursFromNow(-9.5),
      completedAt: hoursFromNow(-8.5),
      handledBy: 'Housekeeping Jessa',
      statusNote: 'Completed while guests were out.',
      totalAmount: null,
      createdAt: hoursFromNow(-12),
      updatedAt: hoursFromNow(-8),
    },
    {
      code: 'SAMPLE-MNT1',
      fullName: 'Noah Ramirez',
      email: 'noah.ramirez@example.com',
      phone: '+63 927 654 3210',
      roomNumber: '502',
      orderType: 'maintenance',
      department: 'engineering',
      items: [
        { name: 'Aircon Diagnostics', quantity: 1, notes: 'Unit rattling on medium fan' },
      ],
      instructions: 'Guest available after 3 PM.',
      status: 'pending',
      requestedFor: hoursFromNow(4),
      handledBy: null,
      statusNote: 'Waiting for engineering assignment.',
      totalAmount: null,
      createdAt: hoursFromNow(-0.5),
    },
  ];

  if (!sampleOrders.length) {
    console.log('No service orders to insert.');
    return;
  }

  const insertStatement = `
    INSERT INTO dbo.service_orders (
      order_code,
      guest_id,
      full_name,
      email,
      phone,
      room_number,
      order_type,
      target_department,
      items,
      special_instructions,
      status,
      requested_for,
      acknowledged_at,
      completed_at,
      handled_by,
      total_amount,
      status_note,
      created_at,
      updated_at
    )
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
      @status,
      @requested_for,
      @acknowledged_at,
      @completed_at,
      @handled_by,
      @total_amount,
      @status_note,
      @created_at,
      @updated_at
    );
  `;

  const guestIdCache = new Map();

  for (const order of sampleOrders) {
    let guestId = null;
    if (order.email) {
      const lookupKey = order.email.toLowerCase();
      if (guestIdCache.has(lookupKey)) {
        guestId = guestIdCache.get(lookupKey);
      } else {
        try {
          const lookup = await pool
            .request()
            .input('email', sql.NVarChar(255), order.email)
            .query(`SELECT TOP 1 id FROM dbo.guest_profiles WHERE email = @email`);
          guestId = lookup.recordset[0]?.id ?? null;
        } catch (lookupError) {
          console.warn(`Guest lookup failed for ${order.email}: ${lookupError.message}`);
        }
        guestIdCache.set(lookupKey, guestId);
      }
    }

    const request = pool.request();
    request.input('order_code', sql.NVarChar(16), order.code);
    request.input('guest_id', sql.Int, guestId);
    request.input('full_name', sql.NVarChar(255), order.fullName);
    request.input('email', sql.NVarChar(255), order.email);
    request.input('phone', sql.NVarChar(50), order.phone);
    request.input('room_number', sql.NVarChar(20), order.roomNumber);
    request.input('order_type', sql.NVarChar(50), order.orderType);
    request.input('target_department', sql.NVarChar(80), order.department);
    request.input('items', sql.NVarChar(sql.MAX), JSON.stringify(order.items));
    request.input('special_instructions', sql.NVarChar(sql.MAX), order.instructions ?? null);
    request.input('status', sql.NVarChar(20), order.status);
    request.input('requested_for', sql.DateTime2, order.requestedFor ? new Date(order.requestedFor) : null);
    request.input(
      'acknowledged_at',
      sql.DateTime2,
      order.acknowledgedAt ? new Date(order.acknowledgedAt) : null
    );
    request.input('completed_at', sql.DateTime2, order.completedAt ? new Date(order.completedAt) : null);
    request.input('handled_by', sql.NVarChar(120), order.handledBy ?? null);
    if (order.totalAmount != null) {
      request.input('total_amount', sql.Decimal(10, 2), order.totalAmount);
    } else {
      request.input('total_amount', sql.Decimal(10, 2), null);
    }
    request.input('status_note', sql.NVarChar(sql.MAX), order.statusNote ?? null);
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const updatedAt = order.updatedAt ? new Date(order.updatedAt) : createdAt;
    request.input('created_at', sql.DateTime2, createdAt);
    request.input('updated_at', sql.DateTime2, updatedAt);

    await request.query(insertStatement);
  }

  console.log(`Inserted ${sampleOrders.length} service orders.`);
}

async function seedServiceTasks(pool) {
  if (!(await tableExists(pool, 'dbo.room_service_tasks'))) {
    console.log('Skipping service task seeding (table not found).');
    return;
  }

  console.log('Seeding room service tasks...');
  const sampleTasks = [
    {
      roomNumber: '1608',
      taskType: 'housekeeping',
      title: 'Sample - Evening turn-down',
      details: 'Refresh linens, place lavender pillow mist, restock minibar.',
      priority: 'normal',
      status: 'scheduled',
      readiness: 'inspection',
      scheduledFor: hoursFromNow(5),
      reportedBy: 'Sample Seeder',
      assignedTo: 'J. Cruz',
      lastUpdatedBy: 'Sample Seeder',
      createdAt: hoursFromNow(-1),
    },
    {
      roomNumber: '502',
      taskType: 'maintenance',
      title: 'Sample - Aircon vibration',
      details: 'Check condenser fan noise reported by guest.',
      priority: 'urgent',
      status: 'in_progress',
      readiness: 'out_of_service',
      scheduledFor: hoursFromNow(-3),
      startedAt: hoursFromNow(-2),
      reportedBy: 'Sample Seeder',
      assignedTo: 'Eng. Ramos',
      lastUpdatedBy: 'Eng. Ramos',
      createdAt: hoursFromNow(-3),
      updatedAt: hoursFromNow(-1),
    },
    {
      roomNumber: '901',
      taskType: 'housekeeping',
      title: 'Sample - Post dinner reset',
      details: 'Clear service trolley and reset bathroom amenities.',
      priority: 'low',
      status: 'completed',
      readiness: 'ready',
      scheduledFor: hoursFromNow(-7),
      startedAt: hoursFromNow(-6.5),
      completedAt: hoursFromNow(-6),
      reportedBy: 'Sample Seeder',
      assignedTo: 'K. Dizon',
      lastUpdatedBy: 'K. Dizon',
      createdAt: hoursFromNow(-7),
      updatedAt: hoursFromNow(-6),
    },
  ];

  if (!sampleTasks.length) {
    console.log('No service tasks to insert.');
    return;
  }

  const insertStatement = `
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
      last_updated_by,
      created_at,
      updated_at
    )
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
      @last_updated_by,
      @created_at,
      @updated_at
    );
  `;

  for (const task of sampleTasks) {
    const request = pool.request();
    request.input('room_number', sql.NVarChar(20), task.roomNumber);
    request.input('task_type', sql.NVarChar(20), task.taskType);
    request.input('title', sql.NVarChar(200), task.title);
    request.input('details', sql.NVarChar(sql.MAX), task.details ?? null);
    request.input('priority', sql.NVarChar(20), task.priority);
    request.input('status', sql.NVarChar(20), task.status);
    request.input('readiness', sql.NVarChar(20), task.readiness ?? null);
    request.input('scheduled_for', sql.DateTime2, task.scheduledFor ? new Date(task.scheduledFor) : null);
    request.input('started_at', sql.DateTime2, task.startedAt ? new Date(task.startedAt) : null);
    request.input('completed_at', sql.DateTime2, task.completedAt ? new Date(task.completedAt) : null);
    request.input('reported_by', sql.NVarChar(120), task.reportedBy ?? null);
    request.input('assigned_to', sql.NVarChar(120), task.assignedTo ?? null);
    request.input('last_updated_by', sql.NVarChar(120), task.lastUpdatedBy ?? null);
    const createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
    const updatedAt = task.updatedAt ? new Date(task.updatedAt) : createdAt;
    request.input('created_at', sql.DateTime2, createdAt);
    request.input('updated_at', sql.DateTime2, updatedAt);
    await request.query(insertStatement);
  }

  console.log(`Inserted ${sampleTasks.length} room service tasks.`);
}

async function tableExists(pool, tableName) {
  const result = await pool
    .request()
    .input('table_name', sql.NVarChar(255), tableName)
    .query(`SELECT OBJECT_ID(@table_name, 'U') AS obj_id;`);
  return result.recordset[0]?.obj_id != null;
}

function daysFromNow(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function hoursFromNow(offset) {
  const date = new Date();
  date.setUTCHours(date.getUTCHours() + offset);
  return date;
}

async function seedRoomTypes(pool) {
  console.log('Ensuring room types are present...');
  for (const definition of DEFAULT_ROOM_TYPES) {
    const request = pool.request();
    request.input('name', sql.NVarChar(120), definition.name);
    request.input('description', sql.NVarChar(500), definition.description || null);
    request.input('total_rooms', sql.Int, definition.totalRooms);
    request.input('base_rate', sql.Decimal(10, 2), definition.baseRate != null ? definition.baseRate : null);
    request.input('sleeps', sql.Int, definition.sleeps != null ? definition.sleeps : null);
    request.input('brochure_url', sql.NVarChar(500), definition.brochureUrl || null);
    request.input('image_url', sql.NVarChar(500), definition.imageUrl || null);
    await request.query(`
      MERGE dbo.room_types AS target
      USING (SELECT @name AS name) AS source
      ON target.name = source.name
      WHEN MATCHED THEN
        UPDATE SET description = @description,
                   total_rooms = @total_rooms,
                   base_rate = @base_rate,
                   sleeps = @sleeps,
                   brochure_url = @brochure_url,
                   image_url = @image_url,
                   updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (name, description, total_rooms, base_rate, sleeps, brochure_url, image_url)
        VALUES (@name, @description, @total_rooms, @base_rate, @sleeps, @brochure_url, @image_url);
    `);
  }
}

async function seedRoomRateRules(pool) {
  console.log('Seeding room rate rules...');
  await pool.request().query("DELETE FROM dbo.room_rate_rules WHERE name LIKE 'Sample %';");

  const roomTypeResult = await pool.request().query(`SELECT id, name FROM dbo.room_types;`);
  const roomTypeMap = new Map(roomTypeResult.recordset.map((row) => [row.name, row.id]));

  const rules = [
    {
      roomType: 'Deluxe King',
      name: 'Sample Weekend Escape',
      description: '20% premium applied on weekend stays for deluxe experiences.',
      adjustmentType: 'percent',
      adjustmentValue: 20,
      startDate: daysFromNow(-14),
      endDate: daysFromNow(60),
      minStay: 2,
    },
    {
      roomType: 'Twin Suite',
      name: 'Sample Corporate Partner Discount',
      description: 'Preferred corporate partners enjoy PHP 1,500 nightly savings.',
      adjustmentType: 'flat',
      adjustmentValue: -1500,
      startDate: daysFromNow(-30),
      endDate: daysFromNow(120),
      minStay: 3,
    },
    {
      roomType: 'Ocean View Loft',
      name: 'Sample Peak Season Premium',
      description: 'High-demand beachfront dates carry a PHP 3,000 nightly premium.',
      adjustmentType: 'flat',
      adjustmentValue: 3000,
      startDate: daysFromNow(30),
      endDate: daysFromNow(120),
    },
    {
      roomType: 'Garden Retreat',
      name: 'Sample Midweek Serenity',
      description: '10% courtesy discount for midweek relaxation stays.',
      adjustmentType: 'percent',
      adjustmentValue: -10,
      startDate: daysFromNow(-7),
      endDate: daysFromNow(45),
      minStay: 2,
      maxStay: 5,
    },
  ];

  for (const rule of rules) {
    const roomTypeId = roomTypeMap.get(rule.roomType);
    if (!roomTypeId) {
      continue;
    }

    const insert = pool.request();
    insert.input('room_type_id', sql.Int, roomTypeId);
    insert.input('name', sql.NVarChar(120), rule.name);
    insert.input('description', sql.NVarChar(500), rule.description || null);
    insert.input('adjustment_type', sql.NVarChar(10), rule.adjustmentType);
    insert.input('adjustment_value', sql.Decimal(10, 2), rule.adjustmentValue);
    insert.input('start_date', sql.Date, rule.startDate.toISOString().slice(0, 10));
    insert.input('end_date', sql.Date, rule.endDate.toISOString().slice(0, 10));
    insert.input('min_stay', sql.Int, rule.minStay != null ? rule.minStay : null);
    insert.input('max_stay', sql.Int, rule.maxStay != null ? rule.maxStay : null);

    await insert.query(
      `INSERT INTO dbo.room_rate_rules
        (room_type_id, name, description, adjustment_type, adjustment_value, start_date, end_date, min_stay, max_stay, active)
       VALUES (@room_type_id, @name, @description, @adjustment_type, @adjustment_value, @start_date, @end_date, @min_stay, @max_stay, 1);`
    );
  }
}

async function refreshSalesSummary(pool) {
  console.log('Refreshing sales summary cache...');
  const reference = new Date();

  for (const period of SALES_PERIODS) {
    const { start, end } = calculatePeriodRange(period, reference);
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

function calculatePeriodRange(period, referenceDate = new Date()) {
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

function buildSqlConfig() {
  const connectionString = process.env.SQL_CONNECTION_STRING;
  if (connectionString && connectionString.trim().length > 0) {
    return {
      connectionConfig: connectionString,
      connectionLabel: 'via connection string',
    };
  }

  const server = process.env.SQL_SERVER;
  const database = process.env.SQL_DATABASE;
  if (!server || !database) {
    throw new Error('Missing SQL configuration. Set SQL_SERVER and SQL_DATABASE or SQL_CONNECTION_STRING.');
  }

  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const encrypt = process.env.SQL_ENCRYPT === 'true';
  const trustCert = process.env.SQL_TRUST_CERT !== 'false';
  const port = Number(process.env.SQL_PORT || 1433);
  const poolMax = Number(process.env.SQL_POOL_MAX || 10);
  const domain = process.env.SQL_DOMAIN;
  const authType = process.env.SQL_AUTH_TYPE;

  const config = {
    server,
    database,
    port,
    options: {
      encrypt,
      trustServerCertificate: trustCert,
    },
    pool: {
      max: poolMax,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (authType === 'ntlm') {
    if (!user || !password || !domain) {
      throw new Error('NTLM authentication requires SQL_USER, SQL_PASSWORD, and SQL_DOMAIN.');
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
  }

  return {
    connectionConfig: config,
    connectionLabel: `${server}/${database}`,
  };
}

main();
