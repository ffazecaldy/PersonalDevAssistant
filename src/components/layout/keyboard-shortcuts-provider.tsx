"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const shortcutGroups = [
  {
    label: "Navigazione",
    items: [
      { keys: "⌘1", label: "Dashboard" },
      { keys: "⌘2", label: "Progetti" },
      { keys: "⌘3", label: "Task" },
      { keys: "⌘4", label: "Calendario" },
      { keys: "⌘5", label: "Eisenhower" },
      { keys: "⌘6", label: "AI Assistant" },
    ],
  },
  {
    label: "Azioni",
    items: [
      { keys: "⌘K", label: "Apri comandi" },
      { keys: "⌘N", label: "Nuovo task" },
      { keys: "⌘⇧N", label: "Nuovo progetto" },
    ],
  },
  {
    label: "Altro",
    items: [{ keys: "?", label: "Mostra scorciatoie" }],
  },
];

export function KeyboardShortcutsProvider() {
  const { shortcutsDialogOpen, setShortcutsDialogOpen } =
    useKeyboardShortcuts();

  return (
    <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Scorciatoie da tastiera
          </DialogTitle>
          <DialogDescription>
            Premi{" "}
            <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              ?
            </kbd>{" "}
            in qualsiasi momento per aprire questo pannello.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {shortcutGroups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {group.label}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between py-0.5"
                  >
                    <span className="text-sm">{item.label}</span>
                    <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
