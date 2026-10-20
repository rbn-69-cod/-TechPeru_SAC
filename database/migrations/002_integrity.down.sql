-- Roll back only the objects introduced by migration 002; never remove business data.
DROP TRIGGER IF EXISTS measurement_duplicate_update;
DROP TRIGGER IF EXISTS initiative_relation_insert;
DROP TRIGGER IF EXISTS initiative_relation_update;
DROP TRIGGER IF EXISTS kpi_relation_insert;
DROP TRIGGER IF EXISTS kpi_relation_update;
DROP TRIGGER IF EXISTS objective_perspective_sync;
DROP TRIGGER IF EXISTS kpi_unlink_initiatives;
DROP TRIGGER IF EXISTS initiative_range_insert;
DROP TRIGGER IF EXISTS initiative_range_update;
DROP TRIGGER IF EXISTS user_email_insert;
DROP TRIGGER IF EXISTS user_email_update;
DROP INDEX IF EXISTS idx_measurements_identity;
DROP INDEX IF EXISTS idx_initiatives_kpi;
DROP INDEX IF EXISTS idx_users_email_lower;
PRAGMA user_version = 1;
