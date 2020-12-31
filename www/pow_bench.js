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

/**
 * Run with:
 * taskset -c 0 node pow_bench.js
 */
const {generateAsync, verifyAsync} = require('./pow.js');
const base52 = require('./base52.js');
const nacl = require('tweetnacl');

// Begin benchmark boilerplate:
const { performance, PerformanceObserver } = require("perf_hooks");

const perfObserver = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(entry);
  });
});

perfObserver.observe({ entryTypes: ["measure"], buffer: true });
// End benchmark boilerplate.

(async function main() {
  const nonce = base52.encode(192 / 8, nacl.randomBytes(192 / 8));
  const iters = 100;
  const length = 8192;

  performance.mark('a');
  let pow = await generateAsync(nonce, iters, length);
  performance.mark('b');
  await verifyAsync(nonce, iters, length, pow);
  performance.mark('c');

  performance.measure('generate', 'a', 'b');
  performance.measure('verify', 'b', 'c');
})();
