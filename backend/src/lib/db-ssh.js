const mysql = require('mysql2/promise');
const tunnel = require('tunnel-ssh');
require('dotenv').config();

const tunnelConfig = {
  username: process.env.SSH_USER,
  host: process.env.SSH_HOST,
  port: 22,
  password: process.env.SSH_PASSWORD,
  dstHost: process.env.DB_HOST, // deve ser 127.0.0.1
  dstPort: process.env.DB_PORT, // deve ser 3306
  localHost: '127.0.0.1',
  localPort: 3307
};

function getDbPoolWithTunnel() {
  return new Promise((resolve, reject) => {
    tunnel(tunnelConfig, (error, server) => {
      if (error) {
        reject(error);
        return;
      }
      const pool = mysql.createPool({
        host: '127.0.0.1',
        port: 3307,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
      });
      resolve({ pool, server });
    });
  });
}

module.exports = getDbPoolWithTunnel; 