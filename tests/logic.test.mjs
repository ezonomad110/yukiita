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
/* tuning copy-string format: fixed key order, single spaces, cruise after accel */
{
  const t = { gravity: 70, jumpPower: 20, brake: 80, carve: 80, cruise: 140, accel: 120, maxSpeed: 240 };
  eq(L.formatTuning(t), 'maxSpeed=240 accel=120 cruise=140 carve=80 brake=80 jumpPower=20 gravity=70', 'formatTuning key order and format');
}
eq(L.TUNING_KEYS, ['maxSpeed', 'accel', 'cruise', 'carve', 'brake', 'jumpPower', 'gravity'], 'tuning keys list');

/* gate pass: opening is |latX - off| <= 4 */
{
  eq(L.isGatePass(0, 0), true, 'gate pass centered');
  eq(L.isGatePass(4, 0), true, 'gate pass at edge (+4)');
  eq(L.isGatePass(-4, 0), true, 'gate pass at edge (-4)');
  eq(L.isGatePass(5, 0), false, 'gate miss just outside');
  eq(L.isGatePass(17, 14), true, 'gate pass offset gate');
  eq(L.isGatePass(18, 14), true, 'gate pass offset gate at edge');
  eq(L.isGatePass(19, 14), false, 'gate miss offset gate');
  eq(L.isGatePass(-20, -18), true, 'gate pass negative offset');
  eq(L.isGatePass(10, -14), false, 'gate miss wrong side');
}
/* gate side label for the HUD */
{
  eq(L.gateSideLabel(-14), '左寄り', 'gate side left');
  eq(L.gateSideLabel(-4), '左寄り', 'gate side left (beyond -3)');
  eq(L.gateSideLabel(0), '中央', 'gate side center');
  eq(L.gateSideLabel(3), '中央', 'gate side center (at +3)');
  eq(L.gateSideLabel(11), '右寄り', 'gate side right');
}
/* effective cap: cruise coasting, tuck x1.12, burst x1.35 (burst wins) */
{
  const t = { maxSpeed: 200, cruise: 120 };
  eq(L.effectiveCap(t, false, false), 120, 'cap is cruise when coasting');
  eq(Math.round(L.effectiveCap(t, true, false) * 100) / 100, 224, 'cap is maxSpeed x1.12 when tucking');
  eq(Math.round(L.effectiveCap(t, false, true) * 100) / 100, 270, 'cap is maxSpeed x1.35 in burst');
  eq(Math.round(L.effectiveCap(t, true, true) * 100) / 100, 270, 'burst cap wins over tuck');
}
/* rhythm carve: alternation within 1.6s chains, late alternation restarts */
{
  const st = { chain: 0, dir: 0, time: -9 };
  eq(L.updateCarve(st, 1, 0), 0, 'first carve direction gives no chain');
  eq(L.updateCarve(st, -1, 1.0), 1, 'quick alternation starts chain x1');
  eq(L.updateCarve(st, 1, 2.0), 2, 'second quick alternation chains x2');
  eq(L.updateCarve(st, 1, 2.4), 0, 'same direction does not chain');
  eq(L.updateCarve(st, -1, 4.2), 1, 'late alternation (>1.6s) restarts at x1');
  eq(L.updateCarve(st, 0, 4.5), 0, 'no input does not chain');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
