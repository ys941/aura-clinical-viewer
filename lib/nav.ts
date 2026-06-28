import { ScanLine, Settings, type LucideIcon } from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navLinks: NavLink[] = [
  { label: "Viewer", href: "/viewer", icon: ScanLine },
  { label: "Settings", href: "/settings", icon: Settings },
];
