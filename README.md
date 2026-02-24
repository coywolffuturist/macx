# MACX - The Imagineer Protocol

Attribution, royalties, and value capture for rapid prototypers.

Named for [Manfred Macx](https://en.wikipedia.org/wiki/Accelerando), the agalmic entrepreneur from Charles Stross's *Accelerando* who made his living giving away ideas.

## The Problem

When the bottleneck is imagination, not implementation, value creation happens fast. But value *capture* requires attribution — knowing who created what, when, and what derived from it.

MACX is the attribution layer for the imagineer economy.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Traditional IP                                              │
│  Create → Lawyer → Patent → Sue → Maybe profit              │
└─────────────────────────────────────────────────────────────┘

                          vs.

┌─────────────────────────────────────────────────────────────┐
│  MACX Protocol                                               │
│  Ship → Auto-attribute → Forks tracked → Royalties flow     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
npm install -g macx

# Initialize your identity (generates keypair)
macx init --name "yourhandle"

# Register a prototype
macx ship ./my-project --title "My Cool Thing" --royalty 5

# View your portfolio
macx portfolio

# Someone forks your work
macx fork abc123 --title "My Fork" --path ./my-fork

# See the attribution graph
macx graph
```

## Commands

### Identity

```bash
# Create/load identity
macx init --name "yourname"

# Show your identity
macx whoami
```

### Shipping

```bash
# Register a prototype
macx ship <path> [options]

Options:
  -t, --title <title>      Title for this ship
  -d, --description <desc> Description  
  --tags <tags>            Comma-separated tags
  --license <license>      License type (default: MIT)
  --royalty <percent>      Royalty % for derivatives (default: 5)
  --repo <url>             GitHub URL (auto-detected)
```

### Forking

```bash
# Register a derivative
macx fork <ship-id> [options]

Options:
  -p, --path <path>        Path to your derivative
  -t, --title <title>      Title for your fork
  -d, --description <desc> What you changed
```

### Portfolio & Graph

```bash
# View your ships and forks
macx portfolio
macx portfolio --json

# View attribution graph
macx graph
macx graph --ship <id>
```

### Verification

```bash
# Verify a ship's signature
macx verify <ship-id>
```

### Export

```bash
# Export for on-chain attestation
macx export --format eas --ship <id>
macx export --format json
```

## How Attribution Works

Every ship is:
1. **Content-hashed** — The actual code/files get a unique fingerprint
2. **Signed** — Your Ethereum keypair signs the attestation
3. **Logged** — Added to your local registry (syncs to network later)

Every fork:
1. **Links to parent** — The original ship is referenced
2. **Inherits royalty obligation** — The % owed to the original creator
3. **Extends the graph** — Attribution chain is preserved

## The Data Model

```
Ship {
  id: string           // Unique identifier
  title: string        // Human-readable name
  contentHash: string  // SHA256 of contents
  author: {
    address: string    // Ethereum address
    name: string       // Display name
  }
  repo: string         // GitHub URL
  royaltyPercent: number
  signature: string    // Signed attestation
  createdAt: string
}

Fork {
  id: string
  title: string
  parent: {
    id: string
    author: { address, name }
  }
  royaltyObligation: {
    to: string         // Original author's address
    percent: number    // % owed
  }
  signature: string
}
```

## Roadmap

### Phase 1: Local Attribution (NOW)
- ✅ Keypair identity
- ✅ Ship registration with content hashing
- ✅ Fork tracking with royalty obligations
- ✅ Signature verification
- ✅ Portfolio view

### Phase 2: Network Sync
- [ ] P2P registry sync
- [ ] Global attribution graph
- [ ] Cross-reference with GitHub commits

### Phase 3: On-Chain Attestations
- [ ] EAS (Ethereum Attestation Service) integration
- [ ] Base deployment for low fees
- [ ] Hypercert compatibility

### Phase 4: Value Capture
- [ ] IP-NFT minting
- [ ] Programmable royalty enforcement
- [ ] Integration with Zora/Sound/Mirror

### Phase 5: Retroactive Funding
- [ ] Hypercert issuance
- [ ] Optimism RPGF compatibility
- [ ] Gitcoin integration

## Philosophy

1. **Attribution is the foundation** — You can't capture value without proving origin
2. **Open by default** — Forks are encouraged, not blocked
3. **Royalties flow backward** — Derivatives create revenue for originals
4. **Reputation compounds** — Your graph is your resume
5. **Digital-native** — Built for the substrate where value is created

## Integrations

MACX is designed to integrate with your shipping flow:

```bash
# After creating a GitHub repo
gh repo create my-thing --public && macx ship . --title "My Thing"

# In your CI/CD
- name: Register Ship
  run: macx ship . --title "${{ github.repository }}"
```

## Privacy

- Your private key never leaves `~/.macx/keys.json`
- Only public attestations are shared
- You control what gets registered

## License

MIT — Ship freely.
