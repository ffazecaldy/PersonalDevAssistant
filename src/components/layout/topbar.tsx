"use client";

import { Button } from "@/components/ui/button";
import { Search, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";
import { CommandPalette } from "@/components/layout/command-palette";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <header className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-64 justify-between text-muted-foreground font-normal text-sm"
          onClick={() => setCommandOpen(true)}
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Cerca o esegui...</span>
          </div>
          <kbd className="hidden md:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <span>⌘</span>K
          </kbd>
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </Button>
      </header>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
