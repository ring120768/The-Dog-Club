import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import {
  createBookingSetup,
  createLocation,
  setInventoryActive,
  availabilityFor,
} from "../src/lib/bookings";
import {
  deactivateStaffMember,
  saveStaffMember,
  staffAdminFor,
} from "../src/lib/staff";
import { submitApplication, reviewApplication } from "../src/lib/applications";

let db: Db;
const club = "willow";
const day = "2099-11-03";
before(async () => {
  db = await initialise(await PGlite.create());
  await submitApplication(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    {
      emergency_contact: "Test human 07700 900000",
      handling_notes: "None known",
      version: 0,
      intent: "submit",
    },
  );
  await reviewApplication(
    db,
    "manager",
    club,
    "00000000-0000-4000-8000-000000000001",
    {
      status: "approved",
      reason: "Approved for synthetic staff test",
      version: 1,
    },
  );
});
after(async () => db.close());

test("manager assigns a groomer and delegated booking setup creates location-scoped availability", async () => {
  await saveStaffMember(db, "manager", club, {
    account_id: "bea",
    role: "groomer",
    can_manage_booking_setup: true,
    service_ids: [],
  });
  await createLocation(db, "bea", club, {
    name: "Basement salon",
    address_label: "Lower ground floor",
  });
  const locations = (await staffAdminFor(db, "manager", club)).people;
  assert.equal(
    locations.find((person) => person.account_id === "bea")?.staff_role,
    "groomer",
  );
  const location = (
    await db.query<{ id: string }>(
      "SELECT id FROM club_locations WHERE club_id=$1 AND name='Basement salon'",
      [club],
    )
  ).rows[0];
  const setup = await createBookingSetup(db, "bea", club, {
    service_name: "Staff test groom",
    resource_name: "Basement station",
    duration_minutes: 60,
    cleanup_minutes: 15,
    price_pounds: "55.00",
    cancellation_terms: "Cancel 24 hours before.",
    date: day,
    starts_at: "09:00",
    ends_at: "12:00",
    break_starts_at: "",
    break_ends_at: "",
    location_id: location.id,
    staff_id: "bea",
  });
  const result = await availabilityFor(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    setup.serviceId,
    day,
  );
  assert.ok(result.slots.some((slot) => slot.local_time === "09:00"));
  const inventory = await db.query<{
    resource_location: string;
    shift_location: string;
  }>(
    `SELECT r.location_id AS resource_location,s.location_id AS shift_location FROM grooming_resources r JOIN published_shifts s ON s.club_id=r.club_id WHERE r.id=$1 AND s.id=$2`,
    [setup.resourceId, setup.shiftId],
  );
  assert.equal(inventory.rows[0].resource_location, location.id);
  assert.equal(inventory.rows[0].shift_location, location.id);
  await assert.rejects(
    setInventoryActive(db, "bea", club, {
      kind: "location",
      id: location.id,
      active: "false",
    }),
    /Retire active stations/,
  );
  await setInventoryActive(db, "bea", club, {
    kind: "resource",
    id: setup.resourceId,
    active: "false",
  });
  assert.deepEqual(
    (
      await availabilityFor(
        db,
        "alice",
        club,
        "00000000-0000-4000-8000-000000000001",
        setup.serviceId,
        day,
      )
    ).slots,
    [],
  );
  await setInventoryActive(db, "bea", club, {
    kind: "resource",
    id: setup.resourceId,
    active: "true",
  });
});

test("deactivation removes delegated access and future groomer availability while retaining audit", async () => {
  const service = (
    await db.query<{ id: string }>(
      "SELECT id FROM grooming_services WHERE club_id=$1 AND name='Staff test groom'",
      [club],
    )
  ).rows[0];
  await deactivateStaffMember(db, "manager", club, "bea");
  await assert.rejects(
    createLocation(db, "bea", club, {
      name: "Unauthorised site",
      address_label: "",
    }),
    /permission/,
  );
  const result = await availabilityFor(
    db,
    "alice",
    club,
    "00000000-0000-4000-8000-000000000001",
    service.id,
    day,
  );
  assert.deepEqual(result.slots, []);
  const events = await db.query<{ action: string }>(
    "SELECT action FROM staff_access_events WHERE club_id=$1 AND staff_account_id='bea' ORDER BY id",
    [club],
  );
  assert.deepEqual(
    events.rows.map((event) => event.action),
    ["staff.assigned", "staff.deactivated"],
  );
});

test("staff authority remains tenant scoped and cannot be self-granted", async () => {
  await assert.rejects(
    saveStaffMember(db, "bea", club, {
      account_id: "bea",
      role: "manager",
      can_manage_staff: true,
      service_ids: [],
    }),
    /permission/,
  );
  await assert.rejects(
    saveStaffMember(db, "manager", "coast", {
      account_id: "coast-member",
      role: "manager",
      can_manage_staff: true,
      service_ids: [],
    }),
    /permission/,
  );
  await assert.rejects(
    saveStaffMember(db, "manager", club, {
      account_id: "manager",
      role: "cafe",
      service_ids: [],
    }),
    /already have full club administration/,
  );
});
