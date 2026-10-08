# Tower Defense App

### TL;DR

Build a mobile-first tower defense game for iOS with 20 handcrafted rounds, inspired by classic lane-based tower defense gameplay. Players place and upgrade towers to stop waves of enemies, earn currency, unlock stronger defenses, and progress through increasingly difficult rounds. The first release should prioritize a tight single-player core loop, smooth 3D visuals, and a fast path to a playable vertical slice using Vite, React, ThreeJS, Express, and Socket.IO.

---

## Goals

### Business Goals

* Ship a playable MVP on iOS web/PWA or packaged webview within 4–6 weeks.
* Achieve Day 1 retention of at least 30% among early testers.
* Achieve average session length of 8+ minutes during playtests.
* Validate core combat fun with at least 70% positive tester feedback on gameplay clarity and difficulty.
* Build a reusable game architecture that can support additional maps, towers, enemies, and monetization later.

### User Goals

* Play a polished tower defense experience on iOS with simple controls and clear feedback.
* Strategically place and upgrade towers to survive 20 rounds.
* Understand enemy paths, tower ranges, damage types, and upgrade tradeoffs quickly.
* Feel increasing challenge and progression across rounds.
* Resume and replay levels without losing progress.

### Non-Goals

* No multiplayer gameplay for MVP.
* No in-app purchases, ads, battle pass, or live economy in the first version.
* No procedural map generation for the first release; use one handcrafted map and 20 designed rounds.
* No App Store-native rewrite unless packaging constraints require it.

---

## User Stories

### Player

* As a player, I want to place towers on the map, so that I can defend against enemy waves.
* As a player, I want to upgrade towers during combat, so that I can adapt to stronger enemies.
* As a player, I want to see tower range and stats before buying, so that I can make informed decisions.
* As a player, I want to replay failed rounds quickly, so that I can improve my strategy without friction.
* As a player, I want rounds to get harder over time, so that the game remains challenging and rewarding.

### Returning Player

* As a returning player, I want my progress saved, so that I can continue from my latest unlocked round.
* As a returning player, I want to replay completed rounds, so that I can improve my score.
* As a returning player, I want clear performance results after each run, so that I understand how well I played.

### Game Designer / Admin

* As a designer, I want enemy, tower, and round values to be configurable, so that balance changes do not require code rewrites.
* As a designer, I want to tune wave timing and enemy composition, so that the 20-round difficulty curve feels intentional.
* As a designer, I want basic gameplay telemetry, so that I can identify rounds that are too easy or too punishing.

---

## Functional Requirements

### Core Game Loop (Priority: P0)

* Game Board: Render a 3D tower defense map using ThreeJS with a fixed enemy path and valid build zones.
* Enemy Waves: Spawn enemies across 20 rounds with escalating health, speed, quantity, and enemy types.
* Tower Placement: Allow players to select a tower, preview valid placement, view range, and confirm placement.
* Tower Attacks: Towers automatically target enemies within range and apply damage based on tower rules.
* Currency System: Players earn currency from defeated enemies and spend it on towers and upgrades.
* Lives System: Players lose lives when enemies reach the endpoint; the level ends when lives reach zero.
* Round Progression: Players advance through 20 rounds after clearing each wave.
* Win/Loss States: Show clear victory, defeat, retry, and continue options.

### Towers (Priority: P0)

* Basic Cannon Tower: Medium damage, medium fire rate, single-target projectile.
* Rapid Tower: Low damage, high fire rate, useful against fast enemies.
* Splash Tower: Area damage, slower fire rate, useful against grouped enemies.
* Slow Tower: Low damage but slows enemies within attack effect.
* Upgrade System: Each tower supports at least 3 upgrade levels that improve damage, range, fire rate, or effect strength.

### Enemies (Priority: P0)

* Basic Enemy: Standard health and speed.
* Fast Enemy: Low health, high speed.
* Heavy Enemy: High health, low speed.
* Swarm Enemy: Appears in groups with low health.
* Boss Enemy: Appears in milestone rounds such as 10 and 20.

### iOS UX and Controls (Priority: P0)

* Touch Controls: Support tap to select, drag or tap to place, and tap to inspect towers.
* Responsive Layout: Fit common iPhone screen sizes in portrait-first orientation.
* Performance Targeting: Maintain stable gameplay on modern iPhones with optimized ThreeJS rendering.
* Pause and Resume: Allow players to pause mid-round and resume.

### Persistence and Progress (Priority: P1)

* Local Save: Save unlocked round, best score, settings, and tutorial completion locally.
* Resume Run: Allow players to continue an interrupted session when feasible.
* Round Results: Show enemies defeated, lives remaining, currency earned, and score.

### Backend and Live Services (Priority: P1)

* Express API: Provide endpoints for game config, balance data, leaderboard submission, and telemetry ingestion.
* Socket.IO Events: Support real-time telemetry or future live features; do not make core gameplay dependent on sockets.
* Leaderboard: Optional lightweight leaderboard for best score if time permits.

### Content and Configuration (Priority: P1)

* Config-Driven Balance: Store towers, enemies, waves, and upgrades in JSON or server-delivered config.
* Difficulty Curve: Define 20 rounds with clear escalation and milestone spikes.
* Debug Tools: Add developer controls for starting a specific round, adding currency, and spawning enemies.

### Polish (Priority: P2)

* Visual Effects: Add projectile trails, hit effects, death effects, and tower upgrade visual states.
* Sound Effects: Add placement, shooting, enemy hit, enemy escape, upgrade, victory, and defeat sounds.
* Music: Add lightweight looping background music with mute controls.
* Haptics: Add optional iOS haptic feedback for key actions if supported by the packaging approach.

---

## User Experience

### Entry Point & First-Time User Experience

* Player opens the app and lands on a simple home screen with Play, Continue, Settings, and How to Play.
* First launch starts a short interactive tutorial explaining:
  * Enemy path and endpoint.
  * How to place a tower.
  * How currency works.
  * How to upgrade towers.
  * How rounds start and end.
* Tutorial must be skippable after the player has completed it once.
* Default first session should get the player into gameplay within 15 seconds.

### Core Experience

* Step 1: Player starts a new run or continues progress.

  * Show current unlocked round and map preview.
  * If no save exists, start at Round 1 with tutorial prompts.
  * If save exists, offer Continue and Restart.

* Step 2: Player enters the battlefield.

  * Show map, enemy path, lives, currency, current round, and wave status.
  * Bottom HUD shows available tower cards with cost and simple icons.
  * Start Round button begins the enemy wave when the player is ready.

* Step 3: Player places towers.

  * Player taps a tower card.
  * Valid build zones highlight.
  * Tower range appears before placement.
  * Invalid placement shows a clear blocked-state indicator.
  * Confirm placement with tap; cancel by tapping outside or selecting another item.

* Step 4: Enemies spawn and towers attack automatically.

  * Enemies follow the fixed route toward the exit.
  * Towers acquire targets based on default targeting rules.
  * Damage, slow, and splash effects are visually readable.
  * Kills award currency immediately.

* Step 5: Player upgrades or sells towers during combat.

  * Tapping an existing tower opens an inspect panel.
  * Panel shows current stats, upgrade cost, sell value, and range.
  * Upgrade button is disabled when currency is insufficient.
  * Sell action requires confirmation to prevent accidental taps.

* Step 6: Round ends.

  * If enemies are cleared and lives remain, show a compact round-complete state.
  * Player receives score summary and can proceed to the next round.
  * Between rounds, player can place more towers, upgrade, or start next wave.

* Step 7: Player wins or loses.

  * Winning Round 20 shows final victory summary and replay options.
  * Losing shows the failed round, enemies leaked, score, and Retry.
  * Retry should reload quickly without forcing the player back to the home screen.

### Advanced Features & Edge Cases

* If the app loses focus, pause gameplay automatically.
* If performance drops, reduce non-essential particles and visual effects.
* If server config is unavailable, fall back to bundled local config.
* If a Socket.IO connection fails, continue single-player gameplay normally.
* If the player cannot afford any tower, keep the wave playable and avoid dead-end states where possible.
* If enemies overlap heavily, use readable health bars and avoid visual clutter.

### UI/UX Highlights

* Portrait-first layout for iPhone; landscape can be deferred.
* Large touch targets for tower cards, upgrade buttons, pause, and start round.
* Clear color language:
  * Green or blue for valid placement.
  * Red for invalid placement.
  * Yellow or orange for upgrade affordances.
* Always show tower range before purchase and when selected.
* Keep HUD minimal during combat; avoid blocking the battlefield.
* Use readable contrast and avoid relying only on color to communicate state.
* Prioritize 60 FPS feel over high visual complexity.

---

## Narrative

A player opens the game during a short break and wants something strategic but immediately understandable. The battlefield loads quickly: a winding path, a small pool of starting currency, and a few tower choices. The first enemies are simple enough to teach the rules, but each round introduces pressure: faster units, heavier units, swarms, and eventually bosses that test whether the player has built a balanced defense.

As the player places towers, they see range previews, costs, and upgrade options without needing to read a manual. A rapid tower handles fast enemies, a splash tower punishes groups, and a slow tower gives cannons more time to finish heavy targets. Every round creates small decisions: buy a new tower, upgrade an old one, or save for a stronger defense.

By Round 20, the player has a visible fortress and a clear sense of ownership over the strategy. Victory feels earned because the difficulty curve forced adaptation instead of button-mashing. For the business, the MVP proves whether the core loop is fun, whether users replay after failure, and whether the architecture can support more maps, towers, progression, and monetization later.

---

## Success Metrics

### User-Centric Metrics

* Tutorial completion rate: At least 80% of first-time players complete or skip into gameplay successfully.
* Round 3 completion rate: At least 70% of players reach Round 3 in first session.
* Round 10 completion rate: At least 35% of players reach Round 10.
* Replay rate after defeat: At least 40% of players retry after losing.
* Player satisfaction: At least 70% of testers rate gameplay clarity and fun as positive.

### Business Metrics

* Day 1 retention: At least 30% among early testers.
* Average session length: 8+ minutes.
* Playtest conversion: At least 50% of testers complete a feedback form.
* Content scalability: Add one new tower or enemy type in under one day using existing config structure.

### Technical Metrics

* Frame rate: Target 60 FPS, minimum acceptable 30 FPS during heavy waves on supported iPhones.
* Load time: Main menu interactive within 3 seconds on a typical modern iPhone connection after initial asset cache.
* Crash-free sessions: 99%+ during test builds.
* API reliability: 99%+ success rate for config and telemetry endpoints.
* Socket dependency: Zero gameplay-blocking failures caused by Socket.IO disconnects.

### Tracking Plan

* app_open
* tutorial_started
* tutorial_completed
* run_started
* round_started
* round_completed
* round_failed
* tower_selected
* tower_placed
* tower_upgraded
* tower_sold
* enemy_killed
* enemy_escaped
* player_paused
* player_resumed
* run_won
* retry_clicked
* settings_changed
* telemetry_error

---

## Technical Considerations

### Technical Needs

* Frontend app built with Vite and React for fast iteration.
* ThreeJS scene for rendering the battlefield, towers, projectiles, enemies, and effects.
* Game loop separated from React UI state to prevent render performance issues.
* Deterministic simulation layer for enemies, targeting, damage, wave progression, and scoring.
* Config files for towers, enemies, upgrades, rounds, and map metadata.
* Express backend for config delivery, telemetry, leaderboard endpoints, and health checks.
* Socket.IO layer for live telemetry, debugging, or future real-time features.
* iOS packaging decision:
  * Option 1: PWA for fastest testing.
  * Option 2: Capacitor wrapper for App Store-style distribution.

### Integration Points

* Local storage or IndexedDB for save state.
* Express API for remote balance/config and telemetry.
* Socket.IO server for development/debug events and future live features.
* Optional analytics destination if product analytics tooling is added.
* Optional asset pipeline for compressed textures and audio.

### Data Storage & Privacy

* Store local game progress on device: unlocked rounds, best scores, tutorial completion, settings.
* Do not require account creation for MVP.
* Telemetry should avoid collecting personal data unless explicitly needed.
* Use anonymous device/session IDs for playtest analytics.
* Provide a simple way to clear local progress during testing.

### Scalability & Performance

* Keep all combat simulation client-side for MVP.
* Use object pooling for enemies, projectiles, hit effects, and particles.
* Avoid excessive React state updates during frame-by-frame gameplay.
* Use instancing or batched rendering where possible for repeated objects.
* Cap maximum simultaneous enemies/projectiles to protect mobile performance.
* Bundle assets aggressively and lazy-load non-critical screens.

### Potential Challenges

* The proposed stack is web-first, not native iOS. This is fine for MVP, but touch performance, packaging, App Store compliance, and haptics need early validation.
* ThreeJS can be overkill if the game is visually simple; keep the camera, map, and assets constrained.
* Socket.IO is unnecessary for core single-player gameplay. Do not couple combat to the server.
* Balancing 20 rounds will take real playtesting. Do not assume the first config will be fun.
* Pathfinding should be avoided for MVP. Use a fixed path to reduce complexity.
* Fieldrunners 2 is an inspiration, not something to copy directly. Use original art, tower names, enemies, map layout, and progression.

---

## Milestones & Sequencing

### Project Estimate

Medium: 4–6 weeks for a polished MVP with one map, 20 rounds, 4 tower types, 5 enemy types, local save, basic backend, and iOS-ready packaging path.

### Team Size & Composition

Use a small team that can move fast:

* 1 gameplay engineer / full-stack engineer
* 1 product-minded designer or game designer
* Optional part-time artist/audio contributor for polish

If only one builder is available, cut scope to one map, 3 towers, 4 enemy types, local-only config, and no leaderboard.

### Suggested Phases

Phase 1: Prototype Core Loop (1 week)

* Key Deliverables:
  * Vite + React + ThreeJS project setup.
  * Basic battlefield scene with fixed path.
  * Enemy movement along path.
  * Tower placement and basic shooting.
  * Lives, currency, and round start/end loop.
* Dependencies:
  * Initial placeholder art.
  * Map path definition.

Phase 2: MVP Gameplay Systems (1–2 weeks)

* Key Deliverables:
  * 4 tower types with upgrades.
  * 5 enemy types.
  * 20-round wave configuration.
  * Win/loss states and retry flow.
  * Pause/resume and local save.
* Dependencies:
  * Balanced tower/enemy config.
  * Basic UI components for HUD and tower panels.

Phase 3: Backend, Telemetry, and Config (1 week)

* Key Deliverables:
  * Express API for config and telemetry.
  * Socket.IO development channel for live telemetry/debug events.
  * Optional leaderboard endpoint.
  * Tracking event schema.
* Dependencies:
  * Agreed telemetry fields.
  * Hosting target for backend.

Phase 4: iOS Optimization and Polish (1–2 weeks)

* Key Deliverables:
  * Mobile touch optimization.
  * Responsive portrait layout.
  * Asset optimization and object pooling.
  * Visual effects, sound effects, and settings.
  * PWA or Capacitor packaging validation on real iPhones.
* Dependencies:
  * Access to test devices.
  * Final packaging decision.

Phase 5: Playtest and Balance Pass (1 week)

* Key Deliverables:
  * Internal and external playtest build.
  * Round-by-round difficulty review.
  * Telemetry review for failure spikes and drop-off.
  * Final MVP bug fixes and tuning.
* Dependencies:
  * At least 10–20 testers.
  * Analytics/telemetry working before test starts.

---

## MVP Scope Recommendation

Build this first:

* One map.
* 20 rounds.
* 4 towers.
* 5 enemy types.
* Local save.
* Basic telemetry.
* PWA or Capacitor iOS test build.

Cut or defer this:

* Multiplayer.
* Accounts.
* In-app purchases.
* Multiple maps.
* Procedural levels.
* Complex pathfinding.
* Server-authoritative gameplay.

The biggest risk is not engineering; it is game feel and balance. Get a playable loop running fast, then spend serious time tuning waves, tower costs, enemy health, and upgrade values.