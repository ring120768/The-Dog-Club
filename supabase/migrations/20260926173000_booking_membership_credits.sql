ALTER TABLE grooming_services
 ADD COLUMN membership_credit_eligible boolean NOT NULL DEFAULT false,
 ADD COLUMN membership_credit_cost integer NOT NULL DEFAULT 1 CHECK(membership_credit_cost BETWEEN 1 AND 100);

ALTER TABLE grooming_bookings
 ADD COLUMN amount_due_pence_snapshot integer,
 ADD COLUMN membership_subscription_id uuid,
 ADD COLUMN grooming_credits_applied integer NOT NULL DEFAULT 0 CHECK(grooming_credits_applied BETWEEN 0 AND 100);

UPDATE grooming_bookings SET amount_due_pence_snapshot=price_pence_snapshot;

ALTER TABLE grooming_bookings
 ALTER COLUMN amount_due_pence_snapshot SET NOT NULL,
 ADD CONSTRAINT grooming_booking_credit_snapshot_check CHECK(
  (grooming_credits_applied=0 AND membership_subscription_id IS NULL AND amount_due_pence_snapshot=price_pence_snapshot)
  OR
  (grooming_credits_applied>0 AND membership_subscription_id IS NOT NULL AND amount_due_pence_snapshot=0)
 ),
 ADD CONSTRAINT grooming_booking_membership_subscription_fk
  FOREIGN KEY(club_id,membership_subscription_id) REFERENCES member_subscriptions(club_id,id);
