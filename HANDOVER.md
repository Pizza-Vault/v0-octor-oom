# OCTORoom - Housekeeping Planner System

## Projektübersicht

OCTORoom ist ein Housekeeping-Planungssystem für das AAAB (Apartmenthaus). Es verwaltet Reinigungsaufgaben für 22 Zimmer und ermöglicht die Koordination zwischen dem Betreiber (Admin) und externen Reinigungsfirmen (Vendors).

**Tech Stack:**
- Frontend: Next.js 16 (App Router), React 19, TypeScript
- Styling: Tailwind CSS v4, shadcn/ui Komponenten
- Backend: Supabase (PostgreSQL, Auth, RLS)
- Deployment: Vercel (mit standalone output für Infomaniak-Kompatibilität)

---

## Datenbankschema

### Tabellen

#### `octo_profiles`
Benutzerprofile für Auth-Integration.
```
id: UUID (PK, FK -> auth.users)
role: user_role_enum ('admin' | 'vendor')
company: TEXT
display_name: TEXT
created_at: TIMESTAMPTZ
```

#### `octo_rooms`
Die 22 Zimmer des Apartmenthauses.
```
id: UUID (PK)
room_number: INT (UNIQUE) - Zimmernummer 1-22
name: TEXT - Optionaler Anzeigename
restant_policy: JSONB - Reinigungsintervall-Konfiguration
  - {"type": "every_n_days", "n_days": 3} - Alle N Tage
  - {"type": "weekly_on_days", "days_of_week": [5]} - An bestimmten Wochentagen (1=Mo, 7=So)
last_restant_at: DATE - Letztes Restant-Reinigungsdatum (für Timer-Berechnung)
last_depart_at: DATE - Letztes Depart-Datum
last_qc_at: DATE - Letzte Qualitätskontrolle
occupied: BOOLEAN - Ist ein Gast im Zimmer? (TRUE=belegt, FALSE=leer)
blocked_for_cleaning: BOOLEAN - Zimmer für Reinigung gesperrt
blocked_from/to: DATE - Sperrzeitraum
blocked_reason: TEXT
count_depart/restant/qc: INT - Zähler für Statistiken
```

#### `octo_tasks`
Reinigungsaufgaben.
```
id: UUID (PK)
task_date: DATE - Datum der Aufgabe
room_id: UUID (FK -> octo_rooms)
type: task_type_enum ('depart' | 'restant' | 'qc')
status: task_status_enum ('open' | 'done' | 'skipped' | 'failed')
skip_reason: TEXT - Grund bei status='skipped'
note: TEXT - Optionale Notiz
done_at: TIMESTAMPTZ - Wann erledigt
done_by: UUID (FK -> auth.users) - Wer hat erledigt
created_by: UUID - Wer hat erstellt
UNIQUE (task_date, room_id, type) - Max. 1 Task pro Zimmer/Typ/Tag
```

#### `octo_events`
Audit-Trail (unveränderlich).
```
id: UUID (PK)
task_id: UUID (FK -> octo_tasks, nullable)
room_id: UUID (FK -> octo_rooms)
task_date: DATE
type: task_type_enum
action: task_status_enum - Was wurde gemacht
performed_at: TIMESTAMPTZ
performed_by: UUID
performed_by_name: TEXT - Name zum Zeitpunkt der Aktion
performed_by_company: TEXT - Firma zum Zeitpunkt der Aktion
note: TEXT
meta: JSONB - Zusätzliche Daten
```

### ENUMs
```sql
task_type_enum: 'depart', 'restant', 'qc'
task_status_enum: 'open', 'done', 'skipped', 'failed'
user_role_enum: 'admin', 'vendor'
```

---

## Geschäftslogik

### Task-Typen

1. **Depart (Auszug)**: Gast checkt aus → Zimmer muss gereinigt werden
   - Wird manuell vom Admin erstellt
   - Nach Erledigung: `occupied = FALSE` (Zimmer wartet auf neuen Gast)

2. **Restant (Zwischenreinigung)**: Gast bleibt, Zimmer wird gereinigt
   - Wird automatisch generiert basierend auf `restant_policy`
   - Nur für belegte Zimmer (`occupied = TRUE`)
   - Timer beginnt beim Check-In

3. **QC (Quality Check)**: Qualitätskontrolle nach Reinigung

### Workflow

```
Gast zieht ein (Check-In)
    ↓
occupied = TRUE, last_restant_at = heute (Timer startet)
    ↓
[Automatische Restant-Tasks nach Policy]
    ↓
Gast zieht aus → Admin erstellt Depart-Task
    ↓
Vendor markiert Depart als "Done"
    ↓
occupied = FALSE (Zimmer leer, wartet)
    ↓
[Keine Restant-Tasks für leere Zimmer]
    ↓
Neuer Gast → Check-In → Zyklus wiederholt sich
```

### Timer-Reset-Logik

- **Bei Depart "Done"**: `occupied = FALSE`, Zimmer wartet leer
- **Bei Check-In**: `occupied = TRUE`, `last_restant_at = check_in_date` (Timer auf 0)
- **Bei Restant "Done"**: `last_restant_at = task_date` (Timer resettet für nächstes Intervall)

---

## RPC-Funktionen (Supabase)

### `mark_task(p_task_id, p_new_status, p_skip_reason, p_note)`
Markiert einen Task als erledigt/übersprungen.
- Aktualisiert Task-Status
- Erstellt Event im Audit-Trail
- Bei Depart "Done": Setzt `occupied = FALSE`
- Bei Restant "Done": Aktualisiert `last_restant_at`
- Aktualisiert Zähler

### `create_depart_task(p_room_id, p_task_date)`
Erstellt manuell einen Depart-Task für ein Zimmer.

### `check_in_room(p_room_id, p_check_in_date)`
Check-In eines neuen Gastes.
- Setzt `occupied = TRUE`
- Setzt `last_restant_at = check_in_date` (Timer-Reset)

### `generate_tasks_for_date(p_date)`
Generiert automatisch Restant-Tasks für ein Datum.
- Nur für belegte, nicht-blockierte Zimmer
- Berücksichtigt individuelle `restant_policy` pro Zimmer
- Verhindert Duplikate (UNIQUE constraint)

### `forecast_tasks(p_start, p_end)`
Prognostiziert zukünftige Tasks für Personalplanung.
- Gibt Tabelle zurück: forecast_date, room_id, room_number, task_type
- Nur für aktuell belegte Zimmer

---

## Benutzerrollen & Berechtigungen

### Admin
- Kann alles sehen und bearbeiten
- Erstellt Depart-Tasks
- Generiert Restant-Tasks
- Verwaltet Zimmer (Check-In, Blocking)
- Sieht Reports und Personalplanung

### Vendor (Reinigungsfirma)
- Sieht nur zugewiesene Tasks
- Kann Tasks als "Done" oder "Skipped" markieren
- Sieht Forecast für eigene Planung
- Kann History einsehen

### RLS Policies
- Profiles: Nur eigenes Profil lesen/ändern
- Rooms: Admin+Vendor lesen, nur Admin ändern
- Tasks: Admin+Vendor lesen, Admin erstellen/löschen, beide aktualisieren
- Events: Admin+Vendor lesen

---

## Dateistruktur

```
app/
├── admin/
│   ├── dashboard/page.tsx    - Admin-Übersicht, Task-Generierung
│   ├── tasks/page.tsx        - Task-Verwaltung mit Datumsauswahl
│   ├── rooms/page.tsx        - Zimmerverwaltung, Check-In
│   ├── reports/page.tsx      - Event-History/Audit-Trail
│   ├── planning/page.tsx     - Personalplanung mit Forecast
│   └── layout.tsx            - Admin-Layout mit Auth-Check
├── vendor/
│   ├── today/page.tsx        - Heutige Tasks für Vendor
│   ├── forecast/page.tsx     - Vorschau kommender Tasks
│   ├── history/page.tsx      - Erledigte Tasks
│   └── layout.tsx            - Vendor-Layout mit Auth-Check
├── auth/
│   ├── login/page.tsx        - Login-Seite
│   └── error/page.tsx        - Auth-Fehlerseite
├── api/
│   └── create-admin/route.ts - Einmalige Admin-Erstellung
├── setup/page.tsx            - Setup-Seite für ersten Admin
├── page.tsx                  - Redirect zu Login
└── layout.tsx                - Root-Layout mit Fonts/Metadata

components/octoroom/
├── header.tsx                - Navigation Header
├── task-list.tsx             - Task-Anzeige mit Done/Skip-Buttons
├── rooms-list.tsx            - Zimmer-Grid mit Check-In
├── date-selector.tsx         - Datumsauswahl-Komponente
├── planning-date-selector.tsx - Erweiterte Datumsauswahl für Forecast
├── create-depart-button.tsx  - Depart-Task erstellen
└── generate-tasks-button.tsx - Restant-Tasks generieren

lib/
├── supabase/
│   ├── client.ts             - Browser-Client (Singleton)
│   ├── server.ts             - Server-Client für RSC
│   └── proxy.ts              - Middleware für Auth-Routing
└── types.ts                  - TypeScript-Interfaces
```

---

## Konfiguration

### Restant-Policy Beispiele

```json
// Alle 3 Tage reinigen
{"type": "every_n_days", "n_days": 3}

// Jeden Freitag reinigen (5 = Freitag im ISO-Format)
{"type": "weekly_on_days", "days_of_week": [5]}

// Montag und Donnerstag
{"type": "weekly_on_days", "days_of_week": [1, 4]}
```

### Aktuelle Zimmer-Konfiguration
- Zimmer 1-6, 8-10, 16-22: Alle 3 Tage
- Zimmer 7: Jeden Freitag
- Zimmer 11-15: Alle 7 Tage

---

## API-Integration (geplant)

Für Webhook-Integration mit externem Buchungssystem:

### Check-In Webhook
```
POST /api/webhook/checkin
{
  "room_number": 5,
  "check_in_date": "2024-01-15",
  "guest_name": "Optional"
}
```

### Check-Out/Depart Webhook
```
POST /api/webhook/checkout
{
  "room_number": 5,
  "checkout_date": "2024-01-20"
}
```

---

## Wichtige Hinweise

1. **Singleton-Pattern**: Browser-Client verwendet Singleton um "Multiple GoTrueClient" Warnungen zu vermeiden

2. **RPC Parameter-Namen**: Supabase RPC erwartet exakte Parameter-Namen (p_task_id, p_new_status, etc.)

3. **Occupied-Flag**: Kritisch für korrekte Task-Generierung - nur belegte Zimmer bekommen Restant-Tasks

4. **Event-Audit**: Events sind unveränderlich und speichern den Namen/Firma zum Zeitpunkt der Aktion (nicht referenziert)

5. **Deployment**: `output: "standalone"` in next.config.mjs für Infomaniak-Kompatibilität

---

## Offene Punkte / Nächste Schritte

- [ ] Webhook-API für externes Buchungssystem implementieren
- [ ] Push-Benachrichtigungen für neue Tasks
- [ ] PDF-Export für Reports
- [ ] Multi-Tenant-Fähigkeit (mehrere Apartmenthäuser)
