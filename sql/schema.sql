IF DB_ID(N'HarborviewBookings') IS NULL
BEGIN
    CREATE DATABASE HarborviewBookings;
END;
GO

USE HarborviewBookings;
GO

IF OBJECT_ID(N'dbo.verification_codes', N'U') IS NULL
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

END;
GO

IF OBJECT_ID(N'dbo.verification_codes', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'IX_verification_codes_email_created'
          AND object_id = OBJECT_ID(N'dbo.verification_codes')
    )
    BEGIN
        CREATE INDEX IX_verification_codes_email_created
            ON dbo.verification_codes (email, created_at);
    END;
END;
GO

IF OBJECT_ID(N'dbo.guest_profiles', N'U') IS NULL
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
GO

IF OBJECT_ID(N'dbo.bookings', N'U') IS NULL
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
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID(N'dbo.room_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.room_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(120) NOT NULL UNIQUE,
        description NVARCHAR(500) NULL,
        total_rooms INT NOT NULL,
        base_rate DECIMAL(10,2) NULL,
        sleeps INT NULL,
        brochure_url NVARCHAR(500) NULL,
        image_url NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID(N'dbo.sales_summary', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales_summary (
        period_type NVARCHAR(20) NOT NULL PRIMARY KEY,
        period_start DATETIME2 NOT NULL,
        period_end DATETIME2 NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID(N'dbo.room_rate_rules', N'U') IS NULL
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
        CONSTRAINT FK_room_rate_rules_room_types FOREIGN KEY (room_type_id)
            REFERENCES dbo.room_types(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_room_rate_rules_room_type_dates
        ON dbo.room_rate_rules (room_type_id, start_date, end_date);
END;
GO

IF OBJECT_ID(N'dbo.service_orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.service_orders (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_code NVARCHAR(16) NOT NULL,
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
        total_amount DECIMAL(10,2) NULL,
        status_note NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UX_service_orders_code UNIQUE (order_code),
        CONSTRAINT FK_service_orders_guest_profiles FOREIGN KEY (guest_id)
            REFERENCES dbo.guest_profiles(id) ON DELETE SET NULL
    );

    CREATE INDEX IX_service_orders_status_department
        ON dbo.service_orders (status, target_department, created_at DESC);

    CREATE INDEX IX_service_orders_guest_email
        ON dbo.service_orders (email);
END;
GO

IF OBJECT_ID(N'dbo.room_service_tasks', N'U') IS NULL
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
GO

BEGIN TRY
    IF OBJECT_ID(N'dbo.bookings', N'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH(N'dbo.bookings', N'payment_method') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD payment_method NVARCHAR(50) NULL;');
            EXEC ('UPDATE dbo.bookings SET payment_method = ''Pending'' WHERE payment_method IS NULL;');
            EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_method NVARCHAR(50) NOT NULL;');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'payment_reference') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD payment_reference NVARCHAR(80) NULL;');
            EXEC ('UPDATE dbo.bookings SET payment_reference = ''N/A'' WHERE payment_reference IS NULL;');
            EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_reference NVARCHAR(80) NOT NULL;');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'payment_amount') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD payment_amount DECIMAL(10,2) NULL;');
            EXEC ('UPDATE dbo.bookings SET payment_amount = 0 WHERE payment_amount IS NULL;');
            EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_amount DECIMAL(10,2) NOT NULL;');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'payment_received') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD payment_received BIT NULL;');
            EXEC ('UPDATE dbo.bookings SET payment_received = 0 WHERE payment_received IS NULL;');
            EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN payment_received BIT NOT NULL;');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'status') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD status NVARCHAR(20) NOT NULL DEFAULT ''confirmed'';');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'checked_out_at') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD checked_out_at DATETIME2 NULL;');
        END;

        IF COL_LENGTH(N'dbo.room_types', N'sleeps') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.room_types ADD sleeps INT NULL;');
        END;

        IF COL_LENGTH(N'dbo.room_types', N'brochure_url') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.room_types ADD brochure_url NVARCHAR(500) NULL;');
        END;

        IF COL_LENGTH(N'dbo.room_types', N'image_url') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.room_types ADD image_url NVARCHAR(500) NULL;');
        END;

        IF COLUMNPROPERTY(OBJECT_ID('dbo.bookings'), 'verification_code_id', 'AllowsNull') = 0
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ALTER COLUMN verification_code_id INT NULL;');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'source') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD source NVARCHAR(20) NOT NULL DEFAULT ''online'';');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'checked_in_at') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.bookings ADD checked_in_at DATETIME2 NULL;');
        END;

        IF COL_LENGTH(N'dbo.bookings', N'guest_id') IS NULL
        BEGIN
            ALTER TABLE dbo.bookings ADD guest_id INT NULL;
        END;

        IF COL_LENGTH(N'dbo.room_types', N'sleeps') IS NULL
        BEGIN
            ALTER TABLE dbo.room_types ADD sleeps INT NULL;
        END;

        IF COL_LENGTH(N'dbo.room_types', N'brochure_url') IS NULL
        BEGIN
            ALTER TABLE dbo.room_types ADD brochure_url NVARCHAR(500) NULL;
        END;

        IF COL_LENGTH(N'dbo.room_types', N'image_url') IS NULL
        BEGIN
            ALTER TABLE dbo.room_types ADD image_url NVARCHAR(500) NULL;
        END;
    END;

    IF OBJECT_ID(N'dbo.guest_profiles', N'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH(N'dbo.guest_profiles', N'preferences') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD preferences NVARCHAR(MAX) NULL;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'notes') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD notes NVARCHAR(MAX) NULL;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'preferred_room_type') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD preferred_room_type NVARCHAR(120) NULL;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'marketing_opt_in') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD marketing_opt_in BIT NOT NULL DEFAULT 0;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'vip_status') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD vip_status NVARCHAR(50) NULL;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'total_stays') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD total_stays INT NOT NULL DEFAULT 0;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'total_nights') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD total_nights INT NOT NULL DEFAULT 0;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'lifetime_value') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD lifetime_value DECIMAL(12,2) NOT NULL DEFAULT 0;');
        END;

        IF COL_LENGTH(N'dbo.guest_profiles', N'last_stay_at') IS NULL
        BEGIN
            EXEC ('ALTER TABLE dbo.guest_profiles ADD last_stay_at DATETIME2 NULL;');
        END;

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

        IF COL_LENGTH(N'dbo.bookings', N'guest_id') IS NOT NULL
        BEGIN
            DECLARE @sql_update_guests NVARCHAR(MAX);
            SET @sql_update_guests = N'
                UPDATE b
                    SET guest_id = gp.id
                FROM dbo.bookings b
                INNER JOIN dbo.guest_profiles gp
                        ON gp.email = b.email
                WHERE b.guest_id IS NULL
                  AND b.email IS NOT NULL;
            ';
            EXEC sp_executesql @sql_update_guests;

            DECLARE @sql_refresh_profiles NVARCHAR(MAX);
            SET @sql_refresh_profiles = N'
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
            ';
            EXEC sp_executesql @sql_refresh_profiles;
        END
        ELSE
        BEGIN
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
                    ON b_inner.email = gp_inner.email
                GROUP BY gp_inner.email
            ) AS agg
                ON gp.email = agg.email;
        END;
    END;
END TRY
BEGIN CATCH
    PRINT 'Schema migration skipped: ' + ERROR_MESSAGE();
END CATCH;
GO

IF OBJECT_ID(N'dbo.bookings', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.guest_profiles', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.bookings', N'guest_id') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_bookings_guest_profiles'
          AND parent_object_id = OBJECT_ID(N'dbo.bookings')
    )
    BEGIN
        BEGIN TRY
            ALTER TABLE dbo.bookings DROP CONSTRAINT [FK_bookings_guest_profiles];
        END TRY
        BEGIN CATCH
            DECLARE @drop_error INT = ERROR_NUMBER();
            IF @drop_error NOT IN (3727, 3728)
            BEGIN
                DECLARE @drop_error_message NVARCHAR(4000) = ERROR_MESSAGE();
                RAISERROR('Error dropping FK_bookings_guest_profiles: %s', 16, 1, @drop_error_message);
            END;
        END CATCH;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_bookings_guest_profiles'
          AND parent_object_id = OBJECT_ID(N'dbo.bookings')
    )
    BEGIN
        BEGIN TRY
            ALTER TABLE dbo.bookings
                ADD CONSTRAINT [FK_bookings_guest_profiles]
                    FOREIGN KEY (guest_id) REFERENCES dbo.guest_profiles(id);
        END TRY
        BEGIN CATCH
            DECLARE @add_error INT = ERROR_NUMBER();
            IF @add_error <> 2714
            BEGIN
                DECLARE @add_error_message NVARCHAR(4000) = ERROR_MESSAGE();
                RAISERROR('Error adding FK_bookings_guest_profiles: %s', 16, 1, @add_error_message);
            END;
        END CATCH;
    END;
END;
GO
