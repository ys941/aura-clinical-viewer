import { ScanLine, Settings, type LucideIcon } from "lucide-react";

import { IS_DEMO } from "@/lib/auth-mode";

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navLinks: NavLink[] = [
  { label: "Viewer", href: "/viewer", icon: ScanLine },
  // The demo has no server to save settings to.
  ...(IS_DEMO ? [] : [{ label: "Settings", href: "/settings", icon: Settings }]),
];
