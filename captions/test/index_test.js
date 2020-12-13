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
