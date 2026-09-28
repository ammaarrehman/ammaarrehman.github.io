#!/usr/bin/env node
// Read-only publication preflight. Reports are masked and kept in ignored tools/out.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./out/history-review/', import.meta.url));
mkdirSync(root, { recursive: true });
const repos = ['homelab', 'trading-lab', 'claude-intake-triage', 'ammaarrehman.github.io'];
const rules = [
  ['private-ip', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2})\b/g],
  ['mac', /\b(?:[a-f\d]{2}:){5}[a-f\d]{2}\b/gi],
  ['local-hostname', /\b[a-z\d][a-z\d.-]*\.(?:local|lan|internal|home\.arpa)\b/gi],
  ['named-host', /\b(?:homelab-dns-\d+|[a-z\d-]+-MacBook-Pro|[a-z\d-]+-Mac-mini)\b/gi]
];
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (status ${r.status}); no output printed for privacy`);
  return r.stdout;
}
const report = { when: new Date().toISOString(), limits: 'All fetched GitHub branch/tag histories; text blobs only for privacy patterns. Findings are candidates, not proven secrets. Historical images, unusual hostname formats, LFS and remote-only refs require separate review.', repos: [] };
for (const name of repos) {
  const path = root + name + '.git';
  run('git', ['clone', '--bare', 'https://github.com/ammaarrehman/' + name + '.git', path]);
  const refs = run('git', ['show-ref'], { cwd: path }).trim().split('\n');
  const leakPath = root + name + '-gitleaks.json';
  const leak = spawnSync('gitleaks', ['git', path, '--log-opts=--all --full-history', '--redact=100', '--ignore-gitleaks-allow', '--gitleaks-ignore-path=/dev/null', '--report-format=json', '--report-path=' + leakPath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (![0, 1].includes(leak.status)) throw new Error(`Gitleaks failed for ${name}; output withheld`);
  const findings = JSON.parse(readFileSync(leakPath, 'utf8'));
  // Retain location and rule, never matches, snippets, emails or secret values.
  const secrets = findings.map(f => ({ rule: f.RuleID, file: f.File, line: f.StartLine, commit: f.Commit, value: '[REDACTED]' }));
  writeFileSync(leakPath, JSON.stringify(secrets, null, 2));
  const objects = run('git', ['rev-list', '--objects', '--all'], { cwd: path }).trim().split('\n');
  const privacy = []; let textBlobs = 0, binaryBlobs = 0;
  for (const entry of objects) {
    const [oid, ...parts] = entry.split(' '), file = parts.join(' ');
    if (!file || run('git', ['cat-file', '-t', oid], { cwd: path }).trim() !== 'blob') continue;
    const body = run('git', ['cat-file', 'blob', oid], { cwd: path });
    if (body.includes('\0')) { binaryBlobs++; continue; }
    textBlobs++;
    for (const [i, line] of body.split('\n').entries()) for (const [category, regex] of rules) {
      for (const match of line.matchAll(regex)) privacy.push({ category, file, blob: oid, line: i + 1, value: '[MASKED]', fingerprint: createHash('sha256').update(match[0]).digest('hex').slice(0, 12) });
    }
  }
  const item = { name, refs, commits: Number(run('git', ['rev-list', '--all', '--count'], { cwd: path }).trim()), textBlobs, binaryBlobs, secrets, privacy };
  report.repos.push(item);
  writeFileSync(root + 'report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, commits: item.commits, secretCandidates: secrets.length, privacyCandidates: privacy.length, textBlobs, binaryBlobs }));
}
