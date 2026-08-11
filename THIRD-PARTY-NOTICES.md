# Third-Party Notices

HelpMaps is distributed under the MIT License (see [`LICENSE`](./LICENSE)).
Copyright (c) 2026 Jorge Luis Márquez Monsalve and Fernando Virgilio Marquina Benítez.

This file inventories every third-party component the project depends on or displays, with its
license and the evidence for our right to use and redistribute it. It exists so that anyone — an
auditor, a funder, a reviewer, or a team redeploying HelpMaps in another country — can confirm
that in one place instead of reading `package-lock.json`.

Two of the entries below are **obligations, not courtesies**: OpenStreetMap and CARTO require
visible attribution on the map, and USGS requires a credit line on the seismic layers. Removing
either is a licence violation, not a design decision. They are configured in `config/map.ts` and
`config/hazard.ts` with that warning next to them.

Last verified: 11 August 2026, against the dependency tree in `package-lock.json`.

---

## 1. Third-party code and text inside this repository

| File | Source | License | Notes |
| --- | --- | --- | --- |
| `CODE_OF_CONDUCT.md`, `CODE_OF_CONDUCT.es.md` | [Contributor Covenant](https://www.contributor-covenant.org) v2.1 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Adapted. Attribution is carried inside the documents themselves, as the licence requires. The disaster-context section is an original addition by this project. |

Everything else under `app/`, `src/`, `config/` and `db/` is original work by this project's
authors and is covered by `LICENSE`.

The icon set in `src/ui/icons.tsx` is hand-drawn SVG geometry written for this project; it is not
a redistribution of Heroicons, Lucide or any other library.

---

## 2. Map data and tiles

These are the obligations. Both are already rendered by the map's attribution control.

| Component | Provider | License | How we comply |
| --- | --- | --- | --- |
| Base map data | [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) | Attribution string in `config/map.ts`, rendered on every map |
| Base map tiles (Positron) | [CARTO](https://carto.com/attribution/) | Free for use with attribution | Same attribution string |
| Earthquake catalogue and ShakeMap contours | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) | Public domain (US Government work), credit required | `hazard.seismic.attribution`, rendered with the layer |
| Geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap) | ODbL, subject to the [usage policy](https://operations.osmfoundation.org/policies/nominatim/) | Staff-only address lookup; one request at a time, not bulk |
| Geocoding fallback | [Photon](https://photon.komoot.io/) (Komoot) | ODbL data, [free API](https://photon.komoot.io/) | Consulted only when Nominatim returns nothing |

**Data published by HelpMaps deployments** — the points in the public API — is offered under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). That is the project's own choice about
its own data, stated in `/docs/terminos`, and it does not extend to the OpenStreetMap base map
underneath it, which stays ODbL.

---

## 3. npm dependencies

### Direct dependencies

| Package | Version | License |
| --- | --- | --- |
| `next` | 16.2.9 | MIT |
| `react` | 19.2.4 | MIT |
| `react-dom` | 19.2.4 | MIT |
| `@supabase/supabase-js` | 2.112.2 | MIT |
| `@supabase/ssr` | 0.12.4 | MIT |
| `leaflet` | 1.9.4 | **BSD-2-Clause** |
| `nodemailer` | 9.0.5 | MIT-0 |
| `server-only` | 0.0.1 | MIT |

`leaflet` is the one entry here that is not MIT. BSD-2-Clause is permissive and imposes the same
practical obligation as MIT — keep the copyright notice with the code — which npm redistribution
satisfies. It is bundled from npm, not loaded from a CDN, and its stylesheet
(`leaflet/dist/leaflet.css`) is imported directly by `MapCanvas.tsx` and `HubMap.tsx`.

Leaflet's notice, reproduced as its licence requires:

> Copyright (c) 2010-2024, Volodymyr Agafonkin
> Copyright (c) 2010-2011, CloudMade
> All rights reserved.

### Direct development dependencies

| Package | Version | License |
| --- | --- | --- |
| `typescript` | 5.9.3 | **Apache-2.0** |
| `eslint` | 9.39.5 | MIT |
| `eslint-config-next` | 16.2.9 | MIT |
| `@types/leaflet` | 1.9.22 | MIT (DefinitelyTyped) |
| `@types/node` | 20.19.43 | MIT (DefinitelyTyped) |
| `@types/nodemailer` | 8.0.1 | MIT (DefinitelyTyped) |
| `@types/react` | 19.2.18 | MIT (DefinitelyTyped) |
| `@types/react-dom` | 19.2.4 | MIT (DefinitelyTyped) |

Development dependencies do not ship to users; they are listed because an auditor should not have
to guess.

### Full dependency tree

354 packages resolved, by declared licence:

| License | Packages |
| --- | --- |
| MIT | 301 |
| Apache-2.0 | 21 |
| ISC | 14 |
| BSD-2-Clause | 8 |
| BSD-3-Clause | 2 |
| Apache-2.0 AND LGPL-3.0-or-later | 1 |
| BlueOak-1.0.0 | 1 |
| MPL-2.0 | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| MIT-0 | 1 |
| 0BSD | 1 |

Every one of these is a permissive or weak-copyleft licence compatible with distributing this
project under MIT. The single MPL-2.0 package is file-level copyleft: it is used unmodified, so
its obligation is satisfied by leaving it unmodified in `node_modules`. There is no GPL and no
AGPL in the tree.

### Reproducing this inventory

No extra tooling required — this is the script the table above came from:

```bash
node -e "
const fs=require('fs'),path=require('path'),seen=new Map();
(function scan(dir){
  let e; try{e=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
  for(const d of e){ if(!d.isDirectory())continue;
    const p=path.join(dir,d.name);
    if(d.name.startsWith('@')){scan(p);continue}
    try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));
      let l=j.license; if(l&&typeof l==='object')l=l.type;
      if(j.name&&j.version)seen.set(j.name+'@'+j.version,l||'UNKNOWN')}catch{}
    const n=path.join(p,'node_modules'); if(fs.existsSync(n))scan(n) }
})('node_modules');
const c={}; for(const l of seen.values())c[l]=(c[l]||0)+1;
console.log('total:',seen.size);
for(const [l,n] of Object.entries(c).sort((a,b)=>b[1]-a[1]))console.log(String(n).padStart(4),l);
"
```

Re-run it after changing dependencies and update the table. A stale inventory is worse than none,
because it is trusted.

---

## 4. External services called at runtime

Not dependencies and not redistributed, but a reviewer should know what leaves the browser or the
server, and no credentials are involved in any of them.

| Service | Called from | Purpose |
| --- | --- | --- |
| CARTO basemap tiles | browser | Map tiles |
| USGS FDSN event service | browser | Earthquake catalogue and ShakeMap contours |
| Nominatim / Photon | browser (staff panel only) | Address lookup when adding a point |
| Supabase | browser and server | The database. One project per country |
| `api.pwnedpasswords.com` | server only | Password breach check by k-anonymity range. **The password never leaves the server** — only a five-character SHA-1 prefix is sent |
| `google.com/maps/dir` | browser | Target of the "how to get there" link. A destination, not an API call: nothing is sent until the user taps it |

No analytics provider is enabled. `config/integrations.ts` carries the reason next to the switch:
this application must not be able to record who searched for whom.

No fonts are fetched from a CDN — `config/brand.ts` ships system font stacks on purpose, so the
first paint does not wait on a network the user may not have.

---

## 5. If you redeploy HelpMaps

Forking is expected; the project exists to be redeployed. Two things travel with it:

1. **`LICENSE` and this file must stay in your copy.** MIT requires the copyright notice and the
   permission notice to be included in all copies or substantial portions of the software.
2. **The map and seismic attributions must remain visible.** They are not branding and they are
   not ours to remove; they are licence conditions belonging to OpenStreetMap, CARTO and USGS.

Everything else — name, logo, colours, copy — is yours to change. That is what `config/` is for.
