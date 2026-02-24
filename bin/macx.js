#!/usr/bin/env node

/**
 * MACX - The Imagineer Protocol
 * 
 * Attribution layer for rapid prototypers.
 * Every ship is logged, attributed, and ready for value capture.
 * 
 * Named for Manfred Macx, the agalmic entrepreneur from Accelerando.
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve, basename } from 'path';
import { createHash, randomBytes } from 'crypto';
import { ethers } from 'ethers';

const program = new Command();

// Registry paths
const HOME = process.env.HOME || '/tmp';
const MACX_DIR = `${HOME}/.macx`;
const REGISTRY_PATH = `${MACX_DIR}/registry.json`;
const KEYS_PATH = `${MACX_DIR}/keys.json`;

// Ensure macx directory exists
if (!existsSync(MACX_DIR)) {
  mkdirSync(MACX_DIR, { recursive: true });
}

program
  .name('macx')
  .description('The Imagineer Protocol - Attribution and value capture for rapid prototypers')
  .version('0.1.0');

// ============================================================================
// IDENTITY
// ============================================================================

program
  .command('init')
  .description('Initialize your imagineer identity')
  .option('-n, --name <name>', 'Your public name/handle')
  .action(async (opts) => {
    // Generate or load keypair
    let keys = loadKeys();
    
    if (!keys) {
      console.log('🔑 Generating new identity keypair...');
      const wallet = ethers.Wallet.createRandom();
      keys = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        name: opts.name || 'anonymous',
        createdAt: new Date().toISOString()
      };
      saveKeys(keys);
      console.log(`✅ Identity created!`);
    } else {
      if (opts.name) {
        keys.name = opts.name;
        saveKeys(keys);
      }
      console.log(`✅ Identity loaded`);
    }
    
    console.log(`
📇 Your Imagineer Identity
━━━━━━━━━━━━━━━━━━━━━━━━━━
Address: ${keys.address}
Name:    ${keys.name}
Created: ${keys.createdAt}

This address is your permanent attribution anchor.
All your ships will be signed with this key.
`);
  });

program
  .command('whoami')
  .description('Show your imagineer identity')
  .action(() => {
    const keys = loadKeys();
    if (!keys) {
      console.log('No identity found. Run: macx init');
      process.exit(1);
    }
    console.log(`
📇 ${keys.name}
Address: ${keys.address}
Created: ${keys.createdAt}
`);
  });

// ============================================================================
// SHIP (Core Attribution)
// ============================================================================

program
  .command('ship <path>')
  .description('Register a new prototype/creation')
  .option('-t, --title <title>', 'Title for this ship')
  .option('-d, --description <desc>', 'Description')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--license <license>', 'License type', 'MIT')
  .option('--royalty <percent>', 'Royalty percentage for derivatives', '5')
  .option('--repo <url>', 'GitHub repo URL (auto-detected if in git repo)')
  .action(async (path, opts) => {
    const keys = loadKeys();
    if (!keys) {
      console.log('No identity found. Run: macx init');
      process.exit(1);
    }
    
    const fullPath = resolve(path);
    if (!existsSync(fullPath)) {
      console.log(`Path not found: ${fullPath}`);
      process.exit(1);
    }
    
    // Auto-detect git info
    let gitInfo = {};
    try {
      const remote = execSync('git remote get-url origin', { cwd: fullPath, encoding: 'utf-8' }).trim();
      const commit = execSync('git rev-parse HEAD', { cwd: fullPath, encoding: 'utf-8' }).trim();
      const branch = execSync('git branch --show-current', { cwd: fullPath, encoding: 'utf-8' }).trim();
      gitInfo = { remote, commit, branch };
    } catch (e) {
      // Not a git repo or git not available
    }
    
    // Generate content hash
    const contentHash = hashDirectory(fullPath);
    
    // Build the ship record
    const ship = {
      id: generateId(),
      type: 'ship',
      title: opts.title || basename(fullPath),
      description: opts.description || '',
      path: fullPath,
      contentHash,
      author: {
        address: keys.address,
        name: keys.name
      },
      git: gitInfo.remote ? gitInfo : null,
      repo: opts.repo || gitInfo.remote || null,
      license: opts.license,
      royaltyPercent: parseFloat(opts.royalty),
      tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : [],
      createdAt: new Date().toISOString(),
      signature: null
    };
    
    // Sign the ship
    const wallet = new ethers.Wallet(keys.privateKey);
    const message = JSON.stringify({
      id: ship.id,
      contentHash: ship.contentHash,
      author: ship.author.address,
      createdAt: ship.createdAt
    });
    ship.signature = await wallet.signMessage(message);
    
    // Save to registry
    const registry = loadRegistry();
    registry.ships.push(ship);
    saveRegistry(registry);
    
    console.log(`
🚀 Ship Registered!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID:          ${ship.id}
Title:       ${ship.title}
Author:      ${ship.author.name} (${ship.author.address.slice(0, 10)}...)
Content:     ${ship.contentHash.slice(0, 16)}...
Repo:        ${ship.repo || 'none'}
License:     ${ship.license}
Royalty:     ${ship.royaltyPercent}%
Signed:      ✓

This ship is now part of your attribution graph.
Run 'macx portfolio' to see all your ships.
`);
  });

// ============================================================================
// FORK (Derivative Attribution)
// ============================================================================

program
  .command('fork <ship-id>')
  .description('Register a fork/derivative of an existing ship')
  .option('-p, --path <path>', 'Path to your derivative')
  .option('-t, --title <title>', 'Title for your fork')
  .option('-d, --description <desc>', 'What you changed/added')
  .action(async (shipId, opts) => {
    const keys = loadKeys();
    if (!keys) {
      console.log('No identity found. Run: macx init');
      process.exit(1);
    }
    
    const registry = loadRegistry();
    const original = registry.ships.find(s => s.id === shipId || s.id.startsWith(shipId));
    
    if (!original) {
      console.log(`Ship not found: ${shipId}`);
      console.log('Use "macx search" to find ships or provide full ID');
      process.exit(1);
    }
    
    const fork = {
      id: generateId(),
      type: 'fork',
      title: opts.title || `Fork of ${original.title}`,
      description: opts.description || '',
      path: opts.path ? resolve(opts.path) : null,
      contentHash: opts.path ? hashDirectory(resolve(opts.path)) : null,
      author: {
        address: keys.address,
        name: keys.name
      },
      parent: {
        id: original.id,
        title: original.title,
        author: original.author
      },
      royaltyObligation: {
        to: original.author.address,
        percent: original.royaltyPercent
      },
      createdAt: new Date().toISOString(),
      signature: null
    };
    
    // Sign
    const wallet = new ethers.Wallet(keys.privateKey);
    const message = JSON.stringify({
      id: fork.id,
      parentId: fork.parent.id,
      author: fork.author.address,
      createdAt: fork.createdAt
    });
    fork.signature = await wallet.signMessage(message);
    
    registry.forks.push(fork);
    saveRegistry(registry);
    
    console.log(`
🍴 Fork Registered!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID:          ${fork.id}
Title:       ${fork.title}
Forked From: ${original.title} by ${original.author.name}
Author:      ${fork.author.name}
Royalty:     ${fork.royaltyObligation.percent}% owed to original

Attribution chain preserved. 🔗
`);
  });

// ============================================================================
// PORTFOLIO
// ============================================================================

program
  .command('portfolio')
  .description('View your ships and their derivatives')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const keys = loadKeys();
    if (!keys) {
      console.log('No identity found. Run: macx init');
      process.exit(1);
    }
    
    const registry = loadRegistry();
    const myShips = registry.ships.filter(s => s.author.address === keys.address);
    const myForks = registry.forks.filter(f => f.author.address === keys.address);
    const forksOfMine = registry.forks.filter(f => f.parent.author.address === keys.address);
    
    if (opts.json) {
      console.log(JSON.stringify({ ships: myShips, forks: myForks, forksOfMine }, null, 2));
      return;
    }
    
    console.log(`
📦 Portfolio: ${keys.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Your Ships (${myShips.length})
`);
    
    myShips.forEach(ship => {
      const forkCount = registry.forks.filter(f => f.parent.id === ship.id).length;
      console.log(`  ${ship.id.slice(0, 8)}  ${ship.title}`);
      console.log(`           ${ship.createdAt.split('T')[0]} | ${forkCount} forks | ${ship.royaltyPercent}% royalty`);
      console.log('');
    });
    
    if (forksOfMine.length > 0) {
      console.log(`
🍴 Forks of Your Work (${forksOfMine.length})
`);
      forksOfMine.forEach(fork => {
        console.log(`  ${fork.id.slice(0, 8)}  ${fork.title}`);
        console.log(`           by ${fork.author.name} | owes you ${fork.royaltyObligation.percent}%`);
        console.log('');
      });
    }
    
    if (myForks.length > 0) {
      console.log(`
🔀 Your Forks (${myForks.length})
`);
      myForks.forEach(fork => {
        console.log(`  ${fork.id.slice(0, 8)}  ${fork.title}`);
        console.log(`           from ${fork.parent.title} | ${fork.royaltyObligation.percent}% to original`);
        console.log('');
      });
    }
  });

// ============================================================================
// GRAPH (Attribution Visualization)
// ============================================================================

program
  .command('graph')
  .description('Show the attribution graph')
  .option('--ship <id>', 'Focus on specific ship')
  .action((opts) => {
    const registry = loadRegistry();
    
    if (opts.ship) {
      const ship = registry.ships.find(s => s.id === opts.ship || s.id.startsWith(opts.ship));
      if (!ship) {
        console.log(`Ship not found: ${opts.ship}`);
        process.exit(1);
      }
      
      const forks = registry.forks.filter(f => f.parent.id === ship.id);
      
      console.log(`
📊 Attribution Graph: ${ship.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ship.title} (${ship.id.slice(0, 8)})
└── by ${ship.author.name}
    └── ${ship.royaltyPercent}% royalty on derivatives
`);
      
      if (forks.length > 0) {
        console.log('Derivatives:');
        forks.forEach(fork => {
          console.log(`    ├── ${fork.title} (${fork.id.slice(0, 8)})`);
          console.log(`    │   └── by ${fork.author.name}`);
        });
      }
      
      return;
    }
    
    // Full graph
    console.log(`
📊 Full Attribution Graph
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ships: ${registry.ships.length}
Forks: ${registry.forks.length}
Unique Authors: ${new Set([...registry.ships.map(s => s.author.address), ...registry.forks.map(f => f.author.address)]).size}
`);
    
    registry.ships.forEach(ship => {
      const forks = registry.forks.filter(f => f.parent.id === ship.id);
      console.log(`${ship.title} [${ship.author.name}]`);
      forks.forEach((fork, i) => {
        const prefix = i === forks.length - 1 ? '└──' : '├──';
        console.log(`  ${prefix} ${fork.title} [${fork.author.name}]`);
      });
      console.log('');
    });
  });

// ============================================================================
// VERIFY
// ============================================================================

program
  .command('verify <ship-id>')
  .description('Verify a ship\'s attribution and signature')
  .action(async (shipId) => {
    const registry = loadRegistry();
    const ship = registry.ships.find(s => s.id === shipId || s.id.startsWith(shipId));
    
    if (!ship) {
      console.log(`Ship not found: ${shipId}`);
      process.exit(1);
    }
    
    // Verify signature
    const message = JSON.stringify({
      id: ship.id,
      contentHash: ship.contentHash,
      author: ship.author.address,
      createdAt: ship.createdAt
    });
    
    try {
      const recoveredAddress = ethers.verifyMessage(message, ship.signature);
      const valid = recoveredAddress.toLowerCase() === ship.author.address.toLowerCase();
      
      console.log(`
🔍 Verification: ${ship.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID:           ${ship.id}
Author:       ${ship.author.name}
Address:      ${ship.author.address}
Content Hash: ${ship.contentHash}
Created:      ${ship.createdAt}

Signature:    ${valid ? '✅ VALID' : '❌ INVALID'}
${valid ? `Signed by:    ${recoveredAddress}` : `Expected: ${ship.author.address}\nRecovered: ${recoveredAddress}`}
`);
    } catch (e) {
      console.log(`Signature verification failed: ${e.message}`);
    }
  });

// ============================================================================
// EXPORT (For EAS/On-chain)
// ============================================================================

program
  .command('export')
  .description('Export registry for on-chain attestation')
  .option('--format <format>', 'Export format (eas|json)', 'json')
  .option('--ship <id>', 'Export specific ship')
  .action((opts) => {
    const registry = loadRegistry();
    
    if (opts.ship) {
      const ship = registry.ships.find(s => s.id === opts.ship || s.id.startsWith(opts.ship));
      if (!ship) {
        console.log(`Ship not found: ${opts.ship}`);
        process.exit(1);
      }
      
      if (opts.format === 'eas') {
        // EAS attestation format
        const attestation = {
          schema: "0x...", // Would be real schema UID
          data: {
            shipId: ship.id,
            title: ship.title,
            contentHash: ship.contentHash,
            author: ship.author.address,
            repo: ship.repo,
            royaltyPercent: ship.royaltyPercent,
            createdAt: ship.createdAt
          },
          signature: ship.signature
        };
        console.log(JSON.stringify(attestation, null, 2));
      } else {
        console.log(JSON.stringify(ship, null, 2));
      }
      return;
    }
    
    console.log(JSON.stringify(registry, null, 2));
  });

// ============================================================================
// STATS
// ============================================================================

program
  .command('stats')
  .description('Show protocol statistics')
  .action(() => {
    const registry = loadRegistry();
    const keys = loadKeys();
    
    const myShips = keys ? registry.ships.filter(s => s.author.address === keys.address) : [];
    const forksOfMine = keys ? registry.forks.filter(f => f.parent.author.address === keys.address) : [];
    
    // Calculate potential royalty exposure
    const totalRoyaltyExposure = forksOfMine.reduce((sum, f) => sum + f.royaltyObligation.percent, 0);
    
    console.log(`
📈 MACX Protocol Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Global:
  Total Ships:    ${registry.ships.length}
  Total Forks:    ${registry.forks.length}
  Unique Authors: ${new Set([...registry.ships.map(s => s.author.address)]).size}

${keys ? `Your Stats:
  Your Ships:     ${myShips.length}
  Forks of Yours: ${forksOfMine.length}
  Royalty Claims: ${totalRoyaltyExposure}% aggregate
` : 'Run "macx init" to see your stats'}
`);
  });

// ============================================================================
// HELPERS
// ============================================================================

function loadRegistry() {
  if (existsSync(REGISTRY_PATH)) {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  }
  return { ships: [], forks: [], attestations: [] };
}

function saveRegistry(registry) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function loadKeys() {
  if (existsSync(KEYS_PATH)) {
    return JSON.parse(readFileSync(KEYS_PATH, 'utf-8'));
  }
  return null;
}

function saveKeys(keys) {
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));
}

function generateId() {
  return randomBytes(16).toString('hex');
}

function hashDirectory(path) {
  // Simple content hash - in production would be more sophisticated
  try {
    const files = execSync(`find "${path}" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -100 | xargs cat 2>/dev/null | head -c 1000000`, { encoding: 'utf-8' });
    return createHash('sha256').update(files).digest('hex');
  } catch (e) {
    return createHash('sha256').update(path + Date.now()).digest('hex');
  }
}

program.parse();
