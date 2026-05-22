---
name: pine-script-builder
description: Build TradingView Pine Script indicators and strategies. Use this skill whenever the user asks to create, build, write, or code a TradingView indicator, strategy, script, or Pine Script file — even if they just describe a trading concept or say "make me an indicator for X". Handles everything from simple overlays to multi-timeframe SMC strategies with dashboards.
---

# Pine Script Builder Skill

Build production-quality Pine Script v5/v6 indicators and strategies for TradingView, following the conventions, patterns, and templates from this repository.

## Repo Reference Map

Before writing any code, know where to look:

| Need | File |
|---|---|
| Blank indicator scaffold | `examples/templates/indicator-template.pine` |
| Blank strategy scaffold | `examples/templates/strategy-template.pine` |
| Reusable library scaffold | `examples/templates/library-template.pine` |
| Color gradients / themes | `examples/snippets/plotting/color-themes-and-gradients.pine` |
| Table / dashboard panel | `examples/snippets/plotting/table-dashboard-snippet.pine` |
| Alert conditions | `examples/snippets/alerts/basic-alert-condition.pine` |
| Webhook JSON alerts | `examples/snippets/alerts/webhook-alert-template.pine` |
| Session + date filtering | `examples/snippets/utilities/date-time-filters.pine` |
| Higher-timeframe data | `examples/snippets/utilities/higher-timeframe-request.pine` |
| Daily loss limit | `examples/snippets/risk-management/daily-loss-limit-example.pine` |
| ATR position sizing | `examples/snippets/risk-management/fixed-fraction-position-sizing.pine` |
| MA crossover logic | `indicators/ma-crossover-indicator.pine` |
| RSI oscillator | `indicators/rsi-basic-indicator.pine` |
| Volatility bands | `indicators/volatility-band-indicator.pine` |
| Session H/L tracking | `indicators/session-high-low-indicator.pine` |
| S/R zones with arrays | `indicators/support-resistance-zones.pine` |
| Pivot + market structure | `indicators/market-structure-tool.pine` |
| Liquidity sweeps | `indicators/liquidity-sweep-detector.pine` |
| SMC order blocks + FVG | `indicators/smart-money-concepts.pine` |
| Multi-TF trend table | `indicators/mtf-trend-dashboard.pine` |
| Volume profile | `indicators/volume-profile-lite.pine` |
| MA crossover strategy | `strategies/ma-crossover-strategy.pine` |
| RSI mean reversion | `strategies/rsi-mean-reversion-strategy.pine` |
| Session breakout | `strategies/session-breakout-strategy.pine` |
| Liquidity sweep reversal | `strategies/liquidity-sweep-reversal-strategy.pine` |
| Full institutional VWAP | `VWAP_Pro_Institutional_Suite.pine` |
| Full ICT/SMC strategy | `ICT_SMC_Strategy.pine` |
| Coding style rules | `docs/pine-style-guide.md` |
| No-repaint techniques | `examples/tutorials/03_no-repaint_tips_and_tricks.md` |
| Backtesting best practices | `examples/tutorials/04_backtesting_best_practices.md` |

## Step 1 — Ask Clarifying Questions

**Always ask these before writing a single line.** Group them into one message, not multiple. Tailor questions to what the user already told you — skip what's already obvious.

### Core questions (always ask if not stated)

1. **Indicator or strategy?**
   - Indicator: overlaid on chart or separate pane, no backtesting
   - Strategy: includes `strategy.entry()` / `strategy.exit()`, shows in Strategy Tester

2. **Overlay or separate pane?**
   - Overlay: draws on the price chart (e.g., MAs, zones, labels)
   - Pane: draws below chart (e.g., RSI, volume, oscillators)

3. **What is the core logic?** Ask the user to describe the signal, concept, or trading idea in plain English. Examples: "I want to detect when price sweeps a previous high then closes back below it", "show VWAP with 3 standard deviation bands".

4. **Timeframe(s)?** Single timeframe, or does it need HTF confluence? (e.g., "use daily bias on 15m entries")

5. **What to display?** (pick all that apply — suggest options if user is unsure)
   - Lines / plots on chart
   - Shapes/arrows at signals
   - Background color on conditions
   - Horizontal lines (levels, zones)
   - Dynamic labels with text
   - Boxes (order blocks, zones)
   - Dashboard table in corner

6. **Alerts?** Yes or no. If yes: simple `alertcondition()` or webhook JSON?

### Strategy-only questions (ask only if strategy)

7. **Entry logic:** What triggers a long/short? Be specific.
8. **Exit logic:** Fixed R:R, ATR multiple, trailing stop, signal flip, or manual?
9. **Position sizing:** Fixed qty, fixed dollar risk %, ATR-based?
10. **Filters:** Session time, day of week, HTF trend, volume, volatility?

### Visual style questions (ask if display is complex)

11. **Color scheme?** Bullish/bearish default (green/red), or a custom palette?
12. **Transparency levels?** Backgrounds usually 85–92%, fills 70–80%, shapes 0%.
13. **Label style?** Minimal (just a triangle marker) or detailed (price + text)?

---

## Step 2 — Plan Before Writing

After getting answers, write a brief plan:
- Which template to start from
- Which snippets to pull in
- What inputs are needed (group them by category)
- What functions need to be defined
- What visual elements will be drawn
- Any anti-repaint considerations

Confirm the plan with the user if the script is complex (SMC, MTF, dashboard-heavy). For simple indicators (RSI, MA, basic oscillator) you can go straight to writing.

---

## Step 3 — Write the Script

### File structure (always follow this order)

```pine
//@version=5
// ═══════════════════════════════════════════════════════════════════
// SCRIPT NAME
// Description: one-line summary
// Author: [user's name or blank]
// ═══════════════════════════════════════════════════════════════════

indicator("Script Name", overlay=true, max_bars_back=500)
// or: strategy("Script Name", overlay=true, initial_capital=10000, commission_type=strategy.commission.percent, commission_value=0.05)

// ─────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// CALCULATIONS
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// CONDITIONS / SIGNALS
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// PLOTTING / DISPLAY
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────
```

### Input conventions

```pine
// Group all inputs — users can collapse groups in the settings panel
lengthInput   = input.int(14, "RSI Length", minval=2, group="RSI Settings")
srcInput      = input.source(close, "Source", group="RSI Settings")
showSignals   = input.bool(true, "Show Signals", group="Display")
bullColor     = input.color(color.new(color.green, 0), "Bull Color", group="Display")
```

- Use `input.group()` for every input — no orphan inputs
- Descriptive tooltip: `tooltip="Explanation of what this does"`
- Reasonable min/max: `minval=1, maxval=500`

### MA helper (reuse this pattern — from `indicators/ma-crossover-indicator.pine`)

```pine
f_ma(src, len, maType) =>
    switch maType
        "SMA" => ta.sma(src, len)
        "EMA" => ta.ema(src, len)
        "RMA" => ta.rma(src, len)
        "WMA" => ta.wma(src, len)
        => ta.ema(src, len)
```

### HTF data (from `examples/snippets/utilities/higher-timeframe-request.pine`)

```pine
// Always use lookahead_off to prevent repainting
htfClose = request.security(syminfo.tickerid, htfTimeframe, close, lookahead=barmerge.lookahead_off)
htfHigh  = request.security(syminfo.tickerid, htfTimeframe, high,  lookahead=barmerge.lookahead_off)
```

### Session detection (from `examples/snippets/utilities/date-time-filters.pine`)

```pine
sessionInput = input.session("0930-1600", "Session", group="Filters")
inSession    = not na(time(timeframe.period, sessionInput))
isNewSession = inSession and not inSession[1]
isSessionEnd = not inSession and inSession[1]
```

---

## Step 4 — Display Techniques

### Lines / Plots
```pine
plot(maFast, "Fast MA", color=color.new(color.blue, 0), linewidth=2)
plot(maSlow, "Slow MA", color=color.new(color.orange, 0), linewidth=2)

// Band fill between two plots
p1 = plot(upper, "Upper", color=na)
p2 = plot(lower, "Lower", color=na)
fill(p1, p2, color=color.new(color.blue, 85))
```

### Shapes at signals (arrows, triangles)
```pine
// plotshape location options: location.belowbar, location.abovebar, location.price
plotshape(bullSignal, "Long", shape.triangleup,   location.belowbar, color.new(color.green, 0), size=size.small)
plotshape(bearSignal, "Short", shape.triangledown, location.abovebar, color.new(color.red, 0),   size=size.small)
```

### Background coloring
```pine
// Keep transparency high (80–92) — don't drown the candles
bgcolor(inBullZone ? color.new(color.green, 90) : na)
bgcolor(inBearZone ? color.new(color.red, 90) : na)
```

### Horizontal lines
```pine
hline(70, "Overbought", color=color.new(color.red, 50), linestyle=hline.style_dashed)
hline(30, "Oversold",   color=color.new(color.green, 50), linestyle=hline.style_dashed)
```

### Dynamic labels (use sparingly — expensive)
```pine
var label lbl = na
label.delete(lbl)  // always delete previous before creating new
lbl := label.new(bar_index, high, text="Signal\n" + str.tostring(close, "#.##"),
     color=color.new(color.blue, 20), textcolor=color.white,
     style=label.style_label_down, size=size.small)
```

### Dynamic lines (S/R levels, zones)
```pine
var line lvlLine = na
line.delete(lvlLine)
lvlLine := line.new(bar_index - lookback, level, bar_index, level,
     color=color.new(color.gray, 40), width=1, style=line.style_dashed,
     extend=line.extend.right)
```

### Boxes (order blocks, zones — from `indicators/smart-money-concepts.pine`)
```pine
var box obBox = na
box.delete(obBox)
obBox := box.new(left=entryBar, top=obHigh, right=bar_index, bottom=obLow,
     bgcolor=color.new(color.blue, 85), border_color=color.new(color.blue, 50),
     border_width=1)
// Extend right edge each bar:
box.set_right(obBox, bar_index)
```

### Dashboard table (from `examples/snippets/plotting/table-dashboard-snippet.pine`)
```pine
var table dash = table.new(position.top_right, columns=2, rows=6,
     bgcolor=color.new(color.black, 85), border_width=1, border_color=color.new(color.gray, 60))

f_cell(col, row, txt, clr) =>
    table.cell(dash, col, row, txt, text_color=clr, text_size=size.small)

if barstate.islast
    f_cell(0, 0, "Metric",  color.gray)
    f_cell(1, 0, "Value",   color.gray)
    f_cell(0, 1, "Trend",   color.white)
    f_cell(1, 1, trendUp ? "▲ Bullish" : "▼ Bearish", trendUp ? color.lime : color.red)
```

### Color gradients (from `examples/snippets/plotting/color-themes-and-gradients.pine`)
```pine
// Momentum-based gradient: green (strong up) → red (strong down)
momentumColor = color.from_gradient(rsiValue, 0, 100, color.red, color.green)
plot(rsiValue, color=momentumColor, linewidth=2)
```

---

## Step 5 — Array Management (for dynamic objects)

When storing multiple levels, boxes, or lines, always cap array size to avoid TradingView object limits.

```pine
// Pattern from indicators/support-resistance-zones.pine
var float[] levels  = array.new_float()
var line[]  lvlLines = array.new_line()

MAX_LEVELS = 50

// Add new level
if newLevel
    array.push(levels,   newValue)
    array.push(lvlLines, line.new(...))

// Trim oldest when over limit
while array.size(levels) > MAX_LEVELS
    line.delete(array.shift(lvlLines))
    array.shift(levels)
```

Object limits per script: 500 lines, 500 boxes, 500 labels. Budget accordingly.

---

## Step 6 — Strategy-Specific Patterns

### Declaration
```pine
strategy("Strategy Name", overlay=true,
     initial_capital=10000,
     default_qty_type=strategy.percent_of_equity,
     default_qty_value=100,
     commission_type=strategy.commission.percent,
     commission_value=0.05,
     slippage=2)
```

### ATR-based position sizing + entries/exits
```pine
// From strategies/ma-crossover-strategy.pine
atr = ta.atr(atrLen)

// Entry
if longSignal
    stopDist = atr * slAtrMult
    qty      = (strategy.equity * riskPct / 100) / stopDist
    strategy.entry("Long", strategy.long, qty=qty)
    strategy.exit("Long Exit", "Long",
         stop  = strategy.position_avg_price - stopDist,
         limit = strategy.position_avg_price + stopDist * tpRR,
         comment="TP/SL")
```

### Daily loss limit (from `examples/snippets/risk-management/daily-loss-limit-example.pine`)
```pine
var float dayStartEquity  = na
var bool  tradingDisabled = false

newDay = ta.change(time("D")) != 0
if newDay
    dayStartEquity  := strategy.equity
    tradingDisabled := false

dailyPnL = strategy.equity - dayStartEquity
if dailyPnL < -(dayStartEquity * maxDailyLossPct / 100)
    tradingDisabled := true
    strategy.cancel_all()

// Gate all entries:
if longSignal and not tradingDisabled
    strategy.entry(...)
```

---

## Step 7 — Anti-Repaint Rules

From `examples/tutorials/03_no-repaint_tips_and_tricks.md`:

1. **Never use `lookahead_on`** with `request.security()` — always `lookahead_off`
2. **Confirm on bar close** — wrap signals in `if barstate.isconfirmed`
3. **Pivots lag by design** — `ta.pivothigh(len)` only resolves `len` bars ago; don't treat it as current
4. **Don't signal on open** — use previous bar's value: `signal = condition[1]`
5. **Test with bar replay** — enable in TradingView to verify no future painting

```pine
// Safe pattern — only acts on confirmed closed bar
longSignal = ta.crossover(maFast, maSlow)
if barstate.isconfirmed and longSignal
    strategy.entry("Long", strategy.long)
```

---

## Step 8 — Alerts

### Simple alerts (from `examples/snippets/alerts/basic-alert-condition.pine`)
```pine
alertcondition(bullSignal, "Bull Signal", "{{ticker}} — Bull signal at {{close}}")
alertcondition(bearSignal, "Bear Signal", "{{ticker}} — Bear signal at {{close}}")
```

### Webhook JSON (from `examples/snippets/alerts/webhook-alert-template.pine`)
```pine
f_buildWebhookMessage(direction, price) =>
    '{"ticker":"' + syminfo.ticker + '",' +
    '"direction":"' + direction + '",' +
    '"price":' + str.tostring(price, "#.##") + ',' +
    '"time":"' + str.format_time(timenow, "yyyy-MM-dd HH:mm") + '"}'

alertcondition(bullSignal, "Bull Webhook", message=f_buildWebhookMessage("long", close))
```

---

## Step 9 — Style Checklist

From `docs/pine-style-guide.md`:

- [ ] `//@version=5` on line 1
- [ ] Explicit `overlay=true/false` in declaration
- [ ] All inputs grouped with `input.group()`
- [ ] No bare magic numbers — name every constant
- [ ] `request.security()` always uses `lookahead=barmerge.lookahead_off`
- [ ] Division guarded: `denominator != 0 ? numerator / denominator : na`
- [ ] Objects cleaned up: `label.delete()`, `line.delete()`, `box.delete()` before recreating
- [ ] Array sizes capped with while-trim loops
- [ ] `barstate.islast` wraps table updates (table only needs update on last bar)
- [ ] Descriptive `plot()` titles (shown in legend and data window)
- [ ] `color.new(color.X, transparency)` — never bare color constants without transparency where fill is needed

---

## Common Patterns Quick-Reference

### Detect new bar vs intrabar update
```pine
barConfirmed = barstate.isconfirmed  // true only when bar fully closed
```

### Price crossed level (not just touched)
```pine
crossed = ta.crossover(close, level) or ta.crossunder(close, level)
```

### Highest/lowest over N bars
```pine
swingHigh = ta.highest(high, lookback)
swingLow  = ta.lowest(low,  lookback)
```

### ATR-based dynamic zones
```pine
atr      = ta.atr(14)
upperZone = close + atr * 1.5
lowerZone = close - atr * 1.5
```

### Show value only on last bar (prevents label flood)
```pine
if barstate.islast
    label.new(bar_index, high, str.tostring(myValue, "#.##"), ...)
```

### Hide a plot conditionally
```pine
// Use na to hide — never plot 0 when you mean "no signal"
plot(showMA ? maValue : na, "MA", color.blue)
```

---

## Output Format

After writing the script, always provide:

1. **The complete `.pine` file** — ready to paste into TradingView Pine Editor
2. **A short setup note** — what inputs to configure first, what the key inputs do
3. **Known limitations** — anything the user should be aware of (e.g., "pivots lag by 5 bars", "only works on intraday", "repaints on open")
4. **Suggested next enhancements** — 2–3 ideas they can ask you to add next

Save the output file to the appropriate folder:
- Indicator → `indicators/`
- Strategy → `strategies/`
- Reusable function → `examples/templates/`
- Snippet → `examples/snippets/<category>/`
