# Integrating AcopioVE into HelpMaps

> Contribution proposal. Branch `feat/multi-emergencia`.
> Status: under construction. None of this is deployed yet.

This document explains what we are building on top of HelpMaps, why, and — most importantly
for you — what does **not** change in your existing deployments if you take this branch.

It is written from AcopioVE ([acopiove.org](https://acopiove.org)), the project you already
exchange data with: you pull our shelters through `GET /v1/centros`, and we have your
patient feed wired and switched off waiting for your go-ahead. This is the next step of that
integration. Instead of two applications passing data to each other, one codebase both
operations can deploy.

**One thing up front, because it reverses our original proposal.** We first designed this as
a single deployment serving every country from one database, with one console over all of
them. You pushed back: the maps have to stay isolated per country because the legal
responsibility for the data is territorial. You were right, and the argument is stronger
than a preference — it is spelled out in section 2. Everything below assumes **your** model:
one repository, one deployment per country, one database per country.

---

## 1. The problem this solves

HelpMaps resolves the country at build time. `NEXT_PUBLIC_COUNTRY` picks a preset from
`config/presets/`, the kit is assembled, and `SITE` is frozen inside the bundle. For a
deployment that is one country, that is the right call and this branch keeps it working
exactly as it does today.

What it cannot do is three things that show up as soon as the network has more than one
member:

- **Changing anything about a live country needs a rebuild.** Moving a viewport, adding an
  affected region, switching a module off, correcting the legal notice — each one is a
  commit, a review and a deploy. During the first week of an emergency the affected-region
  list changes daily.
- **A country cannot have two emergencies.** A country can have an earthquake this year and
  a flood the next, with a different viewport, different affected regions and different
  overlays. Today the second one overwrites the first, and the first is gone.
- **There is no registry of the network.** `config/network.ts` is a hand-maintained array.
  Nothing knows what is actually deployed, in what state, or answers "is Colombia up".

The change is one move: **the same `CountryConfig` object you already define, stored as a
row and resolved per request from the host.**

The contract stays the same `SITE` object the whole application reads today, so the map, the
detail sheet, the forms, the staff panel, the dictionaries and the PWA keep working without
knowing where the configuration came from. What changes is the source, not the consumer.

---

## 2. Data stays where it is — and why we changed our minds

Our first draft put every country in one database with an `emergency_id` column and RLS
separating them. Your objection was that the maps have to stay isolated for legal reasons.
Having thought it through, we think the argument is decisive, and it is worth writing down
so nobody reopens it later:

- **Responsibility is territorial.** `CountryLegal.controller` names the organisation that
  answers for the data. If two countries have different controllers, one shared database
  means one operator is processing personal data it is not responsible for — which turns an
  architecture decision into a legal relationship between two organisations, international
  transfer included.
- **Compulsion does not respect a `where` clause.** This application will hold data about
  missing people in Venezuela. If a Venezuelan entity is ordered to hand over its database
  and that database also holds Colombia's rows, the order reaches Colombia. Row-level
  security is not a defence against a court order served on the operator.
- **The blast radius of one leaked key is one country**, not the network.

None of that is recoverable after the fact. An architecture mistake can be refactored;
personal data that left its jurisdiction cannot be brought back.

So: **one database per country, one deployment per country, exactly as you have it.**

---

## 3. What does not change for you

This is what makes the branch safe to take without migrating anything.

**With no row in `emergencies`, the preset wins.** Resolution looks the host up in the table;
if nothing matches — no row, no table, no database reachable — it falls back to the compiled
preset. A Colombia deployment running `NEXT_PUBLIC_COUNTRY=co` with an empty table behaves
exactly as it did before this branch. That path is tested, not asserted: see section 8.

**The schema change is additive.** No column is renamed or dropped. One table is added, plus
a column on the existing ones, with a default that keeps every existing row valid. The new
files in `db/` are idempotent, like yours.

**Your deployment topology is untouched.** One repo, one deploy per country, one `git push`
updating all of them. That does not change and this branch does not ask it to.

**The design decisions you documented are respected.** The pin colour is still the point type
and never a status. `status: null` still means unknown and nothing defaults to "abierto".
Regions are still text checked against the active configuration. Volunteers still publish
live, with revocable access and an audit trail. The public still never writes the map. None
of those rules is touched — several of them are why we would rather build on your base than
on ours.

---

## 4. The schema change

Two new files in `db/`, after yours. **The same files run on every database**, the hub's and
each country's. What differs is how many rows land in one table.

### `db/007_emergencies.sql`

`emergencies` is `CountryConfig` serialised, plus the metadata of the event itself:

| Column | What it holds |
|---|---|
| `slug`, `host` | Identity, and how the row is resolved on each request |
| `country_code`, `country_name` | The country |
| `name`, `hazard_type`, `status` | The event, its kind, and whether it is draft, active or archived |
| `region_noun`, `geo`, `regions`, `legal` | The same fields the preset carries today |
| `brand`, `features`, `language`, `hazard` | The overrides, in the shape you already accept |
| `layers` | Extra overlays for this emergency (see section 6) |
| `maintenance`, `notice` | Per-emergency operating state |

The `jsonb` columns hold exactly the shape your own types define in `src/config/types.ts`.
An existing preset becomes a row with no translation step: it is the same object.

`app_settings` is deliberately **left alone**. It keeps meaning what it means today — the
kill switch for the whole installation. Maintenance and the notice banner for one emergency
are columns on `emergencies`, which is where they belong, and changing the shape of your
single-row table would have been the one part of this migration that was not additive.

### `db/008_tenancy.sql`

Adds `emergency_id` to `locations`, `submissions`, `volunteer_requests`, `donations` and
`audit_log`; adds `country_code` to `locations` for diaspora points; creates
`staff_emergencies` for membership, and `emergency_phones` for the emergency phone directory.

**On a single-country database this column is nearly degenerate, and it still earns its
place**: it is what lets that country run a second emergency later — a flood after an
earthquake — without the first one's points bleeding into the new map, and without a second
database. A `null` means "the deployment's implicit emergency", so existing rows stay valid
with no backfill.

Scope is enforced where you already put the boundary: **in the RLS policies**. A
`can_edit(emergency_id)` function checks membership before any write.

```sql
create policy locations_staff_update on public.locations
  for update to authenticated
  using (public.can_edit(emergency_id))
  with check (public.can_edit(emergency_id));
```

Under your trust model — verified volunteers publishing live, with no review queue in front
of them — a filter someone forgets is not a miscounted row: it is a volunteer editing the
wrong emergency's points. In the database it cannot be forgotten.

The `audit_log` policy is the one place where two rules had to be combined rather than
replaced: `006_audit_scope.sql` restricts volunteers to map entities, and the scoped version
keeps that condition and adds membership on top. Writing it with the scope alone would have
handed `volunteer_requests` back to volunteers — exactly what your `006` closed.

`db/099_security_check.sql` gets one change of its own. Its `search_path` check listed the
function names by hand, so it only ever inspected `is_staff`, `is_admin` and
`touch_updated_at`. It now checks **every** SECURITY DEFINER function in `public` and reports
any without a pinned `search_path`. That was not only about our additions: the hardcoded list
was already missing `guard_submission_status` and `guard_volunteer_request_status`. A check
someone has to remember to update is not a check.

---

## 5. The hub becomes the registry

This is the part that replaces the centralised console we originally proposed, and it uses
something you already built.

`NEXT_PUBLIC_MODE=hub` already gives helpmaps.net its own deployment, with the network map
and the API documentation. Today it reads a hand-maintained array in `config/network.ts`.
The proposal is to let it read the `emergencies` table instead — **in the hub's own
database**, which holds configuration and nothing else:

```
hub database        emergencies (every country's configuration)
                    no locations, no submissions, no people. Ever.

country database    emergencies (this country's own row, or rows)
                    locations, center_info, submissions, volunteer_requests, audit_log
```

What that buys, without moving a single personal record across a border:

- **A console that can create and edit a country's configuration** instead of a pull request.
- **A network map that reflects what is actually deployed**, because it is reading state
  rather than an array someone remembered to update.
- **Aggregate figures on the hub** read from each country's public API, which is already
  CC-BY open data — never from its private tables.

And the resilience story is already built: a country deployment caches its configuration and
falls back to the compiled preset, so the hub being down cannot blank anyone's map. That
fallback is not a new promise; it is the same one tested in section 8.

Publishing a configuration from the hub to a country's database is a synchronisation step,
and it is the one genuinely new piece of machinery this direction needs. It is deliberately
scheduled last, because until it exists a country's row is simply authored in its own
database and nothing is blocked.

---

## 6. What AcopioVE brings

We are the side with data and daily operation since the first day of the earthquake: 712
active points across 24 countries, 78 emergency phone numbers, twelve external sources
aggregated live, and WhatsApp and Telegram bots answering over the same data. That is what we
contribute — not another way of doing what you already did well.

**Map rendering engine.** Your `MapCanvas` rebuilds every marker on each `zoomend`. With
seven hundred points and one `divIcon` per point, that stutters on a phone. We bring the
cluster group with chunked loading and bulk insertion we run in production, but **keeping
your semantics**: one cluster group per point type, so a cluster's colour is still the type
and never has to lie about what it contains. We ended up colouring by freshness precisely
because we used a single mixed group; one group per type gets both properties at once.

**Map overlays.** Earthquakes with contours, SAR satellite damage, damaged buildings in 3D,
rain, weather and alerts. Ours are Venezuela-specific inside, so they become per-emergency
definitions — label, kind, URL, attribution, on by default — and the layers panel is built
from whatever that emergency declares. The 3D map lives on its own route behind a button:
MapLibre is close to a megabyte and the main map has to open on a bad connection.

**News bulletin.** A synthesis of RSS feeds filtered for relevance, generated by cron and
served from cache. Feeds are declared per emergency.

**Public API.** Our `/v1` contract with JSON, GeoJSON and CSV formats, proximity filtering,
`updatedSince`, and moderated third-party contribution. It is the same contract you already
consume.

**PII safeguards.** National ID numbers always masked, minors without a location, no personal
phone numbers or exact coordinates for people, and a gate that aborts the deploy if a public
surface leaks any of it. This lands before the people modules, not after: it is the
precondition for `patients`, `rescued` and `missingReports` ever being switched on.

---

## 7. Roles

Your model is kept, with one role added above it.

| Role | Scope | Can | Cannot |
|---|---|---|---|
| `superadmin` | The registry, on the hub | Create and edit country configurations; appoint admins | Read or write any country's people data |
| `admin` | Their own emergency | Everything inside it, including delete and maintenance mode | Reach another country |
| `volunteer` | Their own emergency | Publish and edit live, with no review queue | Delete; manage the team |

The line under `superadmin` is the one that matters and it is a direct consequence of section
2: a superadmin administers **configuration**, not people. There is no role in this design
that can read one country's `locations` from another country's session, because there is no
connection between those databases for a role to travel over.

The first `superadmin` is created by hand in SQL, the same way your first `admin` is today,
and for the same reason.

---

## 8. What is already verified

Against a real Supabase project, not in principle:

- The nine migrations run in order and are idempotent — the whole chain twice, no errors.
- `099_security_check.sql` passes: RLS on all eleven tables, zero rows reachable by `anon`
  on `submissions`, `volunteer_requests` and `staff_users`, and no SECURITY DEFINER function
  without a pinned `search_path`.
- Configuration resolves from a row when the host matches: 24 regions, viewport and legal
  notice served from Postgres.
- **Configuration falls back to the compiled preset when the host matches nothing** — the
  compatibility guarantee in section 3, checked by serving both and confirming they differ.
- A row that fails `validateConfig` is logged and dropped, and the request falls back to the
  preset. Your validator throws on the server so a half-filled preset breaks the build of
  whoever deploys it; that reasoning does not carry to a row, which is edited at runtime with
  no build to break. A stale country is recoverable; a blank screen for someone looking for a
  shelter is not.

---

## 9. What we are asking of you

Smaller than our first draft, because that one asked you to give up data isolation.

1. **Review the schema in section 4** before we build on top of it. If anything about the
   shape of `emergencies` does not fit, it is far cheaper to change now.
2. **Tell us whether the hub-as-registry direction in section 5 is one you want.** It is the
   only part that adds a moving piece to the network rather than to a single deployment. If
   you would rather the hub stay a static page, everything else here still stands — a country
   just authors its own row.
3. **Confirm that this is welcome as a PR.** We are working on top of `upstream` with your
   history intact so the diff stays reviewable. As your own README puts it, a fork owes a
   merge on every fix that lands here, and the files that conflict are exactly the ones it
   edited.

---

## 10. Status

| Phase | What it covers | Status |
|---|---|---|
| 1 | Schema, host resolution, `SITE` hydrated from the row | Server side done and verified; client context pending |
| 2 | Staff panel scoped to its emergency; registry console on the hub | Pending |
| 3 | Map engine, per-emergency overlays, button to 3D | Pending |
| 4 | News bulletin on the entry page | Pending |
| 5 | Publishing configuration from the hub to a country | Pending |
| 6 | Scoped public API and external sources | Pending |

Every phase leaves the application deployable. None requires the previous one to have
reached production.
