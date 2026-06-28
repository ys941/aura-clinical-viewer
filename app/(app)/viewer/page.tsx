"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const Viewer = dynamic(() => import("@/components/viewer/Viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading viewer…
    </div>
  ),
});

export default function ViewerPage() {
  return <Viewer />;
}
