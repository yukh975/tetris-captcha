# CLAUDE.md

## Project

Tetris CAPTCHA — standalone browser CAPTCHA widget (no dependencies, no build).

## Architecture

- `index.html` — HTML + CSS only, no inline JS
- `captcha.js` — all CAPTCHA logic (procedural generation, drag & drop, anti-bot)
- Single-page, no routing, no frameworks

## Key design decisions

- JS intentionally in separate file (not inline) to hide logic from page source
- Shapes are procedurally generated polyominoes (7-10 cells), not from a fixed set
- Correct pieces shown in wrong rotation — user must rotate before placing
- 3-4 target holes per challenge on a 15×15 board
- Any wrong answer = full reset (new shapes, new board)
- Hint text kept minimal to avoid giving bots information

## Anti-bot layers

1. Procedural shapes (no dictionary attack)
2. Rotation requirement (visual reasoning)
3. Multiple targets per challenge
4. Mouse behavior analysis (trajectory, speed variance)
5. Minimum solve time check
6. Honeypot form field
7. Progressive delay on failures
8. Lockout after 5 fails (30s cooldown)

## Language

UI is in Russian. Code comments in English.
