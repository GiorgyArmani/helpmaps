"use client";

import { useEffect, useState } from "react";
import type { Center, CenterStatus, HelpKind, LocationType } from "@/domain/types";
import { CENTER_STATUSES, HELP_KINDS } from "@/domain/types";
import { makeCenterId, type CenterDraft } from "@/data/centers";
import { enabledTypes } from "@/config";
import { Button, Chip, Field, Input, Notice, Select, TextArea } from "@/ui/primitives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { geocode, matchRegion, type GeoResult } from "@/features/admin/geocode";
import type { DictKey } from "@/i18n";
import { useSite } from "@/features/app/SiteProvider";

/**
 * Add or edit a point.
 *
 * The coordinates are the part that matters: everything else being slightly wrong is an
 * inconvenience, a wrong pin sends someone across a city to a place that is not there.
 * Hence the address search (so the usual case is one click, not typed decimals) and the
 * standing warning to check the pin before saving.
 */
export default function CenterForm({
  center,
  onSave,
  onCancel,
  onDelete,
  canDelete,
  onPinDrag,
  onCoordsChange,
}: {
  center: Center | null;
  onSave: (draft: CenterDraft, statusChanged: boolean) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  /**
   * Slot the map calls when its pin is dragged. A ref rather than a prop callback so the
   * map can reach the CURRENT form without the whole panel re-rendering to hand it over.
   */
  onPinDrag: React.MutableRefObject<((at: { lat: number; lng: number }) => void) | null>;
  /** Publishes these coordinates to the map, or null when they are not usable yet. */
  onCoordsChange: (at: { lat: number; lng: number } | null) => void;
}) {
  const site = useSite();
  const { t } = useI18n();
  const info = center?.info ?? null;

  const [form, setForm] = useState({
    name: center?.name ?? "",
    type: (center?.type ?? enabledTypes()[0] ?? "shelter") as LocationType,
    region: center?.region ?? "",
    municipality: center?.municipality ?? "",
    address: center?.address ?? "",
    lat: center ? String(center.lat) : "",
    lng: center ? String(center.lng) : "",
    phone: center?.phone ?? "",
    whatsapp: center?.whatsapp ?? "",
    active: center?.active ?? true,
    status: (info?.status ?? "") as CenterStatus | "",
    needs: info?.needs ?? "",
    receives: (info?.receives ?? []).join(", "),
    help: info?.help ?? ([] as HelpKind[]),
    category: info?.category ?? "",
    description: info?.description ?? "",
    schedule: info?.schedule ?? "",
    contactName: info?.contact_name ?? "",
    socialUrl: info?.social_url ?? "",
    isAnimal: info?.is_animal ?? false,
  });

  const [geoQuery, setGeoQuery] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── the form and the map pin, kept in step ────────────────────────────────
  //
  // Only ONE of the two directions is an effect, deliberately. Two effects writing to
  // each other is a render loop waiting to happen, however carefully the values are
  // compared.
  //
  //   form → map  is an effect: the map is an external system being told the latest
  //               state, which is what effects are for.
  //   map → form  is not: a drag is an EVENT, so it calls straight into `setForm` from
  //               Leaflet's `dragend` through the handler registered below.
  const lat = Number.parseFloat(form.lat);
  const lng = Number.parseFloat(form.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  // Keyed on the PARSED numbers, so typing "4.8" then "4.80" moves nothing.
  useEffect(() => {
    onCoordsChange(hasCoords ? { lat, lng } : null);
  }, [hasCoords, lat, lng, onCoordsChange]);

  // Hand the map a way to write coordinates back while this form is mounted. Assigning
  // to a ref, not state — nothing needs to re-render because of it.
  useEffect(() => {
    onPinDrag.current = (at) =>
      setForm((f) => ({ ...f, lat: at.lat.toFixed(6), lng: at.lng.toFixed(6) }));
    return () => {
      onPinDrag.current = null;
      // Closing the form takes the pin off the map with it.
      onCoordsChange(null);
    };
  }, [onPinDrag, onCoordsChange]);

  async function search() {
    // What was typed in the search box, else the record's own name/address — the same
    // fallback the original has, so the button still works before anything is pasted.
    const query = geoQuery.trim() || [form.name, form.address].filter(Boolean).join(" ");
    if (!query) return;
    setSearching(true);
    setGeoError(null);
    setResults([]);
    try {
      const hits = await geocode(query, {
        municipality: form.municipality.trim() || undefined,
        regionName: site.country.regions.find((r) => r.code === form.region)?.name,
      });
      // A single unambiguous answer — which is always the case for a pasted link — is
      // applied straight away rather than shown as a one-item list to click through.
      if (hits.length === 1 && hits[0]) pick(hits[0]);
      else if (hits.length === 0) setGeoError(t("form.noGeoResults"));
      else setResults(hits);
    } catch {
      setGeoError(t("form.noGeoResults"));
    } finally {
      setSearching(false);
    }
  }

  function pick(r: GeoResult) {
    setForm((f) => ({
      ...f,
      lat: r.lat.toFixed(6),
      lng: r.lng.toFixed(6),
      municipality: f.municipality || r.municipality || "",
      region: f.region || matchRegion(r.state) || "",
    }));
    setResults([]);
    setGeoError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lat = Number.parseFloat(form.lat);
    const lng = Number.parseFloat(form.lng);
    if (!form.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError(t("admin.saveError"));
      return;
    }
    setSaving(true);
    setError(null);
    const draft: CenterDraft = {
      id: center?.id ?? makeCenterId(form.name, form.type),
      name: form.name.trim(),
      type: form.type,
      region: form.region || null,
      municipality: form.municipality.trim() || null,
      lat,
      lng,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      active: form.active,
      info: {
        status: form.status || null,
        receives: form.receives
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        needs: form.needs.trim() || null,
        help: form.help,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        schedule: form.schedule.trim() || null,
        contact_name: form.contactName.trim() || null,
        social_url: form.socialUrl.trim() || null,
        is_animal: form.isAnimal,
      },
    };
    try {
      await onSave(draft, form.status !== (info?.status ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label={t("form.name")}>
        <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>

      <div className="frow">
        <Field label={t("form.type")}>
          <Select value={form.type} onChange={(e) => set("type", e.target.value as LocationType)}>
            {enabledTypes().map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}` as DictKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={site.country.regionNoun.one}>
          <Select value={form.region} onChange={(e) => set("region", e.target.value)}>
            <option value="">—</option>
            {site.country.regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="frow">
        <Field label={t("form.municipality")}>
          <Input value={form.municipality} onChange={(e) => set("municipality", e.target.value)} />
        </Field>
        <Field label={t("form.address")}>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </div>

      <fieldset className="fieldset">
        <legend className="legend">{t("form.coords")}</legend>
        <div className="frow">
          <Field label={t("form.lat")}>
            <Input
              required
              inputMode="decimal"
              value={form.lat}
              onChange={(e) => set("lat", e.target.value)}
            />
          </Field>
          <Field label={t("form.lng")}>
            <Input
              required
              inputMode="decimal"
              value={form.lng}
              onChange={(e) => set("lng", e.target.value)}
            />
          </Field>
        </div>
        {/* A box you can paste into, not just a button over the other fields. The
            fastest reliable way to place a point is to find it in the Maps app you
            already use, share, and paste the link — so that has to be somewhere to
            paste. Left empty it still searches the name/address above, as before. */}
        <Field label={t("form.findAddress")} hint={t("form.findAddressHint")}>
          <div className="geo-row">
            <Input
              value={geoQuery}
              placeholder={t("form.findAddressPlaceholder")}
              onChange={(e) => setGeoQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter searches instead of submitting the whole form — half-filled
                // records were getting saved by muscle memory from the fields above.
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!searching) void search();
              }}
            />
            <Button variant="ghost" small onClick={() => void search()} loading={searching}>
              <Icon.search width={15} height={15} />
              {searching ? t("form.searching") : t("common.search")}
            </Button>
          </div>
        </Field>
        {geoError ? <p className="geo-empty">{geoError}</p> : null}
        {results.length ? (
          <div className="geo-results">
            {results.map((r) => (
              <button
                key={`${r.lat},${r.lng}`}
                type="button"
                className="geo-res"
                onClick={() => pick(r)}
              >
                <Icon.directions />
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
        <Notice tone="warn">{t("form.pinWarning")}</Notice>
      </fieldset>

      <div className="frow">
        <Field label={t("form.phone")}>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={t("form.whatsapp")}>
          <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </Field>
      </div>

      <fieldset className="fieldset">
        <legend className="legend">{t("form.needsSection")}</legend>

        <div>
          <span className="small" style={{ fontWeight: 600 }}>
            {t("form.status")}
          </span>
          <div className="seg" style={{ marginTop: 6 }}>
            <button
              type="button"
              className={`segb${form.status === "" ? " segb-on" : ""}`}
              aria-pressed={form.status === ""}
              onClick={() => set("status", "")}
            >
              {t("common.unknown")}
            </button>
            {CENTER_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                className={`segb${form.status === st ? " segb-on" : ""}`}
                aria-pressed={form.status === st}
                onClick={() => set("status", st)}
              >
                {t(`status.${st}` as DictKey)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t("form.needs")}>
          <TextArea value={form.needs} onChange={(e) => set("needs", e.target.value)} />
        </Field>

        <Field label={t("form.receives")} hint={t("form.receivesHint")}>
          <Input value={form.receives} onChange={(e) => set("receives", e.target.value)} />
        </Field>

        <div>
          <span className="small" style={{ fontWeight: 600 }}>
            {t("form.help")}
          </span>
          <div className="seg" style={{ marginTop: 6 }}>
            {HELP_KINDS.map((h) => (
              <Chip
                key={h}
                on={form.help.includes(h)}
                onClick={() =>
                  set("help", form.help.includes(h) ? form.help.filter((x) => x !== h) : [...form.help, h])
                }
              >
                {t(`help.${h}` as DictKey)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="frow">
          <Field label={t("form.category")}>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
          </Field>
          <Field label={t("form.schedule")}>
            <Input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} />
          </Field>
        </div>

        <Field label={t("form.description")}>
          <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="frow">
          <Field label={t("form.contactName")}>
            <Input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
          </Field>
          <Field label={t("form.socialUrl")}>
            <Input value={form.socialUrl} onChange={(e) => set("socialUrl", e.target.value)} />
          </Field>
        </div>

        <label className="fcheck">
          <input
            type="checkbox"
            checked={form.isAnimal}
            onChange={(e) => set("isAnimal", e.target.checked)}
          />
          <span className="fcheck-l">{t("form.isAnimal")}</span>
      </label>
      </fieldset>

      <label className="fcheck">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
        />
          <span className="fcheck-l">{t("form.active")}</span>
      </label>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="wrapline">
        <Button type="submit" loading={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {center && canDelete && onDelete ? (
          <Button variant="danger" onClick={onDelete}>
            {t("common.delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
