"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { faunaOf, starterAvatar, type Avatar } from "@/domain/avatar";
import { levelFor } from "@/domain/badges";
import { fetchMyContributions } from "@/data/recognition";
import { getSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/context";
import { useSite } from "@/features/app/SiteProvider";
import { useSessionPeek } from "@/features/account/useSessionPeek";
import type { AccountState } from "@/features/account/useAccount";
import { Button, Notice } from "@/ui/primitives";
import AvatarEditor from "@/features/avatar/AvatarEditor";
import { myAvatar } from "@/features/avatar/mine";
import type { Mood } from "@/features/avatar/art";

/**
 * Cambiar el avatar, dentro de Configuración. «Mi cuenta» lo ENSEÑA con su nivel; aquí se
 * edita, con el mismo creador del registro.
 *
 * Guarda por `/api/account/avatar`, que vuelve a comprobar el nivel: el que se calcula aquí
 * sólo decide qué candados se DIBUJAN abiertos. Al guardar se refresca la sesión, que es de
 * donde la barra lee el avatar, así que la cabecera cambia sin recargar.
 *
 * Mientras llega el nivel se reserva el hueco del creador: los candados no pueden aparecer
 * abiertos y cerrarse un segundo después.
 */
export default function AvatarSettings({ account }: { account: AccountState }) {
  const { t } = useI18n();
  const site = useSite();
  const peek = useSessionPeek();
  const fauna = useMemo(() => faunaOf(site.country), [site.country]);
  const saved = useMemo(
    () => myAvatar(fauna, account.profile?.avatar, peek.avatar),
    [fauna, account.profile?.avatar, peek.avatar],
  );

  // El borrador arranca del guardado (o del primer animal, si todavía no tiene).
  const [draft, setDraft] = useState<Avatar | null>(null);
  const value = draft ?? saved ?? (fauna[0] ? starterAvatar(fauna[0]) : null);
  const [level, setLevel] = useState<number | null>(() => (getSupabase() ? null : 1));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ok, setOk] = useState(false);
  const [mood, setMood] = useState<Mood>("neutral");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchMyContributions(sb).then((rows) => {
      if (vivo) setLevel(levelFor(rows.reduce((n, r) => n + r.points, 0)).level);
    });
    return () => {
      vivo = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!value) return null;

  async function save() {
    if (!value || busy) return;
    setBusy(true);
    setFailed(false);
    setOk(false);
    try {
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatar: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { avatar?: Avatar };
      if (!res.ok || !data.avatar) throw new Error("save");
      setDraft(data.avatar);
      setOk(true);
      // La celebración: saluda un momento.
      setMood("feliz");
      timer.current = setTimeout(() => setMood("neutral"), 1600);
      // La barra lee el avatar del token: refrescarlo es lo que la hace cambiar ya.
      await getSupabase()?.auth.refreshSession();
      account.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aveset">
      <p className="aveset-lead">{t("settings.avatarLead")}</p>
      {level === null ? (
        <span className="skel ave-skel" aria-hidden="true" />
      ) : (
        <AvatarEditor
          value={value}
          onChange={(a) => {
            setOk(false);
            setDraft(a);
          }}
          species={fauna}
          level={level}
          mood={mood}
        />
      )}
      {failed ? <Notice tone="danger">{t("admin.saveError")}</Notice> : null}
      <div className="aveset-bar">
        <Button type="button" loading={busy} disabled={level === null} onClick={save}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
        {ok ? (
          <p className="aveset-ok" role="status">
            {t("avatar.saved")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
