const mysql = require('mysql2/promise');
const tunnel = require('tunnel-ssh');

const tunnelConfig = {
  username: 'portes',
  host: '82.25.69.143',
  port: 22,
  password: 'Portes@2025!@',
  dstHost: '127.0.0.1',
  dstPort: 3306,
  localHost: '127.0.0.1',
  localPort: 3307
};

tunnel(tunnelConfig, async (error, server) => {
  if (error) {
    console.error('Erro ao criar tunnel SSH:', error);
    return;
  }

  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: 'Portes@2025!@',
    database: 'auditaai'
  });

  try {
    const [rows] = await pool.query('SELECT * FROM ocorrencia LIMIT 10');
    console.log('Ocorrências encontradas:', rows);
  } catch (err) {
    console.error('Erro ao consultar o banco:', err);
  } finally {
    await pool.end();
    server.close();
  }
}); 