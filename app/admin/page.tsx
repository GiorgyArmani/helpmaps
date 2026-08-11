import { redirect } from "next/navigation";

/**
 * The staff panel is no longer a page.
 *
 * It is a view over the live map (`AppShell`), because placing a point means watching
 * the pin move while you type — which a separate route cannot do: it unmounts the map.
 * Leaving it a route also meant "back to map" was a navigation that tore the client tree
 * down and re-resolved the session, which read to staff as being signed out.
 *
 * Kept as a redirect rather than deleted: this URL is in people's bookmarks and in the
 * welcome email sent to every approved volunteer.
 */
export default function AdminPage() {
  redirect("/?panel=1");
}
