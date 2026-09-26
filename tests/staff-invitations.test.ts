import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { acceptInvite, issueInvite } from "../src/lib/onboarding";
import { createBookingSetup } from "../src/lib/bookings";
import { saveStaffMember } from "../src/lib/staff";

let db: Db;
let service: string;
const club = "willow";
const password = "A-secure-test-password-26";
before(async () => {
  db = await initialise(await PGlite.create());
  service = (
    await createBookingSetup(db, "manager", club, {
      service_name: "Invitation groom",
      resource_name: "Invitation station",
      duration_minutes: 60,
      cleanup_minutes: 15,
      price_pounds: "45.00",
      cancellation_terms: "Cancel 24 hours before.",
      date: "2099-12-01",
      starts_at: "09:00",
      ends_at: "12:00",
      break_starts_at: "",
      break_ends_at: "",
    })
  ).serviceId;
});
after(async () => db.close());

test("staff invitation atomically creates membership, access, qualifications and audit", async () => {
  const token = await issueInvite(
    db,
    "manager",
    "staff",
    {
      managerEmail: "new-groomer@test.invalid",
      role: "groomer",
      can_manage_booking_setup: true,
      service_ids: [service],
    },
    club,
  );
  const stored = (
    await db.query<{
      token_hash: string;
      staff_config: Record<string, unknown>;
    }>(
      "SELECT token_hash,staff_config FROM onboarding_invites WHERE email='new-groomer@test.invalid'",
    )
  ).rows[0];
  assert.equal(
    stored.token_hash,
    createHash("sha256").update(token).digest("hex"),
  );
  assert.notEqual(stored.token_hash, token);
  const joined = await acceptInvite(db, token, {
    email: "new-groomer@test.invalid",
    password,
  });
  const record = (
    await db.query<{
      membership_role: string;
      staff_role: string;
      can_manage_booking_setup: boolean;
    }>(
      `SELECT m.role AS membership_role,s.role AS staff_role,s.can_manage_booking_setup FROM accounts a JOIN memberships m ON m.account_id=a.id JOIN staff_members s ON s.club_id=m.club_id AND s.account_id=m.account_id WHERE a.email=$1 AND m.club_id=$2`,
      ["new-groomer@test.invalid", club],
    )
  ).rows[0];
  assert.equal(joined.slug, "willow");
  assert.deepEqual(record, {
    membership_role: "member",
    staff_role: "groomer",
    can_manage_booking_setup: true,
  });
  assert.equal(
    (
      await db.query(
        "SELECT 1 FROM staff_service_qualifications q JOIN accounts a ON a.id=q.account_id WHERE q.club_id=$1 AND q.service_id=$2 AND a.email=$3",
        [club, service, "new-groomer@test.invalid"],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "SELECT 1 FROM staff_access_events e JOIN accounts a ON a.id=e.staff_account_id WHERE e.club_id=$1 AND e.action='staff.assigned' AND a.email=$2",
        [club, "new-groomer@test.invalid"],
      )
    ).rows.length,
    1,
  );
});

test("existing accounts must authenticate before accepting staff access", async () => {
  const token = await issueInvite(
    db,
    "manager",
    "staff",
    { managerEmail: "alice@demo.invalid", role: "reception", service_ids: [] },
    club,
  );
  await assert.rejects(
    acceptInvite(db, token, { email: "alice@demo.invalid", password }),
    /Sign in/,
  );
  await assert.rejects(
    acceptInvite(db, token, { email: "alice@demo.invalid" }, "bea"),
    /Sign in/,
  );
  await acceptInvite(db, token, { email: "alice@demo.invalid" }, "alice");
  assert.equal(
    (
      await db.query<{ role: string }>(
        "SELECT role FROM staff_members WHERE club_id=$1 AND account_id='alice'",
        [club],
      )
    ).rows[0].role,
    "reception",
  );
});

test("delegated staff admins can invite within their tenant but cannot attach foreign services", async () => {
  await saveStaffMember(db, "manager", club, {
    account_id: "bea",
    role: "manager",
    can_manage_staff: true,
    service_ids: [],
  });
  const token = await issueInvite(
    db,
    "bea",
    "staff",
    {
      managerEmail: "reception@test.invalid",
      role: "reception",
      service_ids: [],
    },
    club,
  );
  assert.equal(typeof token, "string");
  await assert.rejects(
    issueInvite(
      db,
      "bea",
      "staff",
      {
        managerEmail: "wrong@test.invalid",
        role: "groomer",
        service_ids: ["00000000-0000-4000-8000-000000000999"],
      },
      club,
    ),
    /qualifications/,
  );
  await assert.rejects(
    issueInvite(
      db,
      "bea",
      "staff",
      {
        managerEmail: "coast-staff@test.invalid",
        role: "cafe",
        service_ids: [],
      },
      "coast",
    ),
    /permission/,
  );
  await assert.rejects(
    issueInvite(
      db,
      "manager",
      "staff",
      {
        managerEmail: "manager@demo.invalid",
        role: "cafe",
        service_ids: [],
      },
      club,
    ),
    /already have full club administration/,
  );
});
