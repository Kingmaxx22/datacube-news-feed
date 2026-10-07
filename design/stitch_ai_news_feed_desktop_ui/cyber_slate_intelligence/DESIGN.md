---
name: Cyber Slate Intelligence
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d1f27'
  surface-container-high: '#272a32'
  surface-container-highest: '#32353d'
  on-surface: '#e1e2ec'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2d3038'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e0fdff'
  on-primary: '#00373a'
  primary-container: '#00f2fe'
  on-primary-container: '#006a70'
  inverse-primary: '#00696f'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#f1f8ff'
  on-tertiary: '#00354a'
  tertiary-container: '#b2e1ff'
  on-tertiary-container: '#00678c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353d'
  slate-surface: '#111622'
  slate-elevated: '#182030'
  slate-border: '#222D42'
  status-impact-high: '#EF4444'
  status-impact-medium: '#F59E0B'
  status-impact-low: '#10B981'
  badge-llm: '#00F2FE'
  badge-tech: '#38BDF8'
  badge-investment: '#10B981'
  badge-tips: '#F59E0B'
  badge-videos: '#EC4899'
  badge-trends: '#8B5CF6'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system establishes a high-performance, developer-first intelligence feed tailored for engineers, data scientists, and technical founders monitoring global AI movements. The aesthetic merges precision engineering with a sleek cyber-slate dark foundation. It pairs deep slate-obsidian backdrops with radiant, laser-precise accents of electric cyan, deep hyper-violet, and high-visibility status indicators.

Drawing inspiration from high-density terminal hubs and advanced developer platforms, the interface favors structured visual density, sharp legibility, and technical nuance over decorative fluff. Subtly illuminated border treatments and restrained neon halos highlight real-time data flows, telemetry-inspired impact meters, and code-native tokens. The overall tone is authoritative, analytical, and meticulously calibrated for continuous cognitive focus.

## Colors

The color palette centers on a rich, pitch-black slate base (`#0A0D14`), eliminating harsh contrast while providing immense depth for glowing chromatic telemetry. 

- **Primary (`#00F2FE`)**: An electric cyber cyan engineered for active endpoints, live connection states, and primary navigational triggers. It acts as the core heartbeat of the intelligence feed.
- **Secondary (`#8B5CF6`)**: A vivid hyper-violet used for secondary interactions, analytical trends, and structural gradients.
- **Tertiary (`#38BDF8`)**: A technical sky-blue bridging the gap between primary cyan and secondary violet, deployed across metadata and developer handles.
- **Neutral (`#0A0D14`)**: A calibrated dark slate tint with cold blue undertones that anchors the interface and prevents visual fatigue.
- **Named Accents**: 
  - `slate-surface` and `slate-elevated` define background tonal strata.
  - Three impact tiers (`status-impact-high`, `status-impact-medium`, `status-impact-low`) communicate data urgency across signal cards.
  - Dedicated semantic tokens govern category filters (LLM, Tech, Investment, Tips, Videos, Trends) to maintain rapid scanability.

## Typography

Typography establishes an analytical hierarchy through the pairing of **Geist** for human-readable content and **JetBrains Mono** for developer metadata and technical markers.

- **Geist** handles structural titles and content digests. Its razor-sharp geometric neutrality delivers exceptional clarity in high-density multi-column feeds without adding typographic noise.
- **JetBrains Mono** is reserved strictly for operational parameters: period selectors (`YYYY-kwWW`, `YYYY-MM-DD`), HTTP REST markers (`GET /api/trends`), millisecond latency timestamps, locale codes (`[EN]`, `[ZH]`), and source domain badges.
- Tabular figures must be enabled by default for all numerical listings to prevent layout shifts during real-time data ingestion.

## Layout & Spacing

The layout is built around a compact, fluid 12-column grid engine optimized for high-density information monitoring.

- **Desktop (1280px+)**: A 12-column fluid grid with `2rem` margins and `1.25rem` gutters. The page layout features a persistent left operational rail (280px fixed: period selector, language switch, category filter matrix) paired with a responsive 3-column feed card stream.
- **Tablet (768px – 1279px)**: Collapses to an 8-column layout. The operational rail condenses into a horizontal top bar; the news feed adapts into a balanced 2-column card arrangement.
- **Mobile (< 768px)**: Adapts to a single-column stack with `1rem` margins and `0.75rem` gutters. Sticky horizontal carousels handle category chips and locale switchers.

Inner component padding relies strictly on the `space-*` scale: micro-badges use `space-xs` and `space-sm`, news card containers use `space-md` internally, and larger modal views use `space-lg`.

## Elevation & Depth

Visual hierarchy is constructed through cold slate tonal layering and precision-etched borders, avoiding heavy dropped shadows.

- **Surface Stratification**:
  - **Canvas Base**: `#0A0D14` (Deepest backdrop)
  - **Surface Container**: `#111622` (Card panels and navigation matrices)
  - **Elevated Interactive**: `#182030` (Hovered cards, flyouts, and active selectors)
- **Edge Definition**: Surfaces rely on hairline 1px borders using `#222D42`. Interactive states ramp the border up to `rgba(0, 242, 254, 0.45)`.
- **Glow Accents**: Active real-time nodes and high-impact indicators use localized neon glows (`box-shadow: 0 0 16px -2px rgba(0, 242, 254, 0.25)` and `box-shadow: 0 0 16px -2px rgba(139, 92, 246, 0.25)`).
- **Backdrop Blurs**: Elevated floating headers, sticky controls, and popover menus utilize translucent backdrops (`rgba(17, 22, 34, 0.85)` with `backdrop-filter: blur(12px)`).

## Shapes

The design system adopts a technical, low-radius architectural form factor (Level 1 / Soft).

- **Core Elements**: Standard inputs, buttons, filter chips, and card shells utilize a compact `0.25rem` (4px) corner radius. This evokes physical modular hardware blades and IDE panels.
- **Grouping Shells & Panels**: Complex card clusters and flyout drawers use `0.5rem` (8px, `rounded-lg`).
- **Pill Exceptions**: Reserved exclusively for dynamic status markers (e.g., real-time pulsing `LIVE` dots, high-impact severity tags, and HTTP method indicators) where visual containment signals non-clickable status.

## Components

### Buttons
- **Primary Cyber**: Solid cyan background (`#00F2FE`) with pitch-slate typography (`#0A0D14`), uppercase monospace weight 600, sharp 4px radius. Hover triggers an outer cyan glow (`0 0 12px rgba(0, 242, 254, 0.5)`).
- **Secondary Ghost**: Background `rgba(24, 32, 48, 0.6)` with hairline border (`#222D42`), white typography, transitioning to a purple border (`#8B5CF6`) and light purple tint on hover.
- **Icon / Utility**: 32x32px square buttons with a 4px radius, displaying monochrome SVG icons tinted with muted blue-gray (`#94A3B8`).

### Feed Cards (News Signal Node)
- **Container**: Slate-surface background (`#111622`), 1px outline (`#222D42`), 8px radius.
- **Header Row**: Left-aligned source badge (TechCrunch, MIT Tech Review, Hacker News, Reddit) set in muted monospace text next to a relative timestamp; right-aligned impact meter.
- **Impact Meter**: Compact pill badge indicating priority:
  - *High*: `rgba(239, 68, 68, 0.15)` bg with `#EF4444` border and pulsing crimson dot.
  - *Medium*: `rgba(245, 158, 11, 0.15)` bg with `#F59E0B` text.
  - *Low*: `rgba(16, 185, 129, 0.15)` bg with `#10B981` text.
- **Body**: Geist semi-bold title (H3) with a two-line synopsis in muted gray (`#94A3B8`).
- **Footer**: Monospace category badge plus external link affordance.

### Category Chips & Badges
- Compact tags styled with low-opacity fills and matching borders corresponding to their named accent:
  - `LLM` (Cyan), `Tech` (Sky), `Investment` (Emerald), `Tips` (Amber), `Videos` (Pink), `Trends` (Purple).
  - Selected state fills the tag with a 20% tint, brightens the border to 100%, and displays high-contrast text.

### Multilingual Switcher (8 Locales)
- Monospace segmented grid displaying `EN`, `DE`, `ZH`, `FR`, `ES`, `PT`, `JA`, and `KO`.
- Inactive items render as muted slate outlines. The active locale snaps into a highlighted cyan frame with subtle back-glow.

### Period Selector
- Dual-segmented control toggling between Daily (`YYYY-MM-DD`) and Weekly (`YYYY-kwWW`).
- Features inline monospace input fields paired with calendar flyout triggers styled like an instrumentation dashboard.

### Form Inputs & Filters
- Inset slate boxes (`#0A0D14`) framed with `#222D42` borders. Focused inputs activate an electric cyan outline (`#00F2FE`) alongside an ambient outer blur without layout shift.