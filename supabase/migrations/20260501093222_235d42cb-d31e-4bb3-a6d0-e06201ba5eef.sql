DELETE FROM parmenion_decision_log WHERE domain ILIKE '%iktracker%' AND action_type='cms' AND status='planned';

UPDATE autopilot_configs SET status='idle', force_content_cycle=true, updated_at=now() WHERE id IN ('0092c4c9-7d82-417b-ae93-5fc67c8fdd38','6b8634bb-8141-4438-ae4f-b42e10d8d889');