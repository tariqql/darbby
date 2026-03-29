-- Darbby — Create 7 Independent Databases
-- Run as postgres superuser:
-- sudo -u postgres psql < ~/darbby/scripts/create-databases.sql

CREATE DATABASE darbby_customers;
CREATE DATABASE darbby_merchants;
CREATE DATABASE darbby_dina;
CREATE DATABASE darbby_trips;
CREATE DATABASE darbby_orders;
CREATE DATABASE darbby_notifications;
CREATE DATABASE darbby_operations;

GRANT ALL PRIVILEGES ON DATABASE darbby_customers TO darbby;
GRANT ALL PRIVILEGES ON DATABASE darbby_merchants TO darbby;
GRANT ALL PRIVILEGES ON DATABASE darbby_dina TO darbby;
GRANT ALL PRIVILEGES ON DATABASE darbby_trips TO darbby;
GRANT ALL PRIVILEGES ON DATABASE darbby_orders TO darbby;
GRANT ALL PRIVILEGES ON DATABASE darbby_notifications TO darbby;
GRANT ALL PRIVILEGES ON DATABASE darbby_operations TO darbby;

\echo 'All 7 databases created and granted to darbby user.'
