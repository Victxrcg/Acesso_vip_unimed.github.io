const mysql = require('mysql2/promise');
const tunnel = require('tunnel-ssh');
require('dotenv').config();

// Função para encontrar uma porta disponível
function findAvailablePort(startPort = 3307) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

const getTunnelConfig = async () => {
  const localPort = await findAvailablePort();
  
  return {
    username: process.env.SSH_USER,
    host: process.env.SSH_HOST,
    port: 22,
    password: process.env.SSH_PASSWORD,
    dstHost: process.env.DB_HOST, // deve ser 127.0.0.1
    dstPort: process.env.DB_PORT, // deve ser 3306
    localHost: '127.0.0.1',
    localPort: localPort
  };
};

async function getDbPoolWithTunnel() {
  return new Promise(async (resolve, reject) => {
    try {
      const tunnelConfig = await getTunnelConfig();
      
      tunnel(tunnelConfig, (error, server) => {
        if (error) {
          reject(error);
          return;
        }
        const pool = mysql.createPool({
          host: '127.0.0.1',
          port: tunnelConfig.localPort,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: process.env.DB_NAME
        });
        resolve({ pool, server });
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = getDbPoolWithTunnel; 