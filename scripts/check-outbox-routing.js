/**
 * Outbox Routing Coverage Check (ADR 0023)
 *
 * Verifies that every domain event class defined under a bounded context's
 * `domain/events/` directory has an explicit entry in
 * src/queue/event-routing.ts's EVENT_QUEUE_ROUTING table — even an explicit
 * `[]` for an event with no cross-context consumer today. Fails the build if
 * a new event class ships with nobody having decided where (if anywhere) it
 * gets delivered, mirroring scripts/check-rls-policies.js's "derive
 * dynamically from source, don't hardcode" approach.
 */

const fs = require('fs');
const path = require('path');

function walk(dir, matches) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, matches);
    } else if (entry.isFile() && full.includes(`${path.sep}domain${path.sep}events${path.sep}`) && full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      matches.push(full);
    }
  }
}

const srcDir = path.join(__dirname, '../src');
const eventFiles = [];
walk(srcDir, eventFiles);

// Discover every exported event class across all domain/events/ directories.
const classPattern = /export class (\w+)/g;
const discoveredEvents = new Set();
for (const file of eventFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  let match;
  while ((match = classPattern.exec(content)) !== null) {
    discoveredEvents.add(match[1]);
  }
}

// Load the routing table (event-routing.ts is a plain TS object literal with
// no external imports besides its own types, so a light regex extraction of
// its keys is enough here without needing a full TS compile step).
const routingPath = path.join(__dirname, '../src/queue/event-routing.ts');
const routingSource = fs.readFileSync(routingPath, 'utf-8');
const routingTableMatch = routingSource.match(/EVENT_QUEUE_ROUTING[^{]*\{([\s\S]*?)\n\};/);
if (!routingTableMatch) {
  console.error('❌ Could not locate EVENT_QUEUE_ROUTING table in src/queue/event-routing.ts');
  process.exit(1);
}
const routingBody = routingTableMatch[1];
const routedEvents = new Set();
const keyPattern = /^\s*(\w+):\s*\[/gm;
let keyMatch;
while ((keyMatch = keyPattern.exec(routingBody)) !== null) {
  routedEvents.add(keyMatch[1]);
}

const unrouted = [...discoveredEvents].filter((name) => !routedEvents.has(name));

if (unrouted.length > 0) {
  console.error(`❌ Event classes with no outbox-relay routing entry: ${unrouted.join(', ')}`);
  console.error('   Add an entry (even an explicit []) to EVENT_QUEUE_ROUTING in src/queue/event-routing.ts');
  process.exit(1);
}

console.log(`✅ All ${discoveredEvents.size} discovered domain event classes have an outbox-relay routing entry`);
process.exit(0);
