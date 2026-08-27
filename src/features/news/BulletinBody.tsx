import type { ReactNode } from "react";

/**
 * Rendering the bulletin text.
 *
 * ── WHY THIS IS NOT A MARKDOWN LIBRARY, AND NEVER innerHTML ─────────────────
 *
 * The summary is written by a language model over headlines fetched from a dozen outlets.
 * Both of those are outside our control, so this text is untrusted input that happens to
 * look like prose. Handing it to `dangerouslySetInnerHTML` — with or without a markdown
 * library in between — would make a prompt injection or a poisoned feed into script
 * running on a page where people are looking for a shelter.
 *
 * So it is parsed into React elements, and anything the parser does not recognise is
 * rendered as text. The worst case is an unstyled paragraph, never an executed one.
 *
 * The grammar is deliberately tiny, because it is the grammar this application generates:
 * `### heading`, `- [text](url)` links, and paragraphs.
 */

const LINK = /^-\s*\[([^\]]+)\]\(([^)\s]+)\)\s*(?:·\s*(.*))?$/;

/** Only http(s) links are rendered as links. `javascript:` and friends stay text. */
function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

export default function BulletinBody({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];

  const flush = () => {
    if (list.length === 0) return;
    out.push(
      <ul key={`l${out.length}`} className="bul-list">
        {list}
      </ul>,
    );
    list = [];
  };

  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }

    if (line.startsWith("###")) {
      flush();
      out.push(
        <h3 key={i} className="bul-h">
          {line.replace(/^#+\s*/, "")}
        </h3>,
      );
      continue;
    }

    const link = line.match(LINK);
    if (link) {
      const href = safeHref(link[2] ?? "");
      list.push(
        <li key={i}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {link[1]}
            </a>
          ) : (
            <span>{link[1]}</span>
          )}
          {link[3] ? <span className="bul-when"> · {link[3]}</span> : null}
        </li>,
      );
      continue;
    }

    flush();
    out.push(
      <p key={i} className="bul-p">
        {line.replace(/^[-*]\s*/, "")}
      </p>,
    );
  }
  flush();

  return <div className="bul-body">{out}</div>;
}
