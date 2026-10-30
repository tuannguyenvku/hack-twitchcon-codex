# TwitchHive Design System

> Niche: interactive stream arena | Target: streamers, viewers and hackathon judges | Date: 2026-10-30

Approved source: HACKATHON_BRIEF.md. Its explicit approval replaces research GO for this task. Adapt design-init's nine-section convention to a desktop OBS/web product; mobile Capacitor restrictions do not apply.

Resolved I-Lang brief: `type=web_app | palette=slate_dark | accent=amber | typography=inter | display=same_as_body | layout=arena_and_command_deck | mood=playful | density=balanced | exclude=extension_install,payment_pressure,unlabeled_simulation,flashing | target_user=streamers_and_viewers | core_pain=passive_audience_without_visible_agency`.
Dark surfaces preserve focus on the stream; amber identifies shared energy; compact controls serve a busy streamer while the arena gets generous space.

## 1. Visual Theme & Atmosphere

A live swarm should feel like a coordinated team with individual personalities. Use a dark command deck and a transparent arena suitable for compositing over gameplay. Viewers should recognize their agent and see exactly how the community changes a round. Keep control surfaces calm while effects bring motion to the broadcast.

**Key characteristics:** personal agent silhouettes; visible collective intent; crisp numeric status; clearly labeled Demo/Live and Model/Rules states.

## 2. Color Palette & Roles

| Role | Hex | Usage |
|---|---|---|
| Background | #0F172A | Dashboard |
| Surface | #1E293B | Panels and tooltips |
| Text primary | #F8FAFC | Labels and headings |
| Text secondary | #CBD5E1 | Supporting text |
| Accent | #FBBF24 | Primary action, energy |
| Accent hover | #FCD34D | Hover |
| Success | #86EFAC | Connected, heal |
| Neutral | #64748B | Dividers, inactive outlines |
| Chaos | #C4B5FD | Chaos, shield |
| Danger | #FDA4AF | Destructive action, attack |
| On accent | #0F172A | Text on colored buttons |

Overlay background is transparent; HUD uses surface at 90% opacity. Never communicate action roles, connection failures or consensus solely by color; pair text/icons/shapes. No full-screen white flashes or saturated red washes. Verify WCAG AA text contrast in implementation; neutral is not a body-text color.

## 3. Typography Rules

| Role | Font | Size | Weight | Line Height | Notes |
|---|---|---|---|---|---|
| Display | Inter | clamp(28px, 3vw, 40px) | 700 | 1.15 | Round title |
| Heading | Inter | 24px | 600 | 1.25 | Panel title |
| Body | Inter | 16px | 400 | 1.5 | Controls |
| Caption | Inter | 14px | 400 | 1.5 | Metadata |
| Mono | monospace | 14px | 400 | 1.5 | Timing, counts |

Bundle Inter locally with system sans-serif fallback; no runtime font network dependency. Overlay HUD minimum 24px at 1920×1080, title 40px. Name labels 20px only for selected/top agents; do not cram 500 names onscreen. Truncate long names visually, preserve full name in dashboard accessible detail.

## 4. Component Stylings

Primary buttons use amber background, on-accent text, 8px radius, 12px 20px padding, 600 weight. Secondary buttons use surface and primary text. All controls have 48px minimum tap height and visible 3px amber focus ring with offset. Destructive reset opens a dialog naming the session impact and defaults focus to Cancel.

Panels use surface, 12px radius and 24px padding; avoid nested panels. Inputs use background, neutral border, 8px radius and explicit labels. Icons are 20–24px, consistent outline strokes; agent roles use distinct attack triangle/shield hexagon/heal cross silhouettes.

Feedback: joining produces a brief amber pulse and named activity entry; empty arena shows `Type !join in chat` plus Demo start action on dashboard. Pending connections show labeled progress, never fake connected status. Failures show adapter-specific retry guidance. Leaderboard shows top five by accepted contribution, ties resolved by stable viewer ID; no paid rankings. Stale overlay freezes with `Reconnecting` badge until snapshot arrives.

## 5. Layout & Spacing

Dashboard max-width 1440px with 24px outer padding. At >=1024px use 240px navigation/connection column, flexible preview, 320px control/event column. Place mode badge, pause and round timer above the fold at 1366×768. Use 4/8/16/24/40px spacing tokens for icons, components, related groups, sections and page separation.

Overlay uses a 1920×1080 logical canvas, 48px safe margins: top round/consensus HUD, central swarm and boss, bottom-left event caption, right top-five leaderboard. Preserve central gameplay visibility with sparse composition and transparent unused space. Canvas and HUD share one logical coordinate system; account for devicePixelRatio and OBS scaling.

## 6. Depth & Elevation

Use surface contrast and subtle `0 4px 12px rgba(0,0,0,0.2)` shadow for floating controls. Overlay text may use dark outlines for broadcast legibility. Z-index: arena 0, HUD 10, sticky controls 100, modal 1000. Modal backdrop uses background at 80% opacity. Particle effects stay below text and never intercept inputs.

## 7. Do's and Don'ts

- Show individual ownership and round contribution before aggregate counts.
- Keep Demo/Live labels persistent on both routes; announce model fallback plainly.
- Keep all dashboard actions keyboard operable, with semantic labels, focus restoration and polite live-region announcements for round outcomes. Canvas has a DOM summary of round, consensus and leaderboard.
- Do not show simulated events as real donations or claim measured revenue/retention gains.
- Do not require Extension installation, payment or credentials to start Demo.
- Never render user/model text as HTML or expose tokens in screenshots/overlay links.
- Avoid strobes: no >3 flashes/second; honor reduced-motion by removing particles and camera shake, keeping state changes visible.

## 8. Responsive Behavior

Dashboard at 768–1023px uses two columns; below 768px stacks connection, controls, preview, simulator and metrics, with no horizontal document scroll at 360px. Preserve access to Pause and mode label. Overlay scales at fixed 16:9 with letterboxing for other aspect ratios, not a mobile dashboard layout. Canvas interpolation targets 60fps; cap particles and name labels, reduce decorative work before omitting agent identities. Performance targets and benchmark are in SPEC.md.

## 9. Agent Prompt Guide

Read this contract before any UI change. Use the palette, type and spacing above; prioritize a legible broadcast over decoration. Keep controls concise: `Start Demo`, `Connect Twitch`, `Pause arena`, `Copy OBS URL`. Distinguish loading, empty, error, paused and reconnecting states. State transitions use 150ms easing; arena effects last 300–800ms and obey reduced motion. Use semantic DOM controls alongside Canvas. Check responsive keyboard flows and OBS transparency before claiming completion.

**Six key screens/states** (two routes, not six invented pages):
1. `/dashboard` welcome/disconnected: start Demo immediately or configure Twitch.
2. `/dashboard` Live command deck: adapter health, round controls and preview.
3. `/dashboard` simulator: join/action/vote input and Sub/Raid/Cheer triggers, seeded replay.
4. `/dashboard` rules/challenge editor: bounded difficulty and explicit apply feedback.
5. `/dashboard` engagement/recovery: participation counters, fallback and reconnect guidance.
6. `/overlay` arena: agents, consensus, boss/chaos, buffs and leaderboard; empty/paused/stale variants.
