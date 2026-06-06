import { redirect } from "next/navigation";

/**
 * `/me` (the old standalone "My Passes" view) is consolidated into the profile
 * hub, which now lists passes — with chain-accurate status — alongside name,
 * cashouts, and tournaments. Redirect so old links keep working.
 */
export default function MePage() {
  redirect("/profile");
}
