# Contract Verification Sync

Syncs verified contracts from the official Citrea explorer to CitreaScan.

## Usage

```bash
npx tsx sync-contracts.ts
```

## Prerequisites

- Node.js 18+ (native fetch support)
- OR run `npm install` in this directory

## What It Does

1. Fetches all verified contracts from `explorer.testnet.citrea.xyz`
2. Checks which contracts are already verified on `dev.testnet.citreascan.com`
3. Syncs missing verifications by submitting verification requests with full source code
4. Polls for verification completion and reports results

## Configuration

Edit constants at the top of `sync-contracts.ts`:

```typescript
const SOURCE_EXPLORER = 'https://explorer.testnet.citrea.xyz/api/v2';
const TARGET_EXPLORER = 'https://dev.testnet.citreascan.com/api/v2';
const DELAY_MS = 2000;
const VERIFICATION_TIMEOUT_MS = 60000;
```

## Rate Limiting

- 2 second delay between contract verifications
- 500ms delay between pagination requests
- 60 second timeout for verification polling

Adjust `DELAY_MS` if encountering rate limit errors.

## Troubleshooting

**Failed to fetch details (404)**
- Contract not verified on source explorer
- Invalid address

**Verification failed (422)**
- Incomplete contract data
- Check error message for details

**Too Many Requests (429)**
- Increase `DELAY_MS`
- Wait before retrying

**Script crashes**
- Re-run to continue (skips already-verified contracts)

## Automatic Syncing with Sourcify

This script is a one-time backfill tool. For automatic ongoing syncing, enable Sourcify integration.

**Backend configuration required:**

```bash
SOURCIFY_INTEGRATION_ENABLED=true
SOURCIFY_SERVER_URL=https://sourcify.dev/server
SOURCIFY_REPO_URL=https://repo.sourcify.dev/contracts
CHAIN_ID=5115
```

Once enabled, all future contract verifications automatically sync between explorers. No manual scripts needed.
