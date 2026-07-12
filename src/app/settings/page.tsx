"use client";

import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/hooks/use-settings";
import {
  Sun,
  Moon,
  Globe,
  CalendarDays,
  LayoutList,
  Server,
  Bot,
} from "lucide-react";
import { toast } from "sonner";

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-foreground"
    >
      {children}
    </label>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="space-y-0.5 min-w-0 flex-1">
        <Label>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleThemeChange = (value: string | null) => {
    if (!value) return;
    const newTheme = value as "dark" | "light";
    setTheme(newTheme);
    updateSettings({ theme: newTheme });
    toast.success(`Tema cambiato in ${newTheme === "dark" ? "scuro" : "chiaro"}`);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurazione dell&apos;applicazione
        </p>
      </div>

      {/* Aspetto */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {mounted && theme === "dark" ? (
              <Moon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Sun className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-base">Aspetto</CardTitle>
          </div>
          <CardDescription>Personalizza l&apos;aspetto dell&apos;interfaccia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            label="Tema"
            description="Passa tra tema chiaro e scuro"
          >
            <Select
              value={settings.theme}
              onValueChange={handleThemeChange}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">
                  <span className="flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5" />
                    Scuro
                  </span>
                </SelectItem>
                <SelectItem value="light">
                  <span className="flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5" />
                    Chiaro
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </CardContent>
      </Card>

      {/* Ollama AI */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Ollama AI</CardTitle>
          </div>
          <CardDescription>
            Configurazione del server Ollama per l&apos;assistente AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            label="Endpoint URL"
            description="Indirizzo del server Ollama (es. http://localhost:11434)"
          >
            <Input
              className="w-56 font-mono text-xs"
              value={settings.ollamaEndpoint}
              onChange={(e) =>
                updateSettings({ ollamaEndpoint: e.target.value })
              }
              onBlur={() => toast.success("Endpoint salvato")}
              placeholder="http://localhost:11434"
            />
          </SettingRow>

          <Separator className="my-2" />

          <SettingRow
            label="Modello"
            description="Modello AI predefinito per le risposte"
          >
            <Input
              className="w-44 font-mono text-xs"
              value={settings.ollamaModel}
              onChange={(e) =>
                updateSettings({ ollamaModel: e.target.value })
              }
              onBlur={() => toast.success("Modello salvato")}
              placeholder="gemma4:31b-cloud"
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Preferenze */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Preferenze</CardTitle>
          </div>
          <CardDescription>
            Impostazioni di visualizzazione e calendario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            label="Vista predefinita task"
            description="Visualizzazione di default per i task"
          >
            <Select
              value={settings.defaultTaskView}
              onValueChange={(value: string | null) =>
                value && updateSettings({ defaultTaskView: value as "list" | "board" | "calendar" })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">Elenco</SelectItem>
                <SelectItem value="board">Bacheca</SelectItem>
                <SelectItem value="calendar">Calendario</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator className="my-2" />

          <SettingRow
            label="Primo giorno della settimana"
            description="Imposta il giorno di inizio del calendario"
          >
            <Select
              value={settings.calendarFirstDay}
              onValueChange={(value: string | null) =>
                value && updateSettings({ calendarFirstDay: value as "0" | "1" })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Lunedì</SelectItem>
                <SelectItem value="0">Domenica</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator className="my-2" />

          <SettingRow
            label="Lingua"
            description="Lingua dell&apos;interfaccia"
          >
            <Select
              value={settings.language}
              onValueChange={(value: string | null) =>
                value && updateSettings({ language: value as "it" | "en" })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">
                  <span className="flex items-center gap-2">
                    🇮🇹 Italiano
                  </span>
                </SelectItem>
                <SelectItem value="en">
                  <span className="flex items-center gap-2">
                    🇬🇧 English
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </CardContent>
      </Card>

      {/* Database */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Database</CardTitle>
          </div>
          <CardDescription>Informazioni sul database locale</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            SQLite locale &mdash; file:{" "}
            <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
              prisma/dev.db
            </code>
          </p>
          <p>
            Per fare backup, copia il file{" "}
            <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
              dev.db
            </code>{" "}
            in un altro percorso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
