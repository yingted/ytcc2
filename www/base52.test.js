let base52 = require('./base52.js');

it('reencodes 1,2,3', () => {
  let x = new Uint8Array([1, 2, 3]);
  expect(base52.decode(3, base52.encode(3, x))).toStrictEqual(x);
});

it('encodes the empty array to the empty string', () => {
  expect(base52.encode(0, new Uint8Array([]))).toStrictEqual('');
  expect(base52.decode(0, '')).toStrictEqual(new Uint8Array([]));
});

it('encodes 0 to the empty string', () => {
  expect(base52.encode(3, new Uint8Array([0, 0, 0]))).toStrictEqual('');
  expect(base52.decode(3, '')).toStrictEqual(new Uint8Array([0, 0, 0]));
});

it('encodes 1 to 1', () => {
  expect(base52.encode(3, new Uint8Array([0, 0, 1]))).toStrictEqual('1');
  expect(base52.decode(3, '1')).toStrictEqual(new Uint8Array([0, 0, 1]));
});

it('encodes a 51 to a single character', () => {
  expect(base52.encode(1, new Uint8Array([51]))).toStrictEqual('z');
  expect(base52.decode(1, 'z')).toStrictEqual(new Uint8Array([51]));
});

it('encodes a 52 to multiple characters', () => {
  expect(base52.encode(1, new Uint8Array([52]))).toStrictEqual('10');
  expect(base52.decode(1, '10')).toStrictEqual(new Uint8Array([52]));
});

it('invalid length to throw', () => {
  expect(() => {
    base52.encode(2, new Uint8Array([0, 0, 1]));
  }).toThrow(RangeError);
  expect(() => {
    base52.encode(4, new Uint8Array([0, 0, 1]));
  }).toThrow(RangeError);
  expect(() => {
    base52.decode(2, 'zzz');
  }).toThrow(RangeError);
});
