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

module.exports = {
  init, 
  query,
};
