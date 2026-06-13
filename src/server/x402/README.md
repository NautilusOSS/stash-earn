# x402 Payment Gateway

Server-only USDC payment gateway for Cash Stash using the [x402](https://www.x402.org/) HTTP 402 flow.

## Security boundary

| Layer | Responsibility |
| --- | --- |
| **Browser / wallet** | Signs payment authorization (EIP-3009 USDC `transferWithAuthorization`) |
| **Server** | Returns payment requirements, verifies signature, settles on Base, mirrors USDC to payer on Voi, serves protected content |
| **Never in UI** | `EVM_PRIVATE_KEY`, `ALGORAND_MNEMONIC`, facilitator signing keys |

After a successful Base settlement, the server sends the same USDC amount (ASA `302190`) from the platform AVM account (`ALGORAND_MNEMONIC`) to the payer's Voi xChain **execution** address. Both accounts must be opted into USDC; the payer must opt in on the execution address before receiving.

Private keys are loaded only from server env vars in `src/server/x402/`. No `VITE_` prefix on secrets.

## Routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/x402/health` | Gateway status |
| `POST` | `/api/x402/quote` | Build payment requirements for a custom amount |
| `GET` | `/api/x402/protected` | Payment-gated test resource |

Optional query param on protected: `?amount=$0.05`

## Local setup

1. Copy `.env.example` → `.env` and fill server-only values:

```bash
EVM_PRIVATE_KEY=0x...          # facilitator relayer (settles payments)
EVM_RECEIVER_ADDRESS=0x...      # USDC recipient (your treasury)
EVM_RPC_URL=https://...
EVM_CHAIN_ID=84532               # Base Sepolia for testing
USDC_CONTRACT_ADDRESS=0x036CbD53842c65966b4e799010c2615becDA59a
```

2. Start the app: `bun run dev`

3. Request protected resource (expect 402):

```bash
curl -i http://localhost:8080/api/x402/protected
```

4. Request a quote:

```bash
curl -s -X POST http://localhost:8080/api/x402/quote \
  -H 'content-type: application/json' \
  -d '{"amount":"$0.01","resourceId":"demo","memo":"test"}'
```

5. Pay with an x402-capable client (`@x402/fetch`, KeeperHub wallet skill, etc.) by retrying the protected URL with the signed `payment-signature` header.

## Error responses

| Status | Meaning |
| --- | --- |
| `402` | Payment required or underpaid |
| `400` | Invalid payment payload |
| `409` | Replay detected (nonce already settled) |
| `500` | Misconfigured server (missing env) |

## Tests

```bash
bun run test
```

## Module layout

```
src/server/x402/
  config.ts          — env loading + misconfiguration errors
  types.ts           — PaymentQuote, PaymentRequirement, etc.
  quote.ts           — quote API + requirement builder
  verify.ts          — header decode + validation
  settle-evm.ts      — viem + local x402 facilitator
  replay-store.ts    — durable replay protection
  algorand-account.ts — future Algorand settlement (server-only)
  middleware.ts      — payment gate middleware
src/server/routes/x402.ts — Hono router
```
