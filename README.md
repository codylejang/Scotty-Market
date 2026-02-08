# Scotty Market - WINNER OF TARTANHACKS 2026 - Visa Track

**Developers:**
- https://www.linkedin.com/in/cs-andrew-chang/
- https://www.linkedin.com/in/sanjaybaskaran/
- https://www.linkedin.com/in/arjun-chavan-3389b024b/
- https://www.linkedin.com/in/cody-lejang/

A gamified financial ecosystem where users nurture a dynamic virtual pet, Scotty the Terrier, by maintaining budget goals to unlock personalized AI achievements and earn credits for interactive care, visually reflecting their fiscal health through Scotty's growth, mood, and stamina.

## Key Points For Pitching

- Who: college age students and younger generations
- What: AI-driven insights that integrate directly into achievements
- Why: help people save money and feel better, more confident in their decisions

Scotty Market is an AI-powered personal finance app that turns raw transaction data into actionable coaching. Instead of showing users only charts, it gives them a virtual companion (Scotty) with behavior-driven quests, budget nudges, and goal progress that are grounded in real spending activity.

## Why This Is Useful

Most budgeting tools are descriptive. Scotty is built to be prescriptive and motivating:

- It converts spending patterns into concrete next actions.
- It helps users move toward goals with weekly quest-based behavior changes.
- It keeps money habits engaging through lightweight gamification.

## High-Level Architecture

This repo is a two-part system:

- `scotty-app/`: Expo + React Native client for mobile/web UI.
- `backend/`: TypeScript + Express API with SQLite persistence, orchestration, and AI tooling.

At runtime, the backend ingests and normalizes transaction data, computes financial summaries, generates insights/quests/budget suggestions, and serves the app via REST endpoints.

## Key Technologies

### Dedalus

- Used as the primary LLM orchestration/provider path in the backend.
- Supports multi-model workflows and AI generation for insights/quest logic.
- The backend falls back to Anthropic or mock providers when keys are unavailable.

Relevant implementation:
- `backend/src/agents/runner.ts`
- `backend/src/orchestrator/workflow.ts`
- `backend/src/index.ts`

### Nessie

- Powers sandbox banking data flows for accounts and transactions.
- Seed data is defined in `backend/src/data/seed-transactions.json` and pushed into Nessie APIs.
- Backend routes support Nessie seeding/syncing and transaction retrieval.

Relevant implementation:
- `backend/src/services/nessie.ts`
- `backend/src/adapters/mock-bank.ts`
- `backend/src/api/routes.ts`

### CodeRabbit

- Used in the team’s PR workflow to automate code review feedback and catch regressions early.
- Complements local tests by providing AI-assisted review on proposed changes before merge.

## Local Development

### Prerequisites

- Node.js 20+
- npm

### 1. Run Backend

```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

Backend runs on `http://localhost:3001` with API base `http://localhost:3001/api`.

### 2. Run App

```bash
cd scotty-app
npm install
npm run start
```

For physical devices in Expo Go, set your machine IP:

```bash
EXPO_PUBLIC_API_HOST=192.168.x.x npm run start
```

## Testing

Backend:

```bash
cd backend
npm test
```

App:

```bash
cd scotty-app
npm test
```
