# Command Center Personale — Piano Tecnico

> Proposto da Prometheus Engine (Tier 4) in data 2026-07-12

---

## 1. Architettura Generale

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14 App Router)  │
│  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌────────┐  │
│  │ Dashboard│  │ Progetti │  │ Task │  │Calendar│  │
│  │ TodayView│  │ Kanban   │  │ Liste│  │G/S/M   │  │
│  └──────────┘  └──────────┘  └──────┘  └────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Command Palette (Cmd+K) + Keyboard Shortcuts  │  │
│  └────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│         API Routes (/api/*)                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐           │
│  │Project│ │ Task │ │Event │ │ /ai/*    │           │
│  │ CRUD  │ │ CRUD │ │ CRUD │ │ Ollama   │           │
│  └──────┘ └──────┘ └──────┘ └──────────┘           │
├─────────────────────────────────────────────────────┤
│         Prisma ORM → SQLite (local.db)              │
│         Ollama REST API (http://localhost:11434)     │
└─────────────────────────────────────────────────────┘
```

## 2. Struttura Cartelle

```
command-center/
├── prisma/
│   ├── schema.prisma          # Modello dati definitivo
│   └── seed.ts                # Seed di sviluppo (opzionale)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (sidebar + nav)
│   │   ├── page.tsx           # Dashboard Today View
│   │   ├── projects/
│   │   │   ├── page.tsx       # Lista progetti
│   │   │   └── [id]/
│   │   │       └── page.tsx   # Dettaglio progetto (kanban)
│   │   ├── tasks/
│   │   │   └── page.tsx       # Lista task filtrabile
│   │   ├── calendar/
│   │   │   └── page.tsx       # Vista calendario
│   │   └── api/
│   │       ├── projects/      # CRUD progetti
│   │       ├── tasks/         # CRUD task
│   │       ├── events/        # CRUD eventi calendario
│   │       ├── milestones/    # CRUD milestone
│   │       └── ai/            # Endpoint Ollama
│   │           ├── route.ts   # Chat generica
│   │           ├── prioritize/route.ts
│   │           ├── weekly-summary/route.ts
│   │           ├── parse-natural/route.ts
│   │           └── models/route.ts  # Lista modelli disponibili
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   └── command-palette.tsx
│   │   ├── projects/
│   │   │   ├── project-card.tsx
│   │   │   ├── project-form.tsx
│   │   │   └── project-kanban.tsx
│   │   ├── tasks/
│   │   │   ├── task-list.tsx
│   │   │   ├── task-row.tsx
│   │   │   ├── task-form.tsx
│   │   │   ├── task-filters.tsx
│   │   │   └── eisenhower-matrix.tsx
│   │   ├── calendar/
│   │   │   ├── calendar-view.tsx
│   │   │   ├── event-form.tsx
│   │   │   └── weekly-load.tsx
│   │   ├── dashboard/
│   │   │   ├── today-view.tsx
│   │   │   ├── overdue-tasks.tsx
│   │   │   └── upcoming-deadlines.tsx
│   │   └── ai/
│   │       ├── ai-panel.tsx
│   │       ├── model-selector.tsx
│   │       └── natural-input.tsx
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── ollama.ts          # Ollama API client
│   │   └── utils.ts           # Utility functions
│   ├── hooks/
│   │   ├── use-projects.ts    # React Query hooks
│   │   ├── use-tasks.ts
│   │   ├── use-events.ts
│   │   ├── use-ollama.ts
│   │   └── use-keyboard.ts    # Keyboard shortcuts
│   ├── store/
│   │   └── ui-store.ts        # Zustand per UI state
│   ├── types/
│   │   └── index.ts           # TypeScript types condivisi
│   └── styles/
│       └── globals.css        # Tailwind + theme
├── public/
├── .env.local                 # DATABASE_URL + OLLAMA_URL
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── components.json            # shadcn/ui config
```

## 3. Schema Dati Definitivo (Prisma)

Il tuo schema è già solido. Propongo queste **ottimizzazioni**:

1. **Aggiungo `isArchived` boolean** su Task (soft-delete invece di eliminare fisicamente)
2. **Aggiungo `recurrence` su CalendarEvent** (regola RRULE opzionale per eventi ricorrenti tipo "sprint review ogni lunedì")
3. **Rinomino `linkedTaskId`** in `CalendarEvent` opzionale e aggiungo `linkedProjectId` opzionale per completezza

Schema finale identico al tuo salvo queste 3 aggiunte minori.

## 4. Scelte Tecniche & Librerie

| Componente | Scelta | Motivazione |
|---|---|---|
| **Framework** | Next.js 14 App Router | SSR + API routes nello stesso progetto |
| **ORM** | Prisma + SQLite | Zero setup, backup facile, type-safe |
| **UI Kit** | shadcn/ui (Radix primitives) | Accessibilità, dark mode nativa, customization |
| **Calendario** | FullCalendar (react-fullcalendar-6) | Più maturo di react-big-calendar, view giornaliera migliore |
| **Drag & Drop** | dnd-kit | Leggero, accessible, perfetto per Eisenhower |
| **State Server** | TanStack Query (React Query) | Caching, refetch, optimistic updates |
| **State Client** | Zustand | Leggero, no boilerplate |
| **AI** | Ollama REST API | Locale, gratis, modelli a scelta |
| **Command Palette** | cmdk (by Paco Coursey) | Stile Linear, integrazione perfetta con shadcn |
| **Date** | date-fns | Tree-shakeable, funzioni pure |

## 5. Fasi di Sviluppo

### Fase 1 — Fondamenta ✅ (PRIMA)
1. `npx create-next-app` + setup completo stack
2. Prisma schema + migrazione + seed
3. CRUD Progetti (API + UI con shadcn)
4. CRUD Task (API + UI con filtri/ordinamento)
5. Sotto-task (relazione ricorsiva)
6. Sidebar navigazione + layout base

### Fase 2 — Calendario
7. Vista calendario (FullCalendar g/s/m)
8. Drag task → calendario (scheduledStart/scheduledEnd)
9. CRUD eventi calendario
10. Vista carico settimanale

### Fase 3 — Dashboard & Viste
11. Today View dashboard
12. Matrice Eisenhower drag & drop
13. Kanban per progetto
14. Command palette (Cmd+K)
15. Keyboard shortcuts

### Fase 4 — AI (Ollama)
16. Endpoint /api/ai/*
17. Model selector
18. Prioritize my day
19. Weekly summary
20. Natural language parsing
21. Overload detection (euristica + AI)

## 6. Criteri di Qualità

- **TypeScript strict mode** — nessun `any` senza motivo documentato
- **React Server Components** dove possibile (liste read-only)
- **API Routes** con validazione Zod su input/output
- **Error handling** ovunque (nessuna crashatura silenziosa)
- **Responsive** desktop-first, funzionante su tablet
- **Ollama opzionale** — app funziona anche senza AI

## 7. GitHub Strategy

Il repository `ffazecaldy/PersonalDevAssistant` su GitHub va **creato** (non esiste ancora). 
Servono credenziali GitHub o un personal access token per pushare.

---

**Criticità da risolvere prima di iniziare:**
1. 🔑 **GitHub token** — mi serve un Personal Access Token con repo scope per creare e pushare su `ffazecaldy/PersonalDevAssistant`
2. 📁 **Directory di lavoro** — creo il progetto in `ProgettiAtigravity/HERMES/CommandCenter/` o nella cartella corrente (`PersonalDevAssitant`)?
3. 🧠 **Modello Ollama** — che modello vuoi usare? (es. `llama3.2`, `mistral`, `qwen2.5`, `phi4`)
