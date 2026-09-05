# ProofGive

A transparent donation ledger built on Solana for **Kar Se Khar**, for DEV's Weekend Challenge: Generosity Edition.

## The problem

Donors rarely know if their money reaches the people it was meant for. NGOs, in turn, often can't prove fair distribution without publishing personal details about vulnerable beneficiaries — which trades one harm for another.

## The idea

ProofGive keeps two things public and one thing private:

- **Public:** every donation, and every "distribution proof" (a record that a batch of funds was distributed, with the beneficiary count and total amount), all on Solana devnet, viewable by anyone.
- **Private:** who the actual beneficiaries are and how much each one got. That detail is hashed (SHA-256) locally in the browser before anything is sent on-chain — only the hash is public, so the NGO can later prove a specific allocation matches the hash without ever uploading names or amounts per person.

No backend, no database. The "ledger" view reads directly from the chain.

## Running it locally

1. Install the [Phantom wallet](https://phantom.app) browser extension and switch its network to **Devnet** (Settings → Developer Settings → Change Network).
2. Get devnet SOL for your wallet from the [Solana faucet](https://faucet.solana.com).
3. Serve this folder with any static server, e.g.:
   ```
   npx serve .
   ```
4. Open the page, connect your wallet, paste an NGO devnet address (or use a second devnet wallet you control to act as the "NGO"), and try:
   - **Give** — sends a small SOL transfer + memo tagging the campaign.
   - **Mark distributed** — posts a memo-only transaction recording a beneficiary count, total distributed, and a hash of the private allocation notes.
   - **Public ledger** — reads both back straight from devnet, with links to Solana Explorer.

## Why Solana

The Memo program made it possible to build a working, verifiable transparency trail in a weekend without writing and auditing a custom on-chain program — donation and proof records live as ordinary, publicly readable transactions.

## What's next

- Swap the local SHA-256 commitment for a real zero-knowledge proof (a smaller version of the fairness-proof pattern from an earlier ZK negotiation project) so the NGO can prove *correct* distribution, not just *that some* distribution happened.
- A lightweight admin view scoped to Kar Se Khar's actual wallet.
- Optional recurring/subscription donations.
