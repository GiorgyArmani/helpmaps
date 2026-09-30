import { COUNTRY, typeStyle } from "@/config";
import type { translator } from "@/i18n";
import { Icon, TypeGlyph } from "@/ui/icons";

type T = ReturnType<typeof translator>;

/**
 * Las pantallas del perfil de una organización, dibujadas dentro de un teléfono.
 *
 * ── POR QUÉ MARCADO Y NO CAPTURAS ───────────────────────────────────────────
 *
 * Una captura en PNG pesa cientos de KB en una página que se abre desde WhatsApp con mala
 * cobertura, se queda vieja el día que cambia la ficha, sale en un solo idioma y con la
 * marca de UN país. Estas pantallas son HTML con los mismos tokens que la app: se re-marcan
 * solas por país, se traducen con el diccionario y pesan lo que pesa el texto.
 *
 * Copian el perfil real a 390px (`/c/<id>`: portada, foto, pestañas, `.icamp`, `.iact`,
 * `.ipost`) pero con clases propias. Las reales cambian a partir de 560 y 900px, y dentro de
 * un teléfono dibujado en un escritorio saldrían con la versión de escritorio.
 *
 * ── NO SON INTERACTIVAS ─────────────────────────────────────────────────────
 *
 * `aria-hidden` e `inert` (en `FeatureTour`): un «Me anoto» que no anota a nadie es una
 * trampa. Lo que cada pantalla enseña lo dice el texto que la acompaña.
 */

const TYPE = "comedor" as const;

/** Una pantalla del teléfono. El marco lo pone `FeatureTour`: uno solo para las cuatro. */
function Phone({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Portada, foto y nombre. `compact` en las pantallas que enseñan una pestaña concreta: el
 * perfil ya desplazado, con el nombre en una fila, para que lo que se enseña —la barra de
 * la campaña, el «Me apunto»— quepa sobre el corte del panel.
 */
function Head({ t, compact = false }: { t: T; compact?: boolean }) {
  const style = typeStyle(TYPE);
  if (compact) {
    return (
      <div className="mk-top">
        <span className="mk-back">
          <Icon.back />
        </span>
        <span className="mk-photo mk-photo-sm" style={{ color: style.color }}>
          <TypeGlyph name={style.icon} size={18} />
        </span>
        <span className="mk-top-txt">
          <b className="mk-name">{t("orgs.demo.name")}</b>
          <span className="mk-meta">
            {t(`type.${TYPE}`)} · {COUNTRY.name}
          </span>
        </span>
      </div>
    );
  }
  return (
    <>
      <div className="mk-cover" style={{ ["--tc" as string]: style.color }}>
        <span className="mk-back mk-back-abs">
          <Icon.back />
        </span>
      </div>
      <div className="mk-id">
        <span className="mk-photo" style={{ color: style.color }}>
          <TypeGlyph name={style.icon} size={28} />
        </span>
        <b className="mk-name">{t("orgs.demo.name")}</b>
        <span className="mk-meta">
          {t(`type.${TYPE}`)} · {COUNTRY.name}
        </span>
      </div>
    </>
  );
}

function Tabs({ t, on }: { t: T; on: "info" | "campaigns" | "agenda" | "posts" }) {
  const tabs = [
    { id: "info", label: t("tab.info"), n: null },
    { id: "campaigns", label: t("tab.campaigns"), n: 1 },
    { id: "agenda", label: t("tab.agenda"), n: 2 },
    { id: "posts", label: t("tab.posts"), n: 6 },
  ] as const;
  return (
    <div className="mk-tabs">
      {tabs.map((tab) => (
        <span key={tab.id} className={`mk-tab${tab.id === on ? " mk-tab-on" : ""}`}>
          {tab.label}
          {tab.n === null ? null : <span className="mk-tab-n">{tab.n}</span>}
        </span>
      ))}
    </div>
  );
}

export function ProfileScreen({ t }: { t: T }) {
  return (
    <Phone>
      <Head t={t} />
      <div className="mk-body">
        <span className="mk-open">
          <i />
          {t("hours.openNow")} · {t("hours.closesAt", { time: "2:00 p. m." })}
        </span>
        <div className="mk-acts">
          <span className="mk-act mk-act-main">
            <Icon.directions />
            {t("orgs.demo.directions")}
          </span>
          <span className="mk-act">
            <Icon.whatsapp />
            WhatsApp
          </span>
          <span className="mk-act">
            <Icon.share />
            {t("orgs.demo.share")}
          </span>
        </div>
        <Tabs t={t} on="info" />
        <p className="mk-about">{t("orgs.demo.about")}</p>
        <div className="mk-table">
          <span>
            <small>{t("hours.title")}</small>
            <b>{t("orgs.demo.hours")}</b>
          </span>
          <span>
            <small>{t("orgs.demo.addressLabel")}</small>
            <b>{t("orgs.demo.address")}</b>
          </span>
        </div>
      </div>
    </Phone>
  );
}

export function CampaignScreen({ t }: { t: T }) {
  return (
    <Phone>
      <Head t={t} compact />
      <div className="mk-body">
        <Tabs t={t} on="campaigns" />
        <div className="mk-card">
          <div className="mk-img mk-img-a">
            <Icon.box />
          </div>
          <b className="mk-card-t">{t("orgs.demo.campaign")}</b>
          <p className="mk-card-p">{t("orgs.demo.campaignWhy")}</p>
          <div className="mk-bar">
            <span style={{ width: "65%" }} />
          </div>
          <p className="mk-card-n">
            <b>78</b> {t("campaign.of", { goal: "120", unit: t("orgs.demo.unit") })}
          </p>
        </div>
        <span className="mk-donate">
          <span className="mk-donate-ic">
            <Icon.heart />
          </span>
          <span>
            <b>{t("donate.go")}</b>
            <small>{t("orgs.demo.donateHint")}</small>
          </span>
        </span>
      </div>
    </Phone>
  );
}

export function AgendaScreen({ t }: { t: T }) {
  return (
    <Phone>
      <Head t={t} compact />
      <div className="mk-body">
        <Tabs t={t} on="agenda" />
        <div className="mk-ev">
          <span className="mk-ev-when">
            <b>12</b>
            <span>{t("orgs.demo.month")}</span>
          </span>
          <span className="mk-ev-body">
            <b className="mk-ev-t">{t("orgs.demo.event")}</b>
            <span className="mk-ev-meta">{t("orgs.demo.eventMeta")}</span>
            <span className="mk-chips">
              <span>{t("orgs.demo.skill1")}</span>
              <span>{t("orgs.demo.skill2")}</span>
              <span>{t("orgs.demo.skill3")}</span>
            </span>
            <span className="mk-ev-row">
              <span className="mk-join">
                <Icon.plus />
                {t("event.join")}
              </span>
              <span className="mk-cal">
                <Icon.clock />
                {t("event.addToCalendar")}
              </span>
            </span>
            <span className="mk-ev-count">
              <Icon.users />
              {t("event.goingN", { n: 14 })}
            </span>
          </span>
        </div>
        <div className="mk-ev mk-ev-dim">
          <span className="mk-ev-when">
            <b>19</b>
            <span>{t("orgs.demo.month")}</span>
          </span>
          <span className="mk-ev-body">
            <b className="mk-ev-t">{t("orgs.demo.event2")}</b>
            <span className="mk-ev-meta">{t("orgs.demo.event2Meta")}</span>
          </span>
        </div>
      </div>
    </Phone>
  );
}

export function PostsScreen({ t }: { t: T }) {
  return (
    <Phone>
      <Head t={t} compact />
      <div className="mk-body">
        <Tabs t={t} on="posts" />
        <div className="mk-post">
          <div className="mk-img mk-img-b">
            <Icon.meal />
          </div>
          <p className="mk-post-meta">
            <span className="mk-kind">{t("post.kind.entrega")}</span>
            {t("time.days", { n: 2 })}
          </p>
          <p className="mk-post-body">{t("orgs.demo.post")}</p>
        </div>
        <div className="mk-post">
          <p className="mk-post-meta">
            <span className="mk-kind mk-kind-b">{t("post.kind.avance")}</span>
            {t("time.days", { n: 5 })}
          </p>
          <p className="mk-post-body">{t("orgs.demo.post2")}</p>
        </div>
      </div>
    </Phone>
  );
}
