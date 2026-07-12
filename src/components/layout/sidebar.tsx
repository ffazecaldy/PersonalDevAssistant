"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  LayoutGrid,
  Calendar,
  Settings,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "⌘1" },
  { href: "/projects", label: "Progetti", icon: FolderKanban, shortcut: "⌘2" },
  { href: "/tasks", label: "Task", icon: CheckSquare, shortcut: "⌘3" },
  { href: "/eisenhower", label: "Eisenhower", icon: LayoutGrid, shortcut: "⌘5" },
  { href: "/calendar", label: "Calendario", icon: Calendar, shortcut: "⌘4" },
  { href: "/ai", label: "AI Assistant", icon: Sparkles, shortcut: "⌘6" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border bg-sidebar flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold font-mono">CC</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">Command Center</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground font-normal"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground/60">
                    {item.shortcut}
                  </kbd>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Impostazioni
        </Link>
      </div>
    </aside>
  );
}
