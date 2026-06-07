-- ============================================================
-- Sanjeevani AI — Database Schema
-- Run this once in Supabase → SQL Editor → New Query
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE;
CREATE EXTENSION IF NOT EXISTS "cube" CASCADE;

-- ============================================================
-- EVENTS table (the gathering being managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    location    TEXT,
    center_lat  DECIMAL(10,8) NOT NULL,
    center_lng  DECIMAL(11,8) NOT NULL,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed a default Mahakumbh event
INSERT INTO events (name, location, center_lat, center_lng)
VALUES ('Mahakumbh 2025', 'Prayagraj, Uttar Pradesh', 25.4358, 81.8463)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INCIDENTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_id            UUID REFERENCES incidents(id) ON DELETE SET NULL,

    -- Report input
    report_method           TEXT CHECK (report_method IN ('sos', 'voice', 'text', 'image')) NOT NULL,
    raw_input               TEXT,
    image_url               TEXT,
    audio_url               TEXT,

    -- AI enriched fields
    category                TEXT,
    severity                TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    severity_score          SMALLINT CHECK (severity_score BETWEEN 1 AND 10),
    ai_summary              TEXT,
    recommended_resource_type TEXT,
    yolo_detections         JSONB,

    -- Location
    latitude                DECIMAL(10,8) NOT NULL,
    longitude               DECIMAL(11,8) NOT NULL,
    location_label          TEXT,

    -- Lifecycle status
    status                  TEXT DEFAULT 'reported' CHECK (
                                status IN ('reported','analyzing','verified','assigned','en_route','on_site','resolved')
                            ),

    -- Deduplication
    confirmation_count      INTEGER DEFAULT 1,

    -- Relations
    reporter_id             TEXT,
    event_id                UUID REFERENCES events(id),

    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_status       ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity     ON incidents(severity_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_incidents_event        ON incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created      ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_canonical    ON incidents(canonical_id);

-- ============================================================
-- RESOURCES table
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('ambulance','police','volunteer','rescue','medical_post')),
    status      TEXT DEFAULT 'available' CHECK (status IN ('available','dispatched','unavailable')),
    latitude    DECIMAL(10,8) NOT NULL,
    longitude   DECIMAL(11,8) NOT NULL,
    event_id    UUID REFERENCES events(id),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed demo resources for Mahakumbh event
WITH event AS (SELECT id FROM events WHERE name = 'Mahakumbh 2025' LIMIT 1)
INSERT INTO resources (name, type, latitude, longitude, event_id) SELECT
    v.name, v.type,
    v.lat + (random() - 0.5) * 0.01,
    v.lng + (random() - 0.5) * 0.01,
    event.id
FROM event, (VALUES
    ('Ambulance Unit 1',   'ambulance',    25.4358, 81.8463),
    ('Ambulance Unit 2',   'ambulance',    25.4380, 81.8490),
    ('Ambulance Unit 3',   'ambulance',    25.4330, 81.8440),
    ('Police Team Alpha',  'police',       25.4370, 81.8470),
    ('Police Team Beta',   'police',       25.4340, 81.8450),
    ('Police Team Gamma',  'police',       25.4395, 81.8510),
    ('Rescue Team 1',      'rescue',       25.4360, 81.8455),
    ('Rescue Team 2',      'rescue',       25.4345, 81.8480),
    ('Volunteer Squad A',  'volunteer',    25.4375, 81.8460),
    ('Volunteer Squad B',  'volunteer',    25.4350, 81.8500),
    ('Medical Post 1',     'medical_post', 25.4400, 81.8520),
    ('Medical Post 2',     'medical_post', 25.4320, 81.8430)
) AS v(name, type, lat, lng)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DISPATCHES table
-- ============================================================
CREATE TABLE IF NOT EXISTS dispatches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id     UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    dispatched_at   TIMESTAMPTZ DEFAULT now(),
    arrived_at      TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    notes           TEXT,
    UNIQUE(incident_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatches_incident ON dispatches(incident_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_resource ON dispatches(resource_id);

-- ============================================================
-- INCIDENT_EVENTS table (audit trail / timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS incident_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    actor       TEXT DEFAULT 'system',
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inc_events_incident ON incident_events(incident_id);

-- ============================================================
-- Enable Realtime on incidents and resources
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE resources;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();