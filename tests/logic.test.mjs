/* Tests for the pure game-logic helpers embedded in index.html.
   Run: node tests/logic.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const m = html.match(/<script id="yukiita-logic">([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL: logic script block not found'); process.exit(1); }
const factory = new Function(m[1] + '\nreturn YukiitaLogic;');
const L = factory();

let passed = 0, failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('ok -', name); }
  else { failed++; console.error(`FAIL - ${name}: expected ${e}, got ${a}`); }
}
function fresh() { return { time: 20, hearts: 2, score: 0, combo: 5, maxCombo: 5, burst: 0, speed: 30 }; }

/* checkpoint: +9s, +1 heart (cap 3), combo reset, +160 score */
{
  const s = fresh(); L.applyCheckpoint(s);
  eq(s.time, 29, 'checkpoint adds +9 seconds');
  eq(s.hearts, 3, 'checkpoint restores 1 heart');
  eq(s.combo, 0, 'checkpoint resets combo');
  eq(s.score, 160, 'checkpoint adds score');
}
{
  const s = fresh(); s.hearts = 3; L.applyCheckpoint(s);
  eq(s.hearts, 3, 'hearts capped at 3');
}
/* collision: -1 heart, -0.5s, speed x0.45 */
{
  const s = fresh(); L.applyCollision(s);
  eq(s.hearts, 1, 'collision costs 1 heart');
  eq(s.time, 19.5, 'collision costs 0.5 seconds');
  eq(s.speed, 13.5, 'collision cuts speed to 45%');
}
/* near miss: combo grows, score = 100*combo cumulative, burst fills, cap 100 */
{
  const s = fresh(); s.combo = 0; s.maxCombo = 0;
  L.addNearMiss(s);
  eq([s.combo, s.score, s.burst], [1, 100, 14], 'first near miss');
  L.addNearMiss(s);
  eq([s.combo, s.score, s.burst, s.maxCombo], [2, 300, 28, 2], 'second near miss stacks combo');
  s.burst = 95; L.addNearMiss(s);
  eq(s.burst, 100, 'burst gauge capped at 100');
}
/* tuning copy-string format: fixed key order, single spaces */
{
  const t = { gravity: 22, jumpPower: 9, brake: 26, carve: 22, accel: 14, maxSpeed: 40 };
  eq(L.formatTuning(t), 'maxSpeed=40 accel=14 carve=22 brake=26 jumpPower=9 gravity=22', 'formatTuning key order and format');
}
eq(L.TUNING_KEYS, ['maxSpeed', 'accel', 'carve', 'brake', 'jumpPower', 'gravity'], 'tuning keys list');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
