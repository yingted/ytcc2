/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {generateAsync, verifyAsync} = require('./pow.js');
const base52 = require('./base52.js');
const nacl = require('tweetnacl');

const nonce = base52.encode(192 / 8, nacl.randomBytes(192 / 8));
const iters = 1;
const length = 128;

it('verifies good proofs', async () => {
  let pow = await generateAsync(nonce, iters, length);
  await verifyAsync(nonce, iters, length, pow);
});

it('usually rejects bad proofs', async () => {
  let pow = await generateAsync('reused nonce', iters, length);

  // Give it a few runs:
  let total = 100, failed = 0;
  for (let i = 0; i < total; ++i) {
    try {
      await verifyAsync(nonce, iters, length, pow);
    } catch (e) {
      ++failed;
    }
  }

  // Most should have been rejected:
  expect(failed).toBeGreaterThanOrEqual(75);
});
