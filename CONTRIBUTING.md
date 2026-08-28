# Contributing to HelpMaps

HelpMaps is a non-profit civic platform that shows where help is available during a disaster, and
what each point needs right now. It is open source so that it can be audited by anyone and
redeployed by anyone, in any country.

Contributions are welcome — code, translations, documentation, bug reports. A few of the rules
below are stricter than usual, because a defect in this application does not corrupt a record: it
sends a person somewhere, during an emergency, on foot, possibly at night.

> **Resumen en español al final de este documento.**

---

## 0. Code of Conduct

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md)
([versión en español](./CODE_OF_CONDUCT.es.md)). Report unacceptable behaviour to
**info@helpmaps.net**.

---

## 1. Licensing of contributions

**This project is licensed under the [MIT License](./LICENSE). All contributions are accepted
under that same license — inbound equals outbound.**

By submitting a pull request, patch, commit or any other contribution to this repository, you
agree that your contribution is licensed to the project and to all downstream recipients under
the MIT License, and you confirm that you have the right to grant that license.

There is no separate Contributor License Agreement to sign. This mirrors
[GitHub Terms of Service §D.6, "Contributions Under Repository License"](https://docs.github.com/en/site-policy/github-terms-of-service#6-contributions-under-repository-license):

> Whenever you make a contribution to a repository containing notice of a license, you license
> your contribution under the same terms, and you agree that you have the right to license your
> contribution under those terms.

Copyright in the project as a whole is held by the authors named in [`LICENSE`](./LICENSE).
Contributors retain copyright in their own contributions and license them as described above.

### Developer Certificate of Origin

Every commit must be signed off, certifying the
[Developer Certificate of Origin 1.1](https://developercertificate.org/). Add the sign-off
automatically with:

```bash
git commit -s -m "your message"
```

which appends a line to your commit message:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use a real name and a reachable address. The sign-off is what lets a country redeploying HelpMaps
demonstrate the provenance of the code it is running.

---

## 2. Third-party code and dependencies

Provenance matters here: the project must be able to demonstrate its right to redistribute
everything it ships.

- **Do not paste code from Stack Overflow, blog posts, other repositories, or AI-generated
  suggestions whose provenance you cannot state.** If a contribution adapts existing work, say so
  in the pull request and name the source and its license.
- **New dependencies must be under a permissive OSI-approved license** — MIT, BSD, Apache-2.0,
  ISC, or equivalent. GPL/AGPL dependencies cannot be accepted, as they are incompatible with
  redistribution under MIT.
- **Any new dependency, font, icon set or external data source must be added to
  [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md)** in the same pull request, with its
  license and an evidence link. That file has a script in it that regenerates the totals.
- **External data sources with attribution requirements** (CC BY, ODbL) must have their credit
  rendered in the interface wherever that data is displayed — including shared pages and generated
  share images, which circulate on their own.
- **Prefer no dependency.** This application is used on bad connections and old phones. A
  megabyte of JavaScript is a person who cannot open the map.

---

## 3. Rules that are not negotiable

### The map must never be wrong on purpose

- **`status: null` means UNKNOWN and must render as unknown.** Nothing, in any layer, may default
  to `abierto`. Telling someone a closed point is open is the one failure this whole application
  exists to prevent, and it is why the field is nullable in the first place.
- **A pin is a place someone will travel to.** Do not add points with approximate coordinates
  behind a precise-looking marker. If the location is only known to city level, that is a fact
  about the data and the interface has to say so.
- **The public never writes the map.** Suggestions land in a queue that anyone may fill and nobody
  outside the team may read. A person publishes. Do not add a path that skips that.
- **`updated_at` must only move when the row actually changed.** A pipeline that rewrites every
  row on a schedule leaves "updated 1 minute ago" on points nobody has confirmed in weeks — and
  that timestamp is exactly what a family uses to decide whether to go.

### Privacy

This repository is public, and while the map publishes **places rather than people**, the database
behind it holds personal data:

- `submissions` — free text plus, optionally, the name and contact of whoever sent it.
- `volunteer_requests` — name, email, phone and a written motivation.

Neither may ever become publicly readable. Row Level Security is the only boundary in front of
them, because the browser talks to Supabase with the public anon key.

- **Do not add a field to a publicly readable table or view without deciding, explicitly, that it
  is public.** Widening what is visible is a product decision for the maintainers, not a cleanup.
- **Do not add analytics, logging or error reporting that could record who searched for what.**
  The privacy policy commits to this and `config/integrations.ts` carries the warning next to the
  switch.
- **Never commit real data.** Not as a fixture, not in a test, not in a screenshot attached to an
  issue. Invent the example.
- **Run `db/03_verificacion.sql` after any schema change** and paste the result in the pull
  request. It simulates the `anon` role and counts what it can actually reach.

### One codebase, many countries

- **Nothing under `src/` may know which country it is running in.** No country name, coordinate,
  hostname, colour or piece of copy outside `config/`. If you find yourself typing one, it belongs
  in `config/presets/<country>.ts`.
- **Do not edit `src/i18n/dictionaries/`** to localise a deployment. Use the `language.overrides`
  block in the country's preset, which replaces copy key by key and survives upstream merges.
- **Domain questions live in `src/domain/`, not in components.** "Is it stale?", "does it need
  help?", "does it match the search?" are answered once and tested there. The previous deployment
  ended up with a 5,000-line component because each of those was written three times.

---

## 4. Reporting security or privacy issues

**Do not open a public issue.** See [`SECURITY.md`](./SECURITY.md) and write to
**info@helpmaps.net** with `[SECURITY]` in the subject.

That document also explains what is in scope, what is not, and the testing rules — the most
important being: test against your own deployment, never against a live country map during an
emergency.

---

## 5. Practical guidelines

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # must pass
npm run lint         # must pass
npm run build        # must pass — config validation runs here
```

The build is where `src/config/validate.ts` runs. A preset with an unfilled `TODO`, duplicate
region codes, inverted bounds or a map centre outside those bounds fails the build on purpose.

- **Keep pull requests small and focused.** One concern per PR.
- **Match the surrounding code.** Comment density, naming and idiom included. Comments here
  explain *why*, especially where a choice looks odd and is protecting against something.
- **Describe the user-facing consequence** in the PR, not just the change. "Fixes a null check"
  says less than "a point with no confirmed status no longer renders as open".
- **Test on a narrow phone.** 375px wide is the reference, not a laptop window.
- **If you touch `db/`**, the files are numbered and idempotent. Add a new numbered file; do not
  edit one that deployments have already run.

---

## Resumen en español

- El proyecto está bajo [licencia MIT](./LICENSE). Al enviar una contribución aceptas que se
  publique bajo esa misma licencia y confirmas que tienes derecho a hacerlo. No hay que firmar
  ningún acuerdo aparte.
- **Firma cada commit** con `git commit -s` (Developer Certificate of Origin).
- **No pegues código de origen incierto.** Toda dependencia nueva va con licencia permisiva y se
  anota en [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) en el mismo pull request.
- **Nada bajo `src/` conoce el país.** Lo que cambia entre despliegues vive en `config/`.
  Para traducir un despliegue, usa `language.overrides` en su preset, nunca
  `src/i18n/dictionaries/`.
- **`status: null` significa DESCONOCIDO.** Ninguna capa puede asumir «abierto» por defecto.
- **El público nunca escribe el mapa.** Sus sugerencias entran en una cola que revisa una persona.
- **Nunca subas datos reales**, ni como ejemplo ni en una captura.
- Corre `db/03_verificacion.sql` después de tocar el esquema y pega el resultado en el PR.
- Los problemas de seguridad o privacidad **no van en un issue público**: escribe a
  info@helpmaps.net con `[SECURITY]` en el asunto. Ver [`SECURITY.md`](./SECURITY.md).
- Prueba en un teléfono estrecho (375px) antes de abrir el PR.

Gracias por contribuir.
