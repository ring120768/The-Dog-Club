import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { initialise, type Db } from "../src/lib/database";
import { acceptInvite, issueInvite } from "../src/lib/onboarding";
import { createBookingSetup } from "../src/lib/bookings";
import { clubsFor, publicDog, saveDog } from "../src/lib/dogs";
import {
  changeOperatorState,
  operatorLifecycleForPlatform,
} from "../src/lib/operator-lifecycle";

let db: Db;
const password = "SyntheticPassword-Only26";
let manager: string;
let member: string;
let club: string;
let dog: string;

before(async () => {
  db = await initialise(await PGlite.create());
  const token = await issueInvite(db, "platform-owner", "operator", {
    name: "Lifecycle Hounds",
    slug: "lifecycle-hounds",
    location: "London",
    tagline: "Synthetic lifecycle proof.",
    colour: "#633c56",
    emblem: "heart",
    avatar_tone: "rose",
    managerEmail: "lifecycle-manager@test.invalid",
  });
  const accepted = await acceptInvite(db, token, {
    email: "lifecycle-manager@test.invalid",
    password,
  });
  manager = accepted.accountId;
  club = (await clubsFor(db, manager))[0].id;
});

after(async () => db.close());

test("onboarding admits managers and staff setup but not members", async () => {
  assert.equal((await clubsFor(db, manager))[0].operator_state, "onboarding");
  await assert.rejects(
    issueInvite(
      db,
      manager,
      "member",
      { managerEmail: "early-member@test.invalid" },
      club,
    ),
    /trial or active service/,
  );
  await createBookingSetup(db, manager, club, {
    service_name: "Lifecycle groom",
    resource_name: "Lifecycle station",
    duration_minutes: 60,
    cleanup_minutes: 15,
    price_pounds: "50.00",
    membership_credit_eligible: "no",
    membership_credit_cost: 1,
    cancellation_terms: "Cancel at least 24 hours before.",
    date: "2099-12-10",
    starts_at: "09:00",
    ends_at: "17:00",
    break_starts_at: "12:00",
    break_ends_at: "12:30",
    staff_id: manager,
  });
  await changeOperatorState(db, "platform-owner", club, {
    state: "trial",
    reason: "All synthetic walkthrough checks are complete.",
  });
  assert.equal((await clubsFor(db, manager))[0].operator_state, "trial");
});

test("activation requires explicit external confirmation and every change is audited", async () => {
  await assert.rejects(
    changeOperatorState(db, "platform-owner", club, {
      state: "active",
      reason: "Attempted without the external review confirmation.",
    }),
    /external live-readiness review/,
  );
  await changeOperatorState(db, "platform-owner", club, {
    state: "active",
    reason: "Synthetic external readiness confirmation for the test only.",
    live_confirmation: "yes",
  });
  const history = await operatorLifecycleForPlatform(
    db,
    "platform-owner",
    club,
  );
  assert.deepEqual(
    history.map((event) => `${event.from_state}:${event.to_state}`),
    ["trial:active", "onboarding:trial"],
  );
  await assert.rejects(operatorLifecycleForPlatform(db, manager, club));
});

test("restriction blocks growth while preserving existing access and records", async () => {
  const token = await issueInvite(
    db,
    manager,
    "member",
    { managerEmail: "lifecycle-member@test.invalid" },
    club,
  );
  member = (
    await acceptInvite(db, token, {
      email: "lifecycle-member@test.invalid",
      password,
    })
  ).accountId;
  dog = await saveDog(db, member, club, undefined, {
    name: "Archive",
    breed: "Terrier",
    bio: "A synthetic record that must survive lifecycle changes.",
    avatar: "sand",
    audience: "public",
  });
  const membershipCount = Number(
    (
      await db.query<{ count: string }>(
        "SELECT count(*) FROM memberships WHERE club_id=$1",
        [club],
      )
    ).rows[0].count,
  );
  await changeOperatorState(db, "platform-owner", club, {
    state: "restricted",
    reason: "Synthetic commercial restriction while obligations are reviewed.",
  });
  assert.equal((await clubsFor(db, member))[0].operator_state, "restricted");
  assert.equal((await publicDog(db, club, dog))?.name, "Archive");
  await assert.rejects(
    issueInvite(
      db,
      manager,
      "member",
      { managerEmail: "blocked-growth@test.invalid" },
      club,
    ),
    /restricted or closed/,
  );
  assert.equal(
    Number(
      (
        await db.query<{ count: string }>(
          "SELECT count(*) FROM memberships WHERE club_id=$1",
          [club],
        )
      ).rows[0].count,
    ),
    membershipCount,
  );
});

test("closure removes ordinary and public access without deleting operator records", async () => {
  await changeOperatorState(db, "platform-owner", club, {
    state: "closed",
    reason: "Synthetic offboarding completed for lifecycle verification.",
  });
  assert.deepEqual(await clubsFor(db, manager), []);
  assert.deepEqual(await clubsFor(db, member), []);
  assert.equal(await publicDog(db, club, dog), null);
  await assert.rejects(
    saveDog(db, member, club, dog, {
      name: "Changed after closure",
      breed: "Terrier",
      bio: "This write must never succeed.",
      avatar: "sand",
      audience: "private",
    }),
    /lifecycle state/,
  );
  assert.equal(
    Number(
      (
        await db.query<{ count: string }>(
          "SELECT count(*) FROM memberships WHERE club_id=$1",
          [club],
        )
      ).rows[0].count,
    ),
    2,
  );
  await assert.rejects(
    changeOperatorState(db, "platform-owner", club, {
      state: "active",
      reason: "Closed operators cannot be silently reopened.",
      live_confirmation: "yes",
    }),
    /cannot move from closed/,
  );
});
