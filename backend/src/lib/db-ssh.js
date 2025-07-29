const mysql = require('mysql2/promise');
const tunnel = require('tunnel-ssh');
require('dotenv').config();

// Pool global para reutilizar conexões
let globalPool = null;
let globalServer = null;
let isConnecting = false;
let connectionPromise = null;

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
  // Se já temos uma conexão ativa, retornar ela
  if (globalPool && globalServer) {
    console.log('🔄 Reutilizando conexão SSH existente');
    return { pool: globalPool, server: globalServer };
  }

  // Se já estamos conectando, aguardar
  if (isConnecting && connectionPromise) {
    console.log('⏳ Aguardando conexão SSH em andamento...');
    return connectionPromise;
  }

  // Criar nova conexão
  isConnecting = true;
  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('🔌 Criando nova conexão SSH...');
      const tunnelConfig = await getTunnelConfig();
      
      tunnel(tunnelConfig, (error, server) => {
        if (error) {
          console.error('❌ Erro ao criar tunnel SSH:', error);
          isConnecting = false;
          connectionPromise = null;
          reject(error);
          return;
        }

        console.log('✅ Tunnel SSH criado com sucesso na porta:', tunnelConfig.localPort);
        
        const pool = mysql.createPool({
          host: '127.0.0.1',
          port: tunnelConfig.localPort,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: process.env.DB_NAME,
          connectionLimit: 10,
          acquireTimeout: 60000,
          timeout: 60000,
          reconnect: true
        });

        // Armazenar conexões globais
        globalPool = pool;
        globalServer = server;
        isConnecting = false;
        connectionPromise = null;

        // Configurar handlers para quando o servidor for fechado
        server.on('close', () => {
          console.log('🔌 Tunnel SSH fechado');
          globalPool = null;
          globalServer = null;
        });

        server.on('error', (err) => {
          console.error('❌ Erro no tunnel SSH:', err);
          globalPool = null;
          globalServer = null;
        });

        resolve({ pool, server });
      });
    } catch (error) {
      console.error('❌ Erro ao configurar tunnel SSH:', error);
      isConnecting = false;
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
}

// Função para fechar todas as conexões (usar apenas quando necessário)
async function closeAllConnections() {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
  if (globalServer) {
    globalServer.close();
    globalServer = null;
  }
  console.log('🔌 Todas as conexões SSH fechadas');
}

module.exports = { getDbPoolWithTunnel, closeAllConnections }; 