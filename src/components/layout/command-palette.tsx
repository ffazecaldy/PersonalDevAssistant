"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Calendar,
  Sparkles,
  Plus,
} from "lucide-react";

const quickActions = [
  { label: "Nuovo Progetto", icon: Plus, action: "new-project" },
  { label: "Nuovo Task", icon: Plus, action: "new-task" },
  { label: "Nuovo Evento", icon: Plus, action: "new-event" },
];

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Progetti", icon: FolderKanban },
  { href: "/tasks", label: "Task", icon: CheckSquare },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/ai", label: "AI Assistant", icon: Sparkles },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Cerca o esegui un comando..." />
      <CommandList>
        <CommandEmpty>Nessun risultato.</CommandEmpty>
        <CommandGroup heading="Azioni rapide">
          {quickActions.map((action) => (
            <CommandItem
              key={action.action}
              onSelect={() => {
                onOpenChange(false);
                // TODO: apri dialog creazione progetto/task/evento
              }}
            >
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Navigazione">
          {navItems.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => {
                onOpenChange(false);
                router.push(item.href);
              }}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
