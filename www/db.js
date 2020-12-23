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

    await update(client, '0-create-private-captions', `
      -- Captions intended for file-sharing use case.
      CREATE TABLE private_captions(
        id SERIAL,

        -- 32 bytes in base64 is 44 bytes
        -- Used to validate deletion:
        deletion_public_key_base64 varchar(100),

        -- Encrypted data. It could be garbage or anything really.
        encryption_nonce varchar(100) NOT NULL,
        encrypted_data varchar(1048576) NOT NULL,
        -- Expiration time:
        delete_at timestamp NOT NULL,
        PRIMARY KEY(id),
        UNIQUE(deletion_public_key_base64),
        UNIQUE(encryption_nonce)
      );
    `);

    await update(client, '1-create-public-captions', `
      CREATE TABLE public_captions(
        -- 11 bytes (int64 in ~base64?)
        video_id varchar(100),
        -- For maintaining insertion order:
        seq SERIAL,

        -- 32 bytes in base64 is 44 bytes
        -- Used to authorize deletion.
        deletion_public_key_base64 varchar(100) NOT NULL,

        -- should be usually 2 or 5 bytes
        language varchar(10) NOT NULL,
        -- SRT UTF-8 string. Should be equal to private_captions.encrypted_data's size.
        srt varchar(1048576) NOT NULL,
        PRIMARY KEY(video_id, seq),
        UNIQUE(deletion_public_key_base64)
      );
    `);
  } finally {
    client.release();
  }
}

async function gc() {
  await pool.query(`
    DELETE FROM private_captions AS t
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
  }
}

module.exports = {
  init, 
  updateSchema,
  withClient,
  query,
  gc,
};
