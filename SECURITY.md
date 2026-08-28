# Security Policy

HelpMaps tells people where to go during a disaster. The worst outcome of a bug here is not a
leaked mailing list — it is a family walking across a city under curfew to a shelter that is not
there, or a person who reported a collapsed building being identified by the message they sent.

We would rather hear about a problem awkwardly than not at all. Thank you for looking.

---

## Reporting a vulnerability

**Email: info@helpmaps.net** — please put `[SECURITY]` in the subject line.

**Do not open a public GitHub issue for a security problem.** These deployments are live during
emergencies; a public report hands the exploit to everyone before we can close it. If you need an
encrypted channel, send a first message with no details and we will arrange one.

Please include:

- What you found, and the impact — what data or capability does it expose, and to whom?
- The steps to reproduce it. A description or a screenshot with real personal data redacted is
  enough; see the testing rules below.
- Anything you already know about a fix. Optional, and never expected.

**What to expect from us:**

| | |
|---|---|
| Acknowledgement | within 72 hours |
| Initial assessment | within 7 days |
| Fix for a high-severity issue | as fast as we can — these are live emergency services |
| Credit | by name or handle in the release notes if you want it; anonymous if you prefer |

We are a small team of volunteers. If you have not heard back in 72 hours, please send a reminder
rather than assuming we are ignoring you.

---

## What this project actually holds

Worth stating plainly, because it is what shapes the list below.

**Public by design.** `locations` and `center_info` — shelters, donation points, community
kitchens, initiatives, and damaged hospitals, with their address, coordinates, public phone and
what they need. All of it exists to circulate. Finding it "exposed" is not a vulnerability.

**Private, and the anon key is the only thing standing in front of it.** The browser talks to
Supabase directly with the public anon key, so **Row Level Security is not a layer of defence —
it is the whole of it**:

- `submissions` — what the public sends in. Free text plus, optionally, the sender's name and
  contact. Anyone may INSERT; **nobody outside the team may ever SELECT.**
- `volunteer_requests` — name, email, phone, and a written motivation from people asking to join
  a local team.
- `staff_users`, `audit_log` — who the team is and what each of them changed.

**Not implemented.** `patients`, `rescued` and `missingReports` are switches in
`config/features.ts` that no code reads yet. There is no admitted-persons list and no
missing-persons registry in this repository — please do not spend time hunting for one. When those
land, this policy changes with them.

**Isolation is physical, not configured.** Each country is its own Supabase project. A flaw in one
country's data cannot reach another's, because there is no shared database to reach across.

---

## What we consider most serious

In order. If you find one of these, it is worth waking us up about:

1. **Anonymous or unauthenticated read of `submissions` or `volunteer_requests`.** Someone who
   reports that a shelter has run out of water, or who volunteers, has not agreed to be published.
   These tables are the reason RLS exists.
2. **Any RLS bypass at all**, in either direction — reading what should be private, or writing
   without being staff. With the anon key in every browser, a bypass defeats every other control.
3. **Anything that lets a non-staff actor create or edit a `locations` row.** A pin at a wrong
   address is this application's defining failure: it is a person sent somewhere for nothing,
   during an emergency, possibly at night under curfew.
4. **`SUPABASE_SERVICE_ROLE_KEY` reaching the browser bundle.** It bypasses RLS entirely. Any code
   path, log line or error page that could emit it is critical.
5. **Staff account takeover** — session fixation, a working credential-stuffing path, a password
   reset that can be driven by someone else, or privilege escalation from `volunteer` to `admin`.
6. **Stored XSS through published point text.** Suggestion text becomes a published point after
   review; a payload that survives into the map or the detail card runs in a staff browser that
   holds write access.
7. **De-anonymising who submitted what**, via timing, sequential ids, error messages, or anything
   that correlates a public point back to the person who reported it.

Anything that damages the *trustworthiness* of what the map says counts here even when no data
leaks. Silently flipping a point's status to `abierto` is, in this application, a security issue.

---

## What is out of scope

- Missing security headers, cookie flags or TLS configuration with no demonstrated impact.
- Rate limiting on public **read** endpoints. The public API is meant to be scraped — it is
  published under CC BY 4.0 on purpose.
- Automated scanner output with no working proof of concept.
- Denial of service, volumetric or otherwise. Please do not.
- Vulnerabilities in Supabase, Vercel, OpenStreetMap, CARTO, Nominatim or USGS themselves — report
  those to them; tell us only if our configuration is what makes them exploitable.
- Self-XSS, or anything requiring a compromised device or a browser extension.
- Social engineering of volunteers.

The in-memory rate limiter is a **known** limitation, documented in `.env.example`: in a
serverless deployment with several instances it does not share state. Reporting that it can be
outrun is welcome; reporting it as a novel finding is not.

---

## Testing rules — please read, this one matters

**Do not collect real data.** If a proof of concept would return real submissions or real
volunteer applications, stop at the first record that proves access and redact it. Never store,
share or attach a dataset of real people. "I dumped the table to show the impact" is itself the
harm we are trying to prevent.

**Do not test against a live country deployment during an active emergency.** Clone the repo,
create your own Supabase project, run `db/001` through `005` and test there — the schema is the
same everywhere by design, which is exactly what makes this practical.

**Do not submit test points to a production map.** A fake shelter is not a harmless test artifact;
it is a wrong address in front of people who are looking for a real one.

**Do not attempt to access a staff account you do not own**, even if you believe you have found
the way in. Describe the path and let us verify it.

---

## Safe harbour

If you follow the rules above, act in good faith, and give us a reasonable chance to fix the issue
before disclosing it, we will not pursue or support any legal action against you, and we will treat
your report as an authorised contribution to this project.

If you are unsure whether something is in scope, ask first. We would rather answer a question than
receive an apology.

---

## Coordinated disclosure

We aim to fix, deploy and then publish. If you intend to write the finding up, tell us and we will
agree a date — we will not ask you to sit on something indefinitely, and we will credit you.

If a fix requires action from teams running their own deployments (a database migration, a config
change), we will say so plainly in the release notes so nobody is left running the vulnerable
version without knowing.

---

## Supported versions

The `main` branch of this repository is the only supported version. Every country deployment
tracks it; there are no long-lived release branches to backport to.

If you run a deployment from an older commit, update before reporting — the issue may already be
fixed.

---

## Our own security posture

So you know what to expect, and where to look:

- **RLS on every table**, with public read granted explicitly and only where the data is meant to
  be public. `db/03_verificacion.sql` exists to verify this; run it after any schema change.
- **One Supabase project per country.** Not a shared database with a tenant column.
- **The service role key is never used in a route that renders to the browser.** Today it is not
  used at all.
- **Every staff write is recorded by a database trigger**, not by application code that someone
  can forget to call. Deletion stays admin-only.
- **The public never writes the map.** Suggestions land in a queue that anyone can fill and nobody
  outside the team can read; a person publishes.
- **No analytics that could record who searched for what.** The privacy policy commits to this and
  `config/integrations.ts` carries the warning next to the switch.
- **Passwords are checked against Have I Been Pwned** using the k-anonymity range API — the
  password never leaves the server, only a five-character hash prefix.
