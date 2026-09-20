import { redirect } from "next/navigation";

import { IS_DEMO } from "@/lib/auth-mode";
import { RedirectToViewer } from "@/components/RedirectToViewer";

export default function Home() {
  // The static demo has no server, so it redirects in the browser instead.
  if (IS_DEMO) return <RedirectToViewer />;
  redirect("/viewer");
}
