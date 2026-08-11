"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginForm from "@/features/admin/LoginForm";
import { useI18n } from "@/i18n/context";
import { BRAND } from "@/config";

/**
 * Team sign-in as a standalone page.
 *
 * The everyday way in is the padlock in the header, which opens the panel — and this
 * form when there is no session — straight over the map, without leaving it. This page
 * stays for the links that already exist (bookmarks, the volunteer welcome email) and
 * hands over to the map view as soon as the sign-in succeeds.
 *
 * The form itself is the shared component, so there is one sign-in to keep correct.
 */
export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <main className="loginwrap">
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>{t("login.title")}</h1>
      </div>

      <LoginForm onSignedIn={() => router.replace("/?panel=1")} />

      <Link className="linkbtn" href="/">
        ← {BRAND.name}
      </Link>
    </main>
  );
}
