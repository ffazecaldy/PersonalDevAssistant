"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ShortcutEntry = { label: string; keys: string };

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  const isEditing = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable
    );
  };

  // Maps combo strings → action
  const shortcutActions: Record<string, () => void> = {
    "cmd+n": () => router.push("/tasks"),
    "ctrl+n": () => router.push("/tasks"),
    "cmd+shift+n": () => router.push("/projects"),
    "ctrl+shift+n": () => router.push("/projects"),
    "cmd+1": () => router.push("/"),
    "ctrl+1": () => router.push("/"),
    "cmd+2": () => router.push("/projects"),
    "ctrl+2": () => router.push("/projects"),
    "cmd+3": () => router.push("/tasks"),
    "ctrl+3": () => router.push("/tasks"),
    "cmd+4": () => router.push("/calendar"),
    "ctrl+4": () => router.push("/calendar"),
    "cmd+5": () => router.push("/eisenhower"),
    "ctrl+5": () => router.push("/eisenhower"),
    "cmd+6": () => router.push("/ai"),
    "ctrl+6": () => router.push("/ai"),
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when user is typing in an input/textarea
      if (isEditing(e.target)) return;

      // "?" standalone — toggle shortcuts dialog
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setShortcutsDialogOpen((prev) => !prev);
        return;
      }

      // Escape — close shortcuts dialog
      if (e.key === "Escape" && shortcutsDialogOpen) {
        setShortcutsDialogOpen(false);
        return;
      }

      // Build combo string
      const parts: string[] = [];
      if (e.metaKey) parts.push("cmd");
      if (e.ctrlKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");
      parts.push(e.key.toLowerCase());

      const combo = parts.join("+");
      const action = shortcutActions[combo];
      if (action) {
        e.preventDefault();
        action();
      }
    },
    [shortcutsDialogOpen, router],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { shortcutsDialogOpen, setShortcutsDialogOpen };
}
