# Cash Stash — App Specification

> Extracted from the current codebase (`stash-earn`). Describes what the app is, what it does today, and how it is built.

## Overview

**Cash Stash** is a mobile-first savings app that presents a radically simple experience for holding cash and earning yield. Users see a balance, daily/yearly earnings projections, deposit/withdraw flows, and transaction history — framed in plain language with no DeFi jargon on the main screens.

**Tagline:** *A simple place to keep cash and earn yield.*

**Target UX:** Warm, premium, family-friendly (preferred names like "Mom", "Grandma"; emoji avatars; time-based greetings).

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | TanStack Start (React 19, file-based routing) |
| Build | Vite 7, Nitro |
| Styling | Tailwind CSS v4, shadcn/ui (Radix), custom design tokens |
| State | Zustand (local stash mock), TanStack Query (market data) |
| Auth & wallets | Privy (`@privy-io/react-auth`, `@privy-io/server-auth`) |
| EVM chain | Base (embedded Ethereum wallet on login) |
| Yield source (APY display) | DorkFi market data API — Voi mainnet A-Market USDC |
| On-chain (xChain) | Voi mainnet via `algo-x-evm-sdk`, algosdk, algokit-utils |
| Validation | Zod |
| Hosting template | Lovable (`tanstack_start_ts_2026-06-08`) |

---

## Routes & Screens

| Path | Screen | Purpose |
| --- | --- | --- |
| `/` | Home | Balance hero, APY badge, daily/yearly earnings, deposit/withdraw CTAs, recent activity |
| `/activity` | Activity | Full transaction history with filters (All, Deposits, Withdrawals, Interest), grouped by month |
| `/account` | Account | Profile card, settings list, Voi xChain section, sign out |

**Shell:** `MobileShell` — max-width mobile layout, fixed bottom tab nav (Home · Activity · Account), safe-area insets, toast notifications.

**Root:** `__root.tsx` wraps all routes with QueryClient, Privy, and `OnboardingGate`.

---

## User Flows

### 1. Authentication & Onboarding

```
Unauthenticated → Welcome ("Get Started") → Privy login
  → Profile setup (preferred name + avatar) → Success → Main app
```

- **Login methods:** email, passkey, Google, Apple
- **Embedded wallet:** Ethereum wallet created on login for users without wallets (Base chain)
- **Profile gate:** App blocked until `preferredName` is set in Privy custom metadata
- **Onboarding steps:** Welcome → Profile → Success → children (main routes)

### 2. Home — View Savings

- Greeting uses time of day + preferred name + avatar
- **Balance** from local Zustand store (mock data today)
- **APY** from live DorkFi supply APY when available; falls back to store default (4.87%)
- **Projections:** daily = balance × APY / 365; annual = balance × APY
- **Recent activity:** last 4 transactions, link to full Activity screen

### 3. Deposit / Withdraw

Bottom sheet (`MoneySheet`) with:

- Amount keypad
- Method selection (mock bank/card/manual for deposit; mock bank/card for withdraw)
- Client-side balance update via Zustand — **not yet wired to real bank or on-chain transfers**
- Success toast + confirmation state

### 4. Activity

- Filter chips: All, Deposits, Withdrawals, Interest
- Transactions grouped by month label
- Row shows type icon, label, note, relative date, signed amount

### 5. Account & Profile

- Display name, email/login method, avatar/initials
- **Profile edit sheet:** update preferred name and avatar (server-persisted via Privy)
- **Settings (UI only, no backend):** Security, Notifications, Support
- **Debug panel** (when `VITE_DEBUG=true`): Privy ID, wallet address (copyable)

### 6. Voi xChain (Account)

For users with an EVM wallet (from Privy):

1. Server derives **canonical** (AVM v11) and **execution** (AVM v10) Voi addresses from EVM owner
2. UI explains dual-address model on Voi mainnet today
3. **Self-payment test:** user signs EIP-712 typed data in wallet → server submits 0 VOI self-payment to Voi mainnet → shows tx ID + block explorer link

---

## Data Model

### Stash (client mock — `src/lib/stash.ts`)

```ts
Transaction {
  id: string
  type: "deposit" | "withdrawal" | "interest"
  amount: number        // always positive; sign from type
  date: string          // ISO
  note?: string
}

StashState {
  balance: number       // USD
  apy: number           // decimal, e.g. 0.0487
  transactions: Transaction[]
  deposit(amount, note?)
  withdraw(amount, note?)
}
```

**Seed data:** $2,548.12 balance, sample deposits/withdrawals/interest over ~28 days.

### User Profile (Privy custom metadata)

```ts
{
  preferredName: string   // required for onboarding completion, max 30 chars
  avatar?: string         // one of 8 emoji presets
}
```

---

## External Integrations

### Privy

- **Client:** `VITE_PRIVY_APP_ID`, appearance (light theme, sage accent `#3d8b6e`)
- **Server:** `PRIVY_APP_SECRET` for token verification and metadata updates
- **Future:** `PRIVY_VAULT_ID` / `VITE_PRIVY_VAULT_ID` for Earn vault deposits (not wired in UI yet)

### DorkFi (APY)

- **API:** `https://dorkfi-api.nautilus.sh/market-data`
- **Market:** Voi mainnet A-Market USDC (`chain: voi-mainnet`, `poolId: 47139778`, `marketId: 395614`)
- **Refresh:** 60s stale/refetch interval

### Voi xChain

- **Network:** Voi mainnet (algod/indexer via env or nodely.dev defaults)
- **Derivation:** TEAL templates compiled on algod; canonical vs execution logic versions
- **Signing:** EIP-712 via user's EVM wallet; server attaches signature and submits txn group
- **Explorer:** `block.voi.network` for confirmed transactions

---

## Server Functions

| Function | Method | Purpose |
| --- | --- | --- |
| `updateProfile` | POST | Verify Privy token, set `preferredName` + `avatar` metadata |
| `getXChainAddress` | GET | Derive canonical + execution Voi addresses from EVM address |
| `prepareXChainSelfPaymentFn` | POST | Build unsigned 0 VOI txn + EIP-712 typed data |
| `submitXChainSelfPaymentFn` | POST | Submit signed self-payment to Voi mainnet |

All server-only secrets read via `getServerConfig()` at request time (Cloudflare Workers–safe pattern).

---

## Design System

- **Fonts:** Fraunces (display/headlines), Inter Tight (UI)
- **Palette:** Warm off-white background, deep sage primary, green `positive` for earnings/yield
- **Radius:** Large rounded corners (cards ~2rem, buttons ~2xl)
- **Layout:** Mobile-first, max-width ~md, bottom navigation
- **Components:** shadcn/ui primitives under `src/components/ui/`

---

## Environment Variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | Public | Privy app ID |
| `PRIVY_APP_SECRET` | Server | Privy API secret |
| `PRIVY_VAULT_ID` / `VITE_PRIVY_VAULT_ID` | Mixed | Earn vault (future) |
| `VITE_DEBUG` | Public | Show debug fields on Account |
| `VOI_ALGOD_*` / `VOI_INDEXER_*` | Server | Voi node endpoints (optional) |

See `.env.example` for full list.

---

## Implementation Status

### Shipped / working

- [x] Privy auth (email, passkey, Google, Apple)
- [x] Embedded Base EVM wallet
- [x] Onboarding + profile (name, avatar)
- [x] Home, Activity, Account screens with mock balance/transactions
- [x] Deposit/withdraw UI (local state only)
- [x] Live DorkFi supply APY on Home
- [x] Voi xChain address derivation + 0 VOI self-payment flow
- [x] Profile edit from Account
- [x] Error boundaries + Lovable error reporting

### Not yet implemented (UI placeholders or config only)

- [ ] Real bank/card funding (Chase ••4421 etc. are mock labels)
- [ ] Privy Earn vault deposit/withdraw
- [ ] On-chain USDC balance synced to Home hero
- [ ] DorkFi supply/withdraw actions
- [ ] Security, Notifications, Support settings backends
- [ ] Interest accrual as real on-chain or scheduled events

---

## Key Files

```
src/routes/
  __root.tsx          App shell, providers, onboarding wrapper
  index.tsx           Home
  activity.tsx        Transaction history
  account.tsx         Account + xChain section

src/components/
  OnboardingGate.tsx  Auth + profile gate
  MoneySheet.tsx      Deposit/withdraw sheet
  BottomNav.tsx       Tab nav + MobileShell
  XChainAccountSection.tsx

src/lib/
  stash.ts            Mock balance & transactions
  config.server.ts    Server env config
  api/                TanStack server functions
  privy/              Auth helpers, profile
  dorkfi/             APY market data
  xchain/             Derivation, signing, submission
  voi/                Algod client, constants
```

---

## Product Principles (inferred from UI copy & structure)

1. **Simplicity first** — yield and balance in dollars, not tokens or protocols
2. **Human tone** — greetings, preferred names, "your stash", no jargon on primary screens
3. **Trust cues** — APY badge, daily earnings callout, bank-style transfer notes
4. **Progressive crypto** — EVM wallet and Voi xChain live under Account, not on Home
5. **Mobile-native** — bottom sheets, keypad entry, safe areas, thumb-friendly actions
