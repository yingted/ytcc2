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
