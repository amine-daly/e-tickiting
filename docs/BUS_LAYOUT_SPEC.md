# Bus Seat Layout Builder — Copilot Agent Specification

> Attach this file to VS Code Copilot agent before generating any code related to the bus layout builder, seat map editor, deck management, or layout template persistence.
> This is the single source of truth for bus layout structure and builder behavior. Do not deviate from these definitions.

---

## 1. Core Principles

1. **Layout is bus-scoped** — every `layoutTemplate` belongs to exactly one `BusType` document
2. **Only populated cells are persisted** — empty / aisle cells are not stored; absence from the array means empty space
3. **CSS Grid is the rendering engine** — `gridX` maps to `grid-column`, `gridY` maps to `grid-row`, no canvas libraries
4. **Seat numbers are strings** — `seatNo` is a string (e.g. `"1"`, `"2A"`), never an integer
5. **Seat numbers must be unique** — across both decks within the same bus, no two elements may share a `seatNo`
6. **`totalSeats` is derived** — on save, `totalSeats` on the bus document equals the count of `SEAT` elements across both decks
7. **Layout is locked when bus is in active trip** — if `isBusLocked()` returns `true`, the builder opens in read-only mode
8. **Default layout is Tunisian standard** — when no `layoutTemplate` exists, pre-populate with a 5×14 Tunisian intercity bus layout (53 seats)

---

## 1.1 Relationship To Other Specs

This document is layout-builder-specific.

- `TRIP_SPEC.md` owns trip, segment, and seat inventory rules
- `TICKET_SPEC.md` owns ticket attribution and lifecycle
- This file owns layout template data shape, builder UX, grid mechanics, and element placement rules

If another document conflicts with this one on layout behavior, this file wins for layout rules. `TRIP_SPEC.md` wins for how trips reference bus seat counts.

---

## 2. Data Model

### 2.1 Element Types (Enum)

```typescript
enum LayoutElementType {
  SEAT = "SEAT",
  DRIVER = "DRIVER",
  DOOR = "DOOR",
  STAIRS = "STAIRS",
  TOILET = "TOILET",
}
```

| Type     | Meaning                 | `seatNo` | Max per deck | Visual                       |
| -------- | ----------------------- | -------- | ------------ | ---------------------------- |
| `SEAT`   | Passenger seat          | Required | Unlimited    | Blue fill, white number      |
| `DRIVER` | Driver position         | Never    | 1            | Dark gray, steering icon     |
| `DOOR`   | Entry/exit door         | Never    | Unlimited    | Red dashed border, door icon |
| `STAIRS` | Staircase between decks | Never    | Unlimited    | Orange fill, stairs icon     |
| `TOILET` | Onboard toilet          | Never    | 1            | Teal fill, drop icon         |

### 2.2 Layout Element

```typescript
interface LayoutElement {
  type: LayoutElementType;
  seatNo?: string | null; // required iff type === 'SEAT', null otherwise
  gridX: number; // 1-based column index, maps to CSS grid-column
  gridY: number; // 1-based row index, maps to CSS grid-row
}
```

Constraints:

- `gridX ∈ [1 .. gridColumns]`
- `gridY ∈ [1 .. gridRows]`
- `(gridX, gridY)` must be unique within each deck — no two elements may occupy the same cell
- `seatNo` must be a non-empty string when `type === 'SEAT'`
- `seatNo` must be `null` or absent when `type !== 'SEAT'`

### 2.3 Layout Template

```typescript
interface LayoutTemplate {
  gridColumns: number; // range: [3 .. 7], default: 5
  gridRows: number; // range: [5 .. 20], default: 14
  hasDecks: boolean; // default: false
  lowerDeck: LayoutElement[]; // always present (may be empty)
  upperDeck: LayoutElement[]; // always present (empty when hasDecks === false)
}
```

Constraints:

- `gridColumns` and `gridRows` define the grid size for **both** decks (same dimensions)
- When `hasDecks === false`, `upperDeck` must be an empty array
- No duplicate `seatNo` values across `lowerDeck` and `upperDeck` combined
- Maximum total elements: `gridColumns × gridRows × (hasDecks ? 2 : 1)` (theoretical ceiling, not a rule)

### 2.4 Bus Document Extension

```typescript
interface BusType {
  // ... existing fields (id, name, target, totalSeats, amenities, media) ...
  layoutTemplate?: LayoutTemplate; // NEW — optional, null when bus has no designed layout
}
```

**`totalSeats` derivation rule**: On every save of `layoutTemplate`, the backend must recompute `totalSeats` as the count of elements where `type === 'SEAT'` across both decks. The frontend also sends the computed value for optimistic display.

---

## 3. Backend API Changes

### 3.1 New Java Types

| File                     | Type                  | Fields                                                                                                                  |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `LayoutElementType.java` | Enum                  | `SEAT`, `DRIVER`, `DOOR`, `STAIRS`, `TOILET`                                                                            |
| `LayoutElement.java`     | POJO (Lombok `@Data`) | `LayoutElementType type`, `String seatNo`, `int gridX`, `int gridY`                                                     |
| `LayoutTemplate.java`    | POJO (Lombok `@Data`) | `int gridColumns`, `int gridRows`, `boolean hasDecks`, `List<LayoutElement> lowerDeck`, `List<LayoutElement> upperDeck` |

### 3.2 BusType.java Change

Add field:

```java
private LayoutTemplate layoutTemplate;
```

### 3.3 Controller DTO Changes

**BusUpdateReq** — add:

```java
public record LayoutElementReq(
    @NotNull LayoutElementType type,
    String seatNo,
    @Min(1) int gridX,
    @Min(1) int gridY
) {}

public record LayoutTemplateReq(
    @Min(3) @Max(7) int gridColumns,
    @Min(5) @Max(20) int gridRows,
    boolean hasDecks,
    @NotNull List<LayoutElementReq> lowerDeck,
    List<LayoutElementReq> upperDeck
) {}
```

Add to `BusUpdateReq`: `LayoutTemplateReq layoutTemplate` (nullable — omit to leave unchanged).

**BusRes** — add matching response records:

```java
public record LayoutElementRes(String type, String seatNo, int gridX, int gridY) {}
public record LayoutTemplateRes(int gridColumns, int gridRows, boolean hasDecks,
                                 List<LayoutElementRes> lowerDeck, List<LayoutElementRes> upperDeck) {}
```

### 3.4 Backend Validation Rules

On `BusService.update()`, when `layoutTemplate` is present in the request:

1. All `gridX` values must be in `[1 .. gridColumns]`
2. All `gridY` values must be in `[1 .. gridRows]`
3. No duplicate `(gridX, gridY)` within the same deck
4. No duplicate `seatNo` across both decks
5. `seatNo` must be non-blank when `type == SEAT`
6. `seatNo` must be null when `type != SEAT`
7. If `hasDecks == false`, `upperDeck` must be empty or null
8. If bus is locked (in active trip), reject with `LAYOUT_LOCKED` error
9. After validation, compute `totalSeats` = seat count and persist alongside layout

---

## 4. Frontend Route

| Route                  | Component                | Resolver               | Purpose                |
| ---------------------- | ------------------------ | ---------------------- | ---------------------- |
| `/buses/:busId/layout` | `LayoutBuilderComponent` | `BusResolver` (reused) | Visual seat map editor |

**Entry point**: "Design Layout" button on bus edit page → `routerLink="/buses/${bus.id}/layout"`.

---

## 5. Default Tunisian Layout

When a bus has no `layoutTemplate`, the builder initializes with the standard Tunisian intercity bus configuration:

```
gridColumns: 5, gridRows: 14, hasDecks: false
```

### 5.1 Grid Column Semantics

| Column | Position         | French Label |
| ------ | ---------------- | ------------ |
| 1      | Window left      | Fenêtre G    |
| 2      | Aisle-side left  | Allée G      |
| 3      | Center aisle     | ALLÉE        |
| 4      | Aisle-side right | Allée D      |
| 5      | Window right     | Fenêtre D    |

### 5.2 Default Element Placement

```
Row  1: DRIVER(1,1) ·  ·  · DOOR(5,1)
Row  2: SEAT#1(1,2)  SEAT#2(2,2)  ·  SEAT#3(4,2)  SEAT#4(5,2)
Row  3: SEAT#5(1,3)  SEAT#6(2,3)  ·  SEAT#7(4,3)  SEAT#8(5,3)
Row  4: SEAT#9(1,4)  SEAT#10(2,4) ·  SEAT#11(4,4) SEAT#12(5,4)
Row  5: SEAT#13(1,5) SEAT#14(2,5) ·  SEAT#15(4,5) SEAT#16(5,5)
Row  6: SEAT#17(1,6) SEAT#18(2,6) ·  SEAT#19(4,6) SEAT#20(5,6)
Row  7: SEAT#21(1,7) SEAT#22(2,7) ·  ·            DOOR(5,7)
Row  8: SEAT#23(1,8) SEAT#24(2,8) ·  SEAT#25(4,8) SEAT#26(5,8)
Row  9: SEAT#27(1,9) SEAT#28(2,9) ·  SEAT#29(4,9) SEAT#30(5,9)
Row 10: SEAT#31(1,10) SEAT#32(2,10) · SEAT#33(4,10) SEAT#34(5,10)
Row 11: SEAT#35(1,11) SEAT#36(2,11) · SEAT#37(4,11) SEAT#38(5,11)
Row 12: SEAT#39(1,12) SEAT#40(2,12) · SEAT#41(4,12) SEAT#42(5,12)
Row 13: SEAT#43(1,13) SEAT#44(2,13) · SEAT#45(4,13) SEAT#46(5,13)
Row 14: SEAT#47(1,14) SEAT#48(2,14) SEAT#49(3,14) SEAT#50(4,14) SEAT#51(5,14)
```

**51 seats total.** Row 14 is the continuous back bench spanning all 5 columns (no aisle gap). Column 3 is the aisle for rows 1–13 (empty, not persisted).

### 5.3 Generation Rule

The default layout is generated by a pure function `buildDefaultTunisianLayout(): LayoutTemplate` in TypeScript. This function is deterministic and produces the exact placement above. It is called:

- On component init when `bus.layoutTemplate` is `null` or `undefined`
- On "Reset to default" button click (after user confirmation)

---

## 6. Builder UX — Component State

All state lives in the component (no service / store needed for MVP):

| Field            | Type                                    | Default        | Purpose                                |
| ---------------- | --------------------------------------- | -------------- | -------------------------------------- |
| `bus`            | `BusType`                               | From resolver  | Source bus entity                      |
| `gridColumns`    | `number`                                | `5`            | Current column count                   |
| `gridRows`       | `number`                                | `14`           | Current row count                      |
| `hasDecks`       | `boolean`                               | `false`        | Dual-deck mode                         |
| `activeDeck`     | `'lower' \| 'upper'`                    | `'lower'`      | Which deck is being edited             |
| `lowerDeck`      | `Map<string, LayoutElement>`            | Default layout | Key = `"gridX,gridY"`                  |
| `upperDeck`      | `Map<string, LayoutElement>`            | Empty          | Key = `"gridX,gridY"`                  |
| `selectedTool`   | `LayoutElementType \| 'ERASER' \| null` | `'SEAT'`       | Active palette tool                    |
| `nextSeatNo`     | `number`                                | Computed       | Next auto-increment seat number        |
| `editingSeatKey` | `string \| null`                        | `null`         | Cell key currently being renamed       |
| `isSaving`       | `boolean`                               | `false`        | Submit spinner                         |
| `isDirty`        | `boolean`                               | `false`        | Unsaved changes flag                   |
| `isLocked`       | `boolean`                               | `false`        | Read-only mode when bus in active trip |

### 6.1 Map Key Convention

Elements are stored in a `Map<string, LayoutElement>` keyed by `"gridX,gridY"` string for O(1) lookup on hover and click. Serialization to JSON array: `Array.from(map.values())`.

### 6.2 Auto-Numbering

```typescript
nextSeatNo =
  Math.max(
    0,
    ...allSeatsFromBothDecks.map((e) => parseInt(e.seatNo, 10) || 0),
  ) + 1;
```

Recalculated after every place or erase operation.

---

## 7. Builder UX — Interaction Model

### 7.1 Tool Palette

Sidebar with 6 tool buttons. Selected tool is highlighted. Keyboard shortcuts in brackets:

| Tool   | Key | Cursor    | Behavior                                         |
| ------ | --- | --------- | ------------------------------------------------ |
| SEAT   | `S` | Crosshair | Auto-assigns next seat number on click           |
| DRIVER | `W` | Crosshair | Places driver icon, max 1 per deck               |
| DOOR   | `D` | Crosshair | Places door icon                                 |
| STAIRS | `^` | Crosshair | Places stairs icon (only relevant when hasDecks) |
| TOILET | `T` | Crosshair | Places toilet icon                               |
| ERASER | `X` | Eraser    | Removes element from clicked cell                |

### 7.2 Click-to-Place

1. User selects tool from palette
2. User clicks empty cell on the grid
3. Element of that type is created with `(gridX, gridY)` from the cell's grid position
4. If tool is `SEAT`: `seatNo` = `String(nextSeatNo)`, then `nextSeatNo++`
5. If tool is `ERASER`: remove element at that cell (no-op if cell is empty)
6. If cell is already occupied and tool is not `ERASER`: replace existing element with new one
7. Mark `isDirty = true`

### 7.3 Hover Ghost Preview

When a tool is selected and the cursor enters an empty cell:

- Show a 30% opacity preview of the tool's icon/color in that cell
- CSS class `.ghost-preview` added to the cell element
- On `mouseleave`, remove the preview
- No ghost shown on occupied cells (unless eraser is selected — show red overlay)

### 7.4 Seat Rename (Inline Edit)

1. User clicks an existing `SEAT` element
2. A small `<input>` overlay appears over the cell, pre-filled with current `seatNo`
3. Input is auto-focused and auto-selected
4. On `Enter` or `blur`: validate uniqueness, update `seatNo` in the Map
5. If duplicate: revert to previous value, show toast warning
6. On `Escape`: cancel edit, revert

### 7.5 Right-Click Erase

`contextmenu` event on any occupied cell removes the element regardless of selected tool. Prevents browser context menu.

### 7.6 Deck Switching

- Tab bar above the grid: "Étage inférieur" / "Étage supérieur"
- Clicking a tab sets `activeDeck` and renders the corresponding Map
- Upper deck tab is disabled (grayed, non-clickable) when `hasDecks === false`
- Toggling `hasDecks` off clears `upperDeck` Map after confirmation if it has elements

### 7.7 Grid Resize

- Column and row spinners in the Parameters section
- On value change:
  - Count elements that would be out of bounds (`gridX > newCols` or `gridY > newRows`)
  - If any: show confirmation dialog with count of elements to be removed
  - On confirm: remove out-of-bounds elements, update grid dimensions
  - On cancel: revert spinner value
- Minimum: 3 columns, 5 rows
- Maximum: 7 columns, 20 rows

---

## 8. Builder UX — Visual Design

### 8.1 Layout (Three-Column)

```
┌─────────────┬──────────────────────────────┬───────────────────┐
│ Tool Palette │       Grid Canvas            │ JSON Preview      │
│  (~180px)    │     (flex: 1, scrollable)    │   (~280px)        │
│              │                              │                   │
│ [SEAT]  [S]  │  ┌──┬──┬──┬──┬──┐           │ { "layoutTemplate │
│ [DRIVER][W]  │  │  │  │  │  │  │  Row 1    │   "gridColumns":5 │
│ [DOOR]  [D]  │  ├──┼──┼──┼──┼──┤           │   ...             │
│ [STAIRS][^]  │  │  │  │  │  │  │  Row 2    │ }                 │
│ [TOILET][T]  │  ├──┼──┼──┼──┼──┤           │                   │
│ [ERASER][X]  │  │  │  │  │  │  │  Row 3    │ ┌──────────────┐  │
│              │  └──┴──┴──┴──┴──┘           │ │ Sauvegarder  │  │
│ Parameters   │  Column headers above       │ │ Réinitialiser │  │
│ Grid 5x14 ↕  │  Row numbers left           │ └──────────────┘  │
│              │                              │                   │
│ ☐ Deux étages│  Deck tabs above grid       │ Sièges: 51       │
└─────────────┴──────────────────────────────┴───────────────────┘
```

### 8.2 Color Scheme (Theme-Aware)

All colors use Bootstrap/Metronic CSS variables for dark mode compatibility:

| Element        | Light Mode                    | CSS Variable / Class                               |
| -------------- | ----------------------------- | -------------------------------------------------- |
| SEAT           | `#3699FF` (primary blue)      | `var(--bs-primary)`                                |
| SEAT text      | White                         | `var(--bs-white)`                                  |
| DRIVER         | `#7E8299` (gray-600)          | `var(--bs-gray-600)`                               |
| DOOR           | Transparent, `#F1416C` border | `var(--bs-danger)` dashed border                   |
| STAIRS         | `#FFA800` (warning)           | `var(--bs-warning)`                                |
| TOILET         | `#20C997` (teal/success)      | Custom `--layout-toilet` or `var(--bs-success)`    |
| ERASER         | White with `×` icon           | `var(--bs-light)`                                  |
| Empty cell     | Transparent                   | `var(--bs-gray-200)` dashed border                 |
| Ghost preview  | Same as tool color            | `opacity: 0.3`                                     |
| Selected tool  |                               | `var(--bs-primary)` ring / active state            |
| Locked overlay |                               | Semi-transparent `rgba(0,0,0,0.05)` with lock icon |

### 8.3 Cell Sizing

```scss
.grid-cell {
  min-width: 48px;
  min-height: 48px;
  max-width: 72px;
  aspect-ratio: 1;
  border-radius: 8px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    opacity 0.15s ease;
}
```

### 8.4 Responsive Behavior

| Breakpoint       | Behavior                                                            |
| ---------------- | ------------------------------------------------------------------- |
| `≥ 1200px`       | Three-column layout (palette + grid + preview)                      |
| `992px – 1199px` | Two-column: palette collapses above grid, preview below             |
| `< 992px`        | Single column: palette → grid (horizontal scroll) → preview stacked |

---

## 9. Save Flow

### 9.1 Serialize

```typescript
function serializeLayout(): LayoutTemplate {
  return {
    gridColumns,
    gridRows,
    hasDecks,
    lowerDeck: Array.from(lowerDeckMap.values()),
    upperDeck: hasDecks ? Array.from(upperDeckMap.values()) : [],
  };
}
```

### 9.2 Compute Seat Count

```typescript
const totalSeats = [...lowerDeck, ...upperDeck].filter(
  (e) => e.type === "SEAT",
).length;
```

### 9.3 API Call

```typescript
busService.update(bus.id, { layoutTemplate: serializeLayout(), totalSeats });
```

### 9.4 Post-Save

- On success: toast "Plan sauvegardé avec succès", set `isDirty = false`
- On error:
  - If `LAYOUT_LOCKED`: toast "Plan en lecture seule — bus dans un voyage actif"
  - Otherwise: toast "Impossible de sauvegarder le plan"
- On network error: toast generic error

### 9.5 Unsaved Changes Guard

If `isDirty === true` and user navigates away (back button, route change):

- Show browser `beforeunload` confirmation
- Optionally implement `CanDeactivate` route guard with a confirm dialog

---

## 10. Read-Only Mode (Locked Bus)

When `busService.isBusLocked(busId)` returns `true`:

1. All cells are non-clickable (no hover ghost, no click handler)
2. Tool palette is disabled (grayed out)
3. Grid parameters (columns, rows spinners) are disabled
4. Deck toggle is disabled
5. Save button is hidden
6. Reset button is hidden
7. A lock banner is displayed above the grid: "Ce plan est en lecture seule car le bus est dans un voyage actif."
8. JSON preview remains visible for reference

---

## 11. i18n Keys

All user-facing strings must use `@ngx-translate`. Namespace: `BUSES.LAYOUT.*`

```json
{
  "BUSES": {
    "LAYOUT": {
      "TITLE": "Plan d'aménagement",
      "SUBTITLE": "Dessiner le plan de sièges du bus",
      "DESIGN_BUTTON": "Concevoir le plan",
      "TOOL": {
        "SEAT": "Siège",
        "DRIVER": "Conducteur",
        "DOOR": "Porte",
        "STAIRS": "Escalier",
        "TOILET": "Toilettes",
        "ERASER": "Effacer"
      },
      "DECK_LOWER": "Étage inférieur",
      "DECK_UPPER": "Étage supérieur",
      "HAS_DECKS": "Bus à deux étages",
      "PARAMETERS": "Paramètres",
      "GRID_SIZE": "Grille",
      "GRID_COLUMNS": "Colonnes",
      "GRID_ROWS": "Rangées",
      "SEAT_COUNT": "Sièges",
      "ACTIVE_TOOL": "Outil actif",
      "AUTO_NUMBER": "Auto-Nombre",
      "JSON_PREVIEW": "Exportation JSON / Aperçu",
      "SAVE_SUCCESS": "Plan sauvegardé avec succès.",
      "SAVE_ERROR": "Impossible de sauvegarder le plan.",
      "LOCKED": "Ce plan est en lecture seule car le bus est dans un voyage actif.",
      "CONFIRM_RESIZE": "Redimensionner supprimera {{count}} élément(s) hors limites. Continuer ?",
      "RESET": "Réinitialiser",
      "RESET_CONFIRM": "Réinitialiser au plan tunisien par défaut ? Toutes les modifications seront perdues.",
      "DUPLICATE_SEAT": "Le numéro de siège \"{{seatNo}}\" est déjà utilisé.",
      "COLUMN_HEADERS": {
        "1": "Fenêtre G",
        "2": "Allée G",
        "3": "ALLÉE",
        "4": "Allée D",
        "5": "Fenêtre D"
      }
    }
  }
}
```

---

## 12. Canonical JSON Example

### 12.1 Single-Deck Bus (Default Tunisian — 51 seats)

```json
{
  "layoutTemplate": {
    "gridColumns": 5,
    "gridRows": 14,
    "hasDecks": false,
    "lowerDeck": [
      { "type": "DRIVER", "seatNo": null, "gridX": 1, "gridY": 1 },
      { "type": "DOOR", "seatNo": null, "gridX": 5, "gridY": 1 },

      { "type": "SEAT", "seatNo": "1", "gridX": 1, "gridY": 2 },
      { "type": "SEAT", "seatNo": "2", "gridX": 2, "gridY": 2 },
      { "type": "SEAT", "seatNo": "3", "gridX": 4, "gridY": 2 },
      { "type": "SEAT", "seatNo": "4", "gridX": 5, "gridY": 2 },

      { "type": "SEAT", "seatNo": "5", "gridX": 1, "gridY": 3 },
      { "type": "SEAT", "seatNo": "6", "gridX": 2, "gridY": 3 },
      { "type": "SEAT", "seatNo": "7", "gridX": 4, "gridY": 3 },
      { "type": "SEAT", "seatNo": "8", "gridX": 5, "gridY": 3 },

      { "type": "SEAT", "seatNo": "9", "gridX": 1, "gridY": 4 },
      { "type": "SEAT", "seatNo": "10", "gridX": 2, "gridY": 4 },
      { "type": "SEAT", "seatNo": "11", "gridX": 4, "gridY": 4 },
      { "type": "SEAT", "seatNo": "12", "gridX": 5, "gridY": 4 },

      { "type": "SEAT", "seatNo": "13", "gridX": 1, "gridY": 5 },
      { "type": "SEAT", "seatNo": "14", "gridX": 2, "gridY": 5 },
      { "type": "SEAT", "seatNo": "15", "gridX": 4, "gridY": 5 },
      { "type": "SEAT", "seatNo": "16", "gridX": 5, "gridY": 5 },

      { "type": "SEAT", "seatNo": "17", "gridX": 1, "gridY": 6 },
      { "type": "SEAT", "seatNo": "18", "gridX": 2, "gridY": 6 },
      { "type": "SEAT", "seatNo": "19", "gridX": 4, "gridY": 6 },
      { "type": "SEAT", "seatNo": "20", "gridX": 5, "gridY": 6 },

      { "type": "SEAT", "seatNo": "21", "gridX": 1, "gridY": 7 },
      { "type": "SEAT", "seatNo": "22", "gridX": 2, "gridY": 7 },
      { "type": "DOOR", "seatNo": null, "gridX": 5, "gridY": 7 },

      { "type": "SEAT", "seatNo": "23", "gridX": 1, "gridY": 8 },
      { "type": "SEAT", "seatNo": "24", "gridX": 2, "gridY": 8 },
      { "type": "SEAT", "seatNo": "25", "gridX": 4, "gridY": 8 },
      { "type": "SEAT", "seatNo": "26", "gridX": 5, "gridY": 8 },

      { "type": "SEAT", "seatNo": "27", "gridX": 1, "gridY": 9 },
      { "type": "SEAT", "seatNo": "28", "gridX": 2, "gridY": 9 },
      { "type": "SEAT", "seatNo": "29", "gridX": 4, "gridY": 9 },
      { "type": "SEAT", "seatNo": "30", "gridX": 5, "gridY": 9 },

      { "type": "SEAT", "seatNo": "31", "gridX": 1, "gridY": 10 },
      { "type": "SEAT", "seatNo": "32", "gridX": 2, "gridY": 10 },
      { "type": "SEAT", "seatNo": "33", "gridX": 4, "gridY": 10 },
      { "type": "SEAT", "seatNo": "34", "gridX": 5, "gridY": 10 },

      { "type": "SEAT", "seatNo": "35", "gridX": 1, "gridY": 11 },
      { "type": "SEAT", "seatNo": "36", "gridX": 2, "gridY": 11 },
      { "type": "SEAT", "seatNo": "37", "gridX": 4, "gridY": 11 },
      { "type": "SEAT", "seatNo": "38", "gridX": 5, "gridY": 11 },

      { "type": "SEAT", "seatNo": "39", "gridX": 1, "gridY": 12 },
      { "type": "SEAT", "seatNo": "40", "gridX": 2, "gridY": 12 },
      { "type": "SEAT", "seatNo": "41", "gridX": 4, "gridY": 12 },
      { "type": "SEAT", "seatNo": "42", "gridX": 5, "gridY": 12 },

      { "type": "SEAT", "seatNo": "43", "gridX": 1, "gridY": 13 },
      { "type": "SEAT", "seatNo": "44", "gridX": 2, "gridY": 13 },
      { "type": "SEAT", "seatNo": "45", "gridX": 4, "gridY": 13 },
      { "type": "SEAT", "seatNo": "46", "gridX": 5, "gridY": 13 },

      { "type": "SEAT", "seatNo": "47", "gridX": 1, "gridY": 14 },
      { "type": "SEAT", "seatNo": "48", "gridX": 2, "gridY": 14 },
      { "type": "SEAT", "seatNo": "49", "gridX": 3, "gridY": 14 },
      { "type": "SEAT", "seatNo": "50", "gridX": 4, "gridY": 14 },
      { "type": "SEAT", "seatNo": "51", "gridX": 5, "gridY": 14 }
    ],
    "upperDeck": []
  }
}
```

### 12.2 Double-Deck Bus (Example — 54 seats)

```json
{
  "layoutTemplate": {
    "gridColumns": 5,
    "gridRows": 15,
    "hasDecks": true,
    "lowerDeck": [
      { "type": "DRIVER", "seatNo": null, "gridX": 1, "gridY": 1 },
      { "type": "DOOR", "seatNo": null, "gridX": 5, "gridY": 1 },
      { "type": "STAIRS", "seatNo": null, "gridX": 4, "gridY": 1 },
      { "type": "SEAT", "seatNo": "1", "gridX": 1, "gridY": 2 },
      { "type": "SEAT", "seatNo": "2", "gridX": 2, "gridY": 2 }
    ],
    "upperDeck": [
      { "type": "STAIRS", "seatNo": null, "gridX": 4, "gridY": 1 },
      { "type": "SEAT", "seatNo": "15", "gridX": 1, "gridY": 2 },
      { "type": "SEAT", "seatNo": "16", "gridX": 2, "gridY": 2 },
      { "type": "SEAT", "seatNo": "17", "gridX": 4, "gridY": 2 },
      { "type": "SEAT", "seatNo": "18", "gridX": 5, "gridY": 2 }
    ]
  }
}
```

---

## 13. Implementation Tasks (Ordered)

| #   | Task                                                                         | Layer      |
| --- | ---------------------------------------------------------------------------- | ---------- |
| 1   | Create `LayoutElementType.java` enum                                         | Backend    |
| 2   | Create `LayoutElement.java` POJO                                             | Backend    |
| 3   | Create `LayoutTemplate.java` POJO                                            | Backend    |
| 4   | Add `layoutTemplate` field to `BusType.java`                                 | Backend    |
| 5   | Add nested request/response records to `BusController.java`                  | Backend    |
| 6   | Add layout validation logic in `BusService.java`                             | Backend    |
| 7   | Add `LayoutElementType`, `LayoutElement`, `LayoutTemplate` to `bus.model.ts` | Frontend   |
| 8   | Add `layoutTemplate?` to `BusType` interface                                 | Frontend   |
| 9   | Add route `/buses/:busId/layout` in `buses.routes.ts`                        | Frontend   |
| 10  | Create `LayoutBuilderComponent` (standalone) + SCSS                          | Frontend   |
| 11  | Implement `buildDefaultTunisianLayout()` function                            | Frontend   |
| 12  | Implement tool palette sidebar                                               | Frontend   |
| 13  | Implement CSS Grid canvas + cell rendering                                   | Frontend   |
| 14  | Implement hover ghost + click-to-place + eraser                              | Frontend   |
| 15  | Implement seat rename inline edit                                            | Frontend   |
| 16  | Implement deck toggle + tab switching                                        | Frontend   |
| 17  | Implement grid resize with clipping dialog                                   | Frontend   |
| 18  | Implement JSON preview panel                                                 | Frontend   |
| 19  | Implement save flow (serialize → API → toast)                                | Frontend   |
| 20  | Implement read-only locked mode                                              | Frontend   |
| 21  | Add "Design Layout" button to `details.component.html`                       | Frontend   |
| 22  | Add i18n keys to `fr-fr.json`                                                | Frontend   |
| 23  | Implement "Reset to default" with confirmation                               | Frontend   |
| 24  | Compile and verify both apps                                                 | Validation |

---

## 14. Copilot Agent Guardrails

When generating code for the layout builder:

1. **Never use external canvas libraries** — CSS Grid + standard DOM only
2. **Never store empty cells** — only populated elements go into the JSON array
3. **Always auto-derive `totalSeats`** — never let the user manually set it when a layout exists
4. **Never allow duplicate `seatNo`** — validate on rename and on save
5. **Always use `Map<string, LayoutElement>`** for in-memory state — not arrays
6. **Always serialize Maps to arrays before API calls** — `Array.from(map.values())`
7. **Always check `isBusLocked()`** on component init — switch to read-only if locked
8. **Always use i18n keys** — no hardcoded French strings in templates
9. **Always use Metronic card/toolbar patterns** — match existing bus detail component style
10. **Always use `var(--bs-*)` CSS variables** — ensure dark mode compatibility
11. **Never add undo/redo, drag-to-select, or virtualization** — this is MVP scope
12. **Always use `takeUntil(destroy$)` pattern** — match existing component lifecycle management
