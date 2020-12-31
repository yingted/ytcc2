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
 * @jest-environment node
 */
const permissions = require('./permissions.js');
require('jsdom-global')();

describe('writer', () => {
  let writer = new permissions.Writer('secret');

  it('encrypts messages', () => {
    let plaintext = 'hello';
    let ciphertext = writer.encrypt(plaintext);
    expect(ciphertext).toEqual(expect.not.stringMatching('hello'));
    expect(writer.decrypt(ciphertext)).toEqual(plaintext);
    expect(writer.reader.decrypt(ciphertext)).toEqual(plaintext);
  });

  it('signs messages to itself', () => {
    let plaintext = 'hello';
    let signature = writer.sign(plaintext);
    expect(signature).toEqual(expect.not.stringMatching('hello'));
    writer.verify(plaintext, signature);
    writer.reader.verify(plaintext, signature);
    writer.public.verify(plaintext, signature);
  });

  it('has a fingerprint', () => {
    expect(typeof writer.fingerprint).toBe('string');
  });

  it('verifies itself', () => {
    writer.setWriterPublic(permissions.WriterPublic.fromJSON(
      JSON.parse(JSON.stringify(
        writer.public.toJSON()))));
  });
});

describe('reader', () => {
  let writer = new permissions.Writer('secret');
  let plaintext = 'hello';
  let ciphertext = writer.encrypt(plaintext);
  let reader = new permissions.Reader(writer.reader.secret);

  it('verifies writer', () => {
    expect(() => {
      reader.decrypt(ciphertext);
    }).toThrow(Error);

    reader.setWriterPublic(permissions.WriterPublic.fromJSON(
      JSON.parse(JSON.stringify(
        writer.public.toJSON()))));
    expect(reader.decrypt(ciphertext)).toBe(plaintext);
  });

  it('has a fingerprint', () => {
    expect(typeof reader.fingerprint).toBe('string');
  });
});

describe('writer public', () => {
  let writer = new permissions.Writer('secret');
  let plaintext = 'hello';
  let signature = writer.sign(plaintext);
  let writerPublic = permissions.WriterPublic.fromJSON(
    JSON.parse(JSON.stringify(
      writer.public.toJSON())));

  it('verifies signatures', () => {
    writerPublic.verify(plaintext, signature);
  });

  it('has a fingerprint', () => {
    expect(typeof writerPublic.fingerprint).toBe('string');
  });
});
