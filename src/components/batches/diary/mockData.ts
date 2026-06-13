export interface MockDiaryEntry {
  id: string;
  description: string;
  entry_date: string; // ISO date string YYYY-MM-DD
  completed: boolean;
  notes: string | null;
  entry_type: "auto" | "user";
}

const BASE_DATE = new Date("2026-05-15");

function offsetDate(days: number): string {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MOCK_DIARY_ENTRIES: MockDiaryEntry[] = [
  {
    id: "1",
    description: "Prepare must — sulfite, acidity correction, nutrients",
    entry_date: offsetDate(0),
    completed: true,
    notes:
      "Added 1 campden tablet per 5L. Acid at 6.5 g/L — added 2g tartaric acid to reach 7 g/L. Added yeast nutrient per packet instructions.",
    entry_type: "auto",
  },
  {
    id: "2",
    description: "Prepare fruit — crush and destem",
    entry_date: offsetDate(0),
    completed: true,
    notes: "Used grape crusher. Removed all stems. Must looks clean, no mold.",
    entry_type: "auto",
  },
  {
    id: "3",
    description: "Add fermentation sugar",
    entry_date: offsetDate(0),
    completed: true,
    notes: "Added 1.2 kg of sugar dissolved in warm water.",
    entry_type: "auto",
  },
  {
    id: "4",
    description: "Pitch yeast",
    entry_date: offsetDate(1),
    completed: true,
    notes: "Rehydrated Lalvin EC-1118 in warm water (35°C) for 15 min before pitching.",
    entry_type: "auto",
  },
  {
    id: "5",
    description: "Cap management — punch down 2–3× daily",
    entry_date: offsetDate(1),
    completed: true,
    notes: null,
    entry_type: "auto",
  },
  {
    id: "6",
    description: "Monitor primary fermentation — measure SG",
    entry_date: offsetDate(3),
    completed: true,
    notes: "SG reading: 1.085. Vigorous bubbling, temp stable at 22°C.",
    entry_type: "auto",
  },
  {
    id: "7",
    description: "Press — separate wine from pomace",
    entry_date: offsetDate(7),
    completed: true,
    notes: "Pressed using basket press. Got about 18L of free-run wine. Colour is deep ruby.",
    entry_type: "auto",
  },
  {
    id: "8",
    description: "Rack to secondary fermenter",
    entry_date: offsetDate(10),
    completed: false,
    notes: null,
    entry_type: "auto",
  },
  {
    id: "9",
    description: "Monitor secondary fermentation — measure SG",
    entry_date: offsetDate(14),
    completed: false,
    notes: null,
    entry_type: "auto",
  },
  {
    id: "10",
    description: "Confirm fermentation complete (2× same SG reading)",
    entry_date: offsetDate(25),
    completed: false,
    notes: null,
    entry_type: "auto",
  },
  {
    id: "11",
    description: "Rack off lees",
    entry_date: offsetDate(30),
    completed: false,
    notes: null,
    entry_type: "auto",
  },
  {
    id: "12",
    description: "Tasted the wine — added personal tasting notes",
    entry_date: offsetDate(35),
    completed: false,
    notes:
      "Slightly harsh tannins, expecting them to mellow during aging. Fruit profile is promising — dark cherry and plum.",
    entry_type: "user",
  },
  {
    id: "13",
    description: "Bulk aging — check sediment",
    entry_date: offsetDate(60),
    completed: false,
    notes: null,
    entry_type: "auto",
  },
  {
    id: "14",
    description: "Bottling",
    entry_date: offsetDate(400),
    completed: false,
    notes: null,
    entry_type: "auto",
  },
];
