'use strict';
let {
  decodeTimeSpaceFast,
  decodeTimeSpace,
} = require('../index.js');

describe('decodeTimeSpaceFast matches decodeTimeSpace', () => {

  let testMatches = function testMatches(input) {
    test(input, () => {
      expect(decodeTimeSpaceFast(input)).toStrictEqual(decodeTimeSpace(input));
      expect(decodeTimeSpaceFast(input)).toMatchSnapshot();
    });
  };

  // non-timestamps
  testMatches('');
  testMatches('a');
  testMatches('1');
  testMatches('1:');
  testMatches('1:.');
  testMatches('1:. ');

  // timestamps
  testMatches('1:2');
  testMatches('1:2 ');
  testMatches('1:2a');
  testMatches('1:2.');
  testMatches('1:2.a');
  testMatches('0:1:02');
  testMatches('1:02');
  testMatches('1:02 ');
  testMatches('1:02 a');
  testMatches('1:02.');
  testMatches('1:02.a');
  testMatches('1:02.3');
  testMatches('1:.3');
  testMatches('1:.3 ');
  testMatches('1:.3 a');
});
