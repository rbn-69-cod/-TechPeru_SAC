-- Additive guards: existing rows remain unchanged, including historical duplicates.
CREATE INDEX IF NOT EXISTS idx_measurements_identity ON measurements(kpi_id, period, date);
CREATE INDEX IF NOT EXISTS idx_initiatives_kpi ON initiatives(kpi_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

CREATE TRIGGER IF NOT EXISTS measurement_duplicate_update
BEFORE UPDATE OF kpi_id, period, date ON measurements
WHEN EXISTS (SELECT 1 FROM measurements WHERE kpi_id = NEW.kpi_id AND period = NEW.period AND date = NEW.date AND id <> OLD.id)
BEGIN SELECT RAISE(ABORT, 'Duplicate measurement constraint'); END;

CREATE TRIGGER IF NOT EXISTS initiative_relation_insert BEFORE INSERT ON initiatives
WHEN NEW.kpi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM kpis WHERE id = NEW.kpi_id AND objective_id = NEW.objective_id)
BEGIN SELECT RAISE(ABORT, 'Initiative KPI relation constraint'); END;
CREATE TRIGGER IF NOT EXISTS initiative_relation_update BEFORE UPDATE OF kpi_id, objective_id ON initiatives
WHEN NEW.kpi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM kpis WHERE id = NEW.kpi_id AND objective_id = NEW.objective_id)
BEGIN SELECT RAISE(ABORT, 'Initiative KPI relation constraint'); END;

CREATE TRIGGER IF NOT EXISTS kpi_relation_insert BEFORE INSERT ON kpis
WHEN NOT EXISTS (SELECT 1 FROM objectives WHERE id = NEW.objective_id AND perspective_id = NEW.perspective_id)
BEGIN SELECT RAISE(ABORT, 'KPI perspective relation constraint'); END;
CREATE TRIGGER IF NOT EXISTS kpi_relation_update BEFORE UPDATE OF objective_id, perspective_id ON kpis
WHEN NOT EXISTS (SELECT 1 FROM objectives WHERE id = NEW.objective_id AND perspective_id = NEW.perspective_id)
 OR EXISTS (SELECT 1 FROM initiatives WHERE kpi_id = OLD.id AND objective_id <> NEW.objective_id)
BEGIN SELECT RAISE(ABORT, 'KPI perspective relation constraint'); END;
CREATE TRIGGER IF NOT EXISTS objective_perspective_sync AFTER UPDATE OF perspective_id ON objectives
BEGIN UPDATE kpis SET perspective_id = NEW.perspective_id WHERE objective_id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS kpi_unlink_initiatives BEFORE DELETE ON kpis
BEGIN UPDATE initiatives SET kpi_id = NULL WHERE kpi_id = OLD.id; END;

CREATE TRIGGER IF NOT EXISTS initiative_range_insert BEFORE INSERT ON initiatives
WHEN NEW.progress_pct < 0 OR NEW.progress_pct > 100 OR NEW.budget < 0 OR NEW.end_date < NEW.start_date
BEGIN SELECT RAISE(ABORT, 'Initiative range constraint'); END;
CREATE TRIGGER IF NOT EXISTS initiative_range_update BEFORE UPDATE OF progress_pct, budget, start_date, end_date ON initiatives
WHEN NEW.progress_pct < 0 OR NEW.progress_pct > 100 OR NEW.budget < 0 OR NEW.end_date < NEW.start_date
BEGIN SELECT RAISE(ABORT, 'Initiative range constraint'); END;

CREATE TRIGGER IF NOT EXISTS user_email_insert BEFORE INSERT ON users
WHEN EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER(NEW.email))
BEGIN SELECT RAISE(ABORT, 'User email constraint'); END;
CREATE TRIGGER IF NOT EXISTS user_email_update BEFORE UPDATE OF email ON users
WHEN EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER(NEW.email) AND id <> OLD.id)
BEGIN SELECT RAISE(ABORT, 'User email constraint'); END;
