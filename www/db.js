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

// For testing:
// $ node --experimental-repl-await -e "db = require('./db.js'); init = db.init();" -i
// > await init
// > await db.query('SHOW TABLES')
const config = require('./config_trusted.js');
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: config.postgres_connection_string,
});

async function init() {
  let client = await pool.connect();
  client.release();
}

function query(text, params) {
  return pool.query(text, params);
}

async function update(client, name, query) {
  let rollback = true;
  try {
    await client.query('BEGIN');
    let res = await client.query('SELECT 1 FROM schema_changes WHERE name=$1', [name]);
    if (res.rows.length === 0) {
      console.info('updating schema:', name);
      await client.query({name, text: query});
      await client.query('INSERT INTO schema_changes(name) VALUES($1)', [name]);
    }
    await client.query('COMMIT');
    rollback = false;
  } finally {
    if (rollback) await client.query('ROLLBACK');
  }
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

async function updateSchema() {
  let client = await pool.connect();
  try {
    let res = await client.query('SHOW SERVER_ENCODING');
    assert(res.rows[0].server_encoding === 'UTF8', `SHOW SERVER_ENCODING must be UTF8: ${JSON.stringify(res.rows[0].server_encoding)}`);
    res = await client.query('SHOW CLIENT_ENCODING');
    assert(res.rows[0].client_encoding === 'UTF8', `SHOW CLIENT_ENCODING must be UTF8: ${JSON.stringify(res.rows[0].client_encoding)}`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_changes(name varchar(1000));
    `);

    await update(client, '0-create-captions', `
      -- Captions table has 2 permissions: read and write
      -- Write: insert, update, or delete the captions
      -- Read: report the captions for abuse
      -- Anyone can retrieve the encrypted data

      -- Every client (reader/writer) can derive 3 keys supported by tweetnacl-js:
      -- - symmetric
      -- - asymmetric signing
      -- - asymmetric encryption
      -- We store all public keys.

      -- Here's what each operation needs:
      -- Lookup: public keys
      -- GC: delete_at
      -- Report abuse: verify read private keys (they still need to send me a link)
      -- Update/delete: verify write private keys
      -- Read: decrypt with write private keys

      CREATE TABLE captions(
        -- For lookup:
        write_fingerprint varchar(100),
        read_fingerprint varchar(100),

        -- All serialized pubkeys (WriterPublic):
        pubkeys varchar(1000),

        -- Encrypted data. It could be garbage or anything really.
        encrypted_data varchar(1048576) NOT NULL,

        -- Expiration time:
        delete_at timestamp NOT NULL,

        PRIMARY KEY(write_fingerprint),
        UNIQUE(read_fingerprint));
    `);

    await update(client, '1-create-nonces', `
      -- Randomly-generated values that haven't been used.
      CREATE TABLE nonces(
        nonce varchar(100),
        delete_at timestamp NOT NULL,
        PRIMARY KEY(nonce));
    `);

    await update(client, '2-add-popups', `
      ALTER TABLE captions ADD COLUMN popups integer DEFAULT 0;
    `);
  } finally {
    client.release();
  }
}

async function gc() {
  await pool.query(`
    DELETE FROM captions AS t
    WHERE t.delete_at <= now();
  `);
  await pool.query(`
    DELETE FROM nonces AS t
    WHERE t.delete_at <= now();
  `);
}

async function withClient(func) {
  let client = await pool.connect();
  let rollback = true;
  try {
    await client.query('BEGIN');
    await func(client);
    await client.query('COMMIT');
    rollback = false;
  } finally {
    if (rollback) await client.query('ROLLBACK');
    client.release();
  }
}

module.exports = {
  init, 
  updateSchema,
  withClient,
  query,
  gc,
};
