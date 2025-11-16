IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_bookings_guest_profiles'
      AND parent_object_id = OBJECT_ID('dbo.bookings')
)
BEGIN
    ALTER TABLE dbo.bookings
        ADD CONSTRAINT FK_bookings_guest_profiles
            FOREIGN KEY (guest_id) REFERENCES dbo.guest_profiles(id);
END;
