# Home Winemaking Domain Research — Process Plan Generation

> Research context: S-03 process plan auto-generation needs domain-accurate step definitions for home craft winemaking. This document captures verified best practices, timelines, and rules for the target persona (hobbyist home winemaker, small scale, personal use).

## Sources

| Source | Coverage |
|--------|----------|
| MoreWineMaking (Shea Comfort) — morewinemaking.com | Sulfiting, fermentation, maceration, pressing, racking, aging, fining, bottling |
| WineMakers Academy — winemakersacademy.com | Degassing, stabilization, chaptalization |
| WineMaker Magazine — winemakermag.com | High-Brix fermentation, yeast selection, stuck ferments |
| AWRI (Australian Wine Research Institute) | Yeast rehydration, high-Brix handling |
| Pigeau et al. 2007 (J. Applied Microbiology) | Osmotic stress thresholds (Icewine study) |
| Betlej et al. 2020 (Genes, PMID 32443892) | Yeast stress at 30°Brix |

---

## 1. Fermentation Timeline (Home Winemaking)

### Primary Fermentation

| Phase | Duration | Notes |
|-------|----------|-------|
| Yeast lag (becoming active) | 1–3 days after pitching | Visible bubbling starts |
| Active primary | 7–14 days total | Temperature-dependent (warm = faster) |
| End point (dry wine) | SG at –1.5° to –2.0° Brix (hydrometer) | Or 0°Blg on refractometer |

> *"Your fermentation should become active anywhere from 1–3 days after introducing your yeast. In about two weeks most of the sugar will have been consumed."* — MoreWineMaking

### Secondary Fermentation & Racking

| Event | Timing | Trigger |
|-------|--------|---------|
| Rack to secondary (juice wines) | Day 10–14 | Vigorous bubbling subsides, SG drops below ~1.010 |
| Press (pulp wines) | Day 7–14 | SG at 0°Brix (standard) or 3–5°Brix (early press for softer wine) |
| First racking off gross lees | 1–2 days post-press (pulp) or Day 14 (juice) | Heavy sediment drops out |
| Confirm fermentation complete | Day 21–28 | Two identical SG/Blg readings 2–3 days apart |

> *"A large amount of sediment will settle out of the wine in the first day or so after pressing. Transfer the wine off the gross lees between 1 to 2 days after pressing."* — MoreWineMaking

### Racking Schedule

| Racking # | Timing | Purpose |
|-----------|--------|---------|
| 1st | After primary (Day 14 juice / Day 10–14 post-press pulp) | Remove gross lees |
| 2nd | 2–6 weeks later (Day 35–50) | Remove fine lees |
| Subsequent | Every 2–4 months during bulk aging | Clarification, check wine condition |

> *"Rack every 2–4 months during aging to continue clarification."* — MoreWineMaking

### Bulk Aging to Bottling

| Wine Style | Minimum Aging | Typical |
|------------|---------------|---------|
| Simple fruit wine (no MLF) | 3–6 months | 6 months |
| Grape juice wine (no skins, no MLF) | 4–6 months | 6–9 months |
| Light red (everyday drinking) | 6–9 months | 12 months |
| Complex/tannic red | 12 months | 18–36 months |

> *"A straightforward, fruity wine without oak will usually have a rounding of the flavors around 6 months post fermentation. A more complex wine with oak usually takes around 9–12 months."* — MoreWineMaking

---

## 2. Sugar Additions & Osmotic Stress

### Maximum Starting Sugar — Verified Threshold

**The safe upper limit is ~25°Brix/Blg (not 21°Blg).** The 21°Blg figure is a typical starting gravity for light table wine (~12% ABV potential), not a safety maximum.

| Starting Gravity | Potential ABV | Osmotic Risk | Recommended Action |
|------------------|---------------|--------------|-------------------|
| 18–22°Blg | 10–12.5% | None | No precautions needed |
| 22–25°Blg | 12.5–14.5% | Minimal | Normal range, standard yeast works |
| 25–28°Blg | 14.5–16.5% | Moderate | Use high-tolerance yeast (EC-1118 etc.) |
| 28–30°Blg | 16.5–17.5% | Significant | Stagger sugar additions, robust yeast mandatory |
| >30°Blg | >17.5% | Severe | Extreme staggering, high-tolerance yeast only |

> *"The ideal range for most red wine musts is 22° to 25° Brix."* — MoreWineMaking
> *"Musts with a starting Brix above 25° create a high-alcohol environment that can become toxic to weaker yeast strains."* — MoreWineMaking, "Stuck Fermentation"

### Scientific Evidence

- **Pigeau et al. 2007**: Icewine at 40–46°Brix — yeast shift to glycerol/acetic acid production under osmotic pressure. 10% v/v ethanol unachievable above 42°Brix.
- **Betlej et al. 2020**: Used 30% sugar (≈30°Brix) as the "high osmotic stress" experimental condition vs 18% (≈18°Brix) control.
- Conclusion: True osmotic stress begins at **~30°Brix**; practical problems (stuck ferments) start at **25–28°Brix** depending on yeast strain and nutrition.

### Staggered Sugar Addition Protocol

When total starting Blg (including added sugar) would exceed 25°Blg:

1. Start at ≤24–25°Blg
2. Wait for ⅓ sugar depletion (8–10°Blg drop)
3. Add next sugar portion (raise back toward 20–22°Blg)
4. Repeat if needed for very high-ABV targets

> The ⅓-depletion model comes from MoreWineMaking's Fermaid-K nutrient schedule: *"First addition at cap formation, second at ⅓ sugar depletion."* — same principle applies to sugar additions.

### Practical Conversion (for a 20–25L batch)

- 1°Brix ≈ 17 g/L sugar
- Raising a 20L batch by 1°Blg requires ~340g sucrose
- Typical fruit wine starting at 8°Blg → target 24°Blg = 16°Blg gap = ~5.4 kg total sugar → **must stagger**
- Grape juice at 20°Blg → adding 3°Blg more = ~1.0 kg → single addition fine

### Origin of 21°Blg Claim (Hypothesis)

Likely from Polish/Central European fruit wine tradition where 21°Blg is a **typical starting target** for light table wines (12% ABV), not a **safety maximum**. May also reflect a starting-point convention for staggered protocols: "start at no more than 21°Blg, add rest later" — where 21°Blg is the first portion, not the max tolerance.

---

## 3. Pulp/Maceration Process (Skin-Contact Wines)

### Maceration Duration

| Style | Skin Contact Time |
|-------|-------------------|
| Rosé/light red (short) | 3–5 days |
| Standard red (ferment on skins until dry) | 7–14 days |
| Extended maceration (structure-forward) | 14–30+ days (advanced technique) |

> *"For most red wines, press when the primary fermentation is complete (0°Brix)."* — MoreWineMaking
> *"Pressing early (3–5°Brix) creates a softer, fruitier wine with fewer tannins."* — same source

### Cap Management

| Fermentation Stage | Punch-Downs per Day |
|--------------------|---------------------|
| Peak active fermentation | 2–4 times/day (ideally 3–4) |
| Slowing/late fermentation | 1–2 times/day |

> *"During the peak of active fermentation, punch down the cap at least twice a day, ideally three to four times a day."* — MoreWineMaking

**Duration**: Cap management begins once the cap forms (~1–2 days after pitching, when fermentation generates enough CO₂ to lift skins) and continues **every day** until pressing (Day 1–2 through Day 7–14).

**Technique notes**:
- Push skins fully into liquid AND stir lees from bottom
- "Looking for the must to become pink and creamy"
- Do NOT grind/mash seeds (harsh tannins)
- Never let the cap dry out on top (risk of acetobacter/vinegar)

### Pressing

| Trigger | Style |
|---------|-------|
| 0°Brix (fermentation complete) | Standard — maximum extraction |
| 3–5°Brix (fermentation still active) | Early press — softer, fruitier |
| 0°Brix + N days (extended maceration) | Advanced — more structure, riskier |

> *"Press in a timely fashion because prolonged exposure to grape solids post-fermentation might generate off-flavors."* — MoreWineMaking

---

## 4. Sulfite (SO₂) — The Home Winemaker Debate

### Standard Practice (by the book)

- Add 50 ppm SO₂ at crush (Day 0) to suppress wild yeast/bacteria
- Wait 12–24 hours before pitching cultured yeast
- First sulfite addition becomes entirely "bound-up" by end of fermentation (doesn't persist)
- Re-establish protective SO₂ after fermentation/MLF

### Home Winemaker Context

Some home winemakers **skip sulfite**, particularly:
- In traditional/natural winemaking approaches (Central European, Polish tradition)
- When using cultured yeast (reduced risk from wild microorganisms compared to wild/spontaneous fermentation)
- When batch size is small and wine is consumed within 1–2 years

**Note**: All major winemaking authorities (MoreWineMaking, WineMaker Magazine, WineMakers Academy) recommend sulfite as standard practice. Skipping sulfite is a conscious trade-off — the user takes on higher oxidation and microbial risk in exchange for a simpler, more traditional process.

**Consequences of skipping sulfite**:
- No waiting period before pitching yeast (can pitch immediately on Day 0)
- Higher risk of oxidation during racking and aging (no SO₂ protection)
- Degassing becomes riskier (oxygen exposure without protective SO₂)
- Shorter aging potential (wine is less protected long-term)
- Natural off-gassing during aging replaces active degassing

---

## 5. Stabilization for Non-Dry Wines

### K-meta + K-sorbate Protocol

| Chemical | Purpose | Dose |
|----------|---------|------|
| Potassium metabisulfite (K-meta) | Antimicrobial + antioxidant | 0.3 g/L (~50 ppm) |
| Potassium sorbate (K-sorbate) | Inhibits yeast reproduction | 0.5–0.75 g/L (125–200 ppm) |

### Critical Rules

1. **Wine must be DRY first** — K-sorbate does NOT stop active fermentation, only prevents re-fermentation
2. **K-sorbate + K-meta must be added together** — K-sorbate is ineffective without adequate free SO₂
3. **Never use K-sorbate after MLF** — bacteria metabolize it into geraniol (permanent "rotting geraniums" off-flavor)
4. K-sorbate only inhibits yeast reproduction — does not kill active cells

### Timing Relative to Back-Sweetening

1. Ferment to dryness (0°Blg / 0°Brix)
2. Add K-meta + K-sorbate together, stir thoroughly
3. **Wait at least 2–5 days** (chemicals need time to distribute and act)
4. Back-sweeten to desired residual sugar level

> *"Potassium sorbate is used to stabilize a wine that contains residual sugar. Add at 0.5 to 0.75 grams per gallon in conjunction with 0.3 grams of meta-bisulfite per gallon."* — MoreWineMaking

### Why Stabilize and Back-Sweeten Are Separate Steps

- Stabilizing agents need time to distribute uniformly through the wine
- Adding sugar immediately after chemicals risks incomplete stabilization → refermentation in bottle
- The 2–5 day gap is a **process safety margin**, not a convenience choice
- Experienced winemakers may shorten to 48 hours; beginners should wait longer

---

## 6. Degassing

### What It Is

Removing dissolved CO₂ that remains trapped in wine after fermentation. Wine saturated with CO₂ appears hazy, prevents fining agents from working, and can cause unexpected fizzing after bottling.

### When and How

| Parameter | Guidance |
|-----------|----------|
| When | After fermentation complete, before fining/bottling |
| Temperature | Must be >70°F (24°C) — CO₂ won't release from cold wine |
| Method | Drill whip agitation, or vacuum degassing (preferred) |
| How many times | Once (agitation) or multiple (vacuum) |

> *"I recommend degassing a wine only once. There's really no reason to degas in the middle of fermentation."* — WineMakers Academy

### Risk Without Sulfite Protection

**For winemakers who skip SO₂**: active degassing introduces oxygen exposure. Without SO₂ to scavenge free oxygen, this increases risk of:
- Acetaldehyde formation (oxidation off-flavor)
- Acetobacter growth (vinegar bacteria thrive with oxygen)

**Mitigation**: Rely on natural off-gassing during prolonged bulk aging (6–12 months). CO₂ gradually escapes through airlock or micro-oxygenation through vessel walls. This is slower but avoids the oxidation risk.

---

## 7. Clarity & Fining

### Common Fining Agents in Home Winemaking

| Agent | Purpose | When |
|-------|---------|------|
| Bentonite | Protein haze, heat stability | Pre- or post-fermentation |
| Pectic enzyme (pectinase) | Pectin haze — critical for fruit wines | Pre-fermentation (works poorly with active yeast) or post-fermentation for correction |
| SuperKleer / Sparkolloid / Isinglass | General clarity | Post-fermentation |
| Gelatin | Tannin reduction + clarity | Post-fermentation (reds) |

### Pectic Enzyme — Timing Nuance

- **Textbook**: Add before fermentation for best juice extraction and pectin breakdown
- **Home winemaker practice**: Often used **after fermentation** as a corrective measure for persistent haze
- **Works poorly** in active fermentation (alcohol denatures the enzyme partially)
- **Most critical for fruit wines** — grape wines rarely have pectin haze issues

> *"Choose fining if your primary goal is to adjust mouthfeel. Choose filtration if your goal is guaranteed clarity."* — MoreWineMaking

### Second Racking for Clarity

The "second racking" (Day 35–50, after fine lees settle) is commonly **skipped by beginners** but important for:
- Removing fine sediment that won't compact further
- Preventing reductive off-flavors from prolonged lees contact
- Providing an opportunity to assess wine condition

---

## 8. Fruit Wine vs. Grape Wine — Same Template?

### Verdict: YES — same structural process, minor practical differences

| Factor | Grape Wine | Fruit Wine |
|--------|-----------|------------|
| Starting sugar | 22–25°Blg naturally | Often 5–14°Blg → large sugar additions needed |
| Sugar additions | Occasional chaptalization | Almost always substantial; staggering common |
| Maceration | Optional (juice vs pulp process) | Usually juice; some fruits (elderberry, blackcurrant) can macerate |
| Pectin haze | Rare | Very common — pectic enzyme nearly mandatory |
| MLF | Standard for reds | Not recommended for most fruit wines |
| Tannin | Present in grape skins | Low/absent — may need tannin powder |
| Aging time | 6–18+ months | 3–6 months for simple fruit wines |
| Degassing urgency | Less critical (longer aging) | More critical (shorter aging, closed fermenter) |

### Implication for Generation Logic

No separate `wine_type` parameter needed. Differences are handled by:
- The sugar condition (fruit wines almost always have `fermentation_sugar_kg > 0`)
- The process_type (most fruit wines are `juice`)
- The user editing dates (shorter aging for fruit wines)
- User adding manual entries (pectic enzyme, tannin additions) as needed

---

## 9. Domain Rules for Step Generation

**Guiding principle**: The generated plan includes only steps that are **universally performed** in home winemaking regardless of specific recipe. The tool helps the user work faster with what they already know — it doesn't prescribe how to make wine. Optional/recipe-specific steps (sulfite, pectic enzyme, fining, MLF, etc.) are the user's responsibility to add manually.

Based on all research above, these are the verified domain rules:

### Always-true rules

1. **Yeast can be pitched on Day 0** — safe common default; users who sulfite or use pectic enzyme adjust the date per their recipe
2. **Primary fermentation takes 7–14 days** — monitoring at Day 5 is reasonable
3. **Fermentation is confirmed complete** by two identical readings 2–3 days apart (Day 28 is conservative but safe)
4. **Racking off lees** should happen 1 week after confirmed dry (Day 35)
5. **Bulk aging** starts after the first clean racking
6. **Aging checks** every ~2–4 months during bulk aging are best practice
7. **Bottling** at 1 year is a conservative safe default; simple/fruit wines may be ready sooner — user adjusts

### Conditional rules

1. **Sugar addition step** appears only when calculation shows `fermentation_sugar_kg > 0`
2. **Cap management** applies only to pulp/maceration process (starts Day 1 when cap forms, continues daily until pressing)
3. **Pressing** applies only to pulp process (Day 7–14, standard at Day 10)
4. **Stabilization + back-sweetening** apply only when `planned_sweetness ≠ 'dry'`; separated by 2-day gap (stabilizers need 24–48h to distribute)
5. **Staggered sugar hint** applies when starting Blg would exceed 25° (guidance in description)

### Non-prescriptive principles

1. Steps remind **when** to do something, not **how** to measure or what tool to use
2. No sulfite is prescribed — per-recipe decision; user adds as manual entry if needed
3. No pectic enzyme prescribed — per-recipe decision; user adds at their preferred timing
4. No specific fining agent is prescribed — user adds if needed
5. No specific degassing method — natural off-gassing during 12-month aging is sufficient
6. The plan is a **starting scaffold** — user always has full control to edit, add, delete

---

## 10. Day Offset Summary (Verified)

| Day | Event | Basis |
|-----|-------|-------|
| 0 | Prepare must, add sugar (if needed), pitch yeast | Same-day for must preparation and yeast; user adjusts if using sulfite or pectic enzyme |
| 1 | Begin cap management (pulp only) | Cap forms ~1–2 days after pitching once fermentation generates CO₂ |
| 5 | Monitor primary fermentation | Mid-primary check (fermentation active 7–14 days) |
| 10 | Press (pulp only) | Standard maceration 7–14 days; Day 10 = conservative midpoint |
| 14 | Rack to secondary | End of primary for most wines |
| 21 | Monitor secondary | 1 week after racking — check progress |
| 28 | Confirm fermentation complete | Two identical readings confirms dry |
| 35 | Rack off lees | 1 week settling after confirmed dry |
| 60 | Begin bulk aging | 1 month after final racking; wine has cleared |
| 120 | Aging check #1 | 2 months into aging — taste, clarity check |
| 240 | Aging check #2 | 6 months into aging — assess readiness |
| 330 | Stabilize (non-dry only) | ~1 month before bottling; gives time for sweetening |
| 332 | Back-sweeten (non-dry only) | 2 days after stabilization — per standard 24–48h guidance |
| 365 | Bottling | 1 year from start — conservative safe default for home wine |
