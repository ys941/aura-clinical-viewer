"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Static builds can't redirect on the server, so bounce on the client. */
export function RedirectToViewer() {
  const router = useRouter();
  useEffect(() => { router.replace("/viewer"); }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening the viewer…
    </div>
  );
}
