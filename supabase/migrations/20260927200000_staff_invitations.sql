ALTER TABLE onboarding_invites DROP CONSTRAINT onboarding_invites_kind_check;
ALTER TABLE onboarding_invites DROP CONSTRAINT onboarding_invites_check;
ALTER TABLE onboarding_invites ADD COLUMN staff_config jsonb;
ALTER TABLE onboarding_invites ADD CONSTRAINT onboarding_invites_kind_check CHECK(kind IN ('operator','member','staff'));
ALTER TABLE onboarding_invites ADD CONSTRAINT onboarding_invites_payload_check CHECK(
 (kind='member' AND club_id IS NOT NULL AND branding IS NULL AND staff_config IS NULL) OR
 (kind='staff' AND club_id IS NOT NULL AND branding IS NULL AND staff_config IS NOT NULL) OR
 (kind='operator' AND club_id IS NULL AND branding IS NOT NULL AND staff_config IS NULL)
);
