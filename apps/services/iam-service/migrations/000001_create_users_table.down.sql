-- Drop users table and related objects
-- This migration rolls back the users table creation

-- Drop trigger first
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop table
DROP TABLE IF EXISTS users;

-- Drop trigger function if no other tables use it
-- Note: Only drop if you're sure no other tables use this function
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop extension if no other tables use uuid-ossp
-- Note: Only drop if you're sure no other tables use uuid_generate_v4()
-- DROP EXTENSION IF EXISTS "uuid-ossp";