import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocalForwards } from './shared-tunnel.js';

test('parses ssh -G localforward lines, ignoring everything else', () => {
  const out = [
    'user jack',
    'hostname jump.sugarwish.com',
    'localforward 13306 [database-1.cqqg1tfyyubp.us-east-1.rds.amazonaws.com]:3306',
    'localforward 13316 [5.161.233.240]:3306',
    'localforward 127.0.0.1:13336 5.78.187.176:3306',
    'serveraliveinterval 30',
  ].join('\n');
  assert.deepEqual(parseLocalForwards(out), [
    { localPort: 13306, host: 'database-1.cqqg1tfyyubp.us-east-1.rds.amazonaws.com', port: 3306 },
    { localPort: 13316, host: '5.161.233.240', port: 3306 },
    { localPort: 13336, host: '5.78.187.176', port: 3306 },
  ]);
});

test('no forwards yields an empty list', () => {
  assert.deepEqual(parseLocalForwards('hostname jump.sugarwish.com\n'), []);
});
