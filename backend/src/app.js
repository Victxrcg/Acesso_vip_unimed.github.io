const express = require('express');
const cors = require('cors');
require('dotenv').config();

const lotesRoutes = require('./routes/lotesRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const allowedOrigins = [

    'http://localhost:5175', // Adicione esta linha
  ];
// const pdfsRoutes = require('./routes/pdfsRoutes');
const bcrypt = require('bcrypt');
const getDbPoolWithTunnel = require('./lib/db-ssh');

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origem (ex: ferramentas internas, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'A origem não é permitida pelo CORS.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/lotes_cancelamento', lotesRoutes);
app.use('/api/lotes_cancelamento', clientesRoutes); // clientes por lote
// app.use('/api', pdfsRoutes); // pdfs e download

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, nome, status FROM usuarios WHERE username = ? AND status = "ativo" LIMIT 1',
      [usuario]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });
    }
    const user = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, user.password_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });
    }
    // Não envie o hash para o frontend!
    delete user.password_hash;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao autenticar.', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Nova rota para dashboard: ocorrencias
app.get('/api/ocorrencias', async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query('SELECT * FROM ocorrencias');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar ocorrências', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Nova rota para todos os clientes (similar ao modelo Python)
app.get('/api/clientes', async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query(`
      SELECT cc.*, 
             lc.nome_arquivo,
             lc.data_lote,
             COUNT(cp.id) as pdf_count,
             GROUP_CONCAT(DISTINCT cp.tipo) as pdf_tipos
      FROM clientes_cancelamentos cc
      LEFT JOIN lotes_cancelamento lc ON cc.lote_id = lc.id
      LEFT JOIN cancelamento_pdfs cp ON cc.id = cp.cancelamento_id
      GROUP BY cc.id
      ORDER BY cc.id DESC
      LIMIT 100
    `);
    
    // Processar os tipos de PDF (similar ao Python)
    const clientes = rows.map(row => ({
      ...row,
      pdf_tipos: row.pdf_tipos ? row.pdf_tipos.split(',') : []
    }));
    
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar clientes', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Buscar clientes por CPF, nome ou contrato (similar ao Python)
app.get('/api/clientes/buscar', async (req, res) => {
  const query = req.query.q?.trim();
  
  if (!query) {
    return res.status(400).json({ error: 'Query de busca é obrigatória' });
  }
  
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query(`
      SELECT cc.*, 
             lc.nome_arquivo,
             lc.data_lote,
             COUNT(cp.id) as pdf_count,
             GROUP_CONCAT(DISTINCT cp.tipo) as pdf_tipos
      FROM clientes_cancelamentos cc
      LEFT JOIN lotes_cancelamento lc ON cc.lote_id = lc.id
      LEFT JOIN cancelamento_pdfs cp ON cc.id = cp.cancelamento_id
      WHERE cc.cpf_cnpj LIKE ? 
         OR cc.nome_cliente LIKE ? 
         OR cc.numero_contrato LIKE ?
      GROUP BY cc.id
      ORDER BY cc.id DESC
      LIMIT 50
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    
    const clientes = rows.map(row => ({
      ...row,
      pdf_tipos: row.pdf_tipos ? row.pdf_tipos.split(',') : []
    }));
    
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: 'Erro na busca', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Estatísticas de clientes (similar ao Python)
app.get('/api/clientes/stats', async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Estatísticas gerais
    const [statsResult] = await pool.query(`
      SELECT 
        COUNT(*) as total_cancelamentos,
        COUNT(DISTINCT cpf_cnpj) as total_cpfs,
        SUM(valor_atual) as total_valor,
        AVG(dias_atraso) as media_atraso
      FROM clientes_cancelamentos
    `);
    
    // Estatísticas de PDFs
    const [pdfStats] = await pool.query(`
      SELECT 
        tipo,
        COUNT(*) as count
      FROM cancelamento_pdfs
      GROUP BY tipo
    `);
    
    // Top clientes
    const [topClientes] = await pool.query(`
      SELECT 
        nome_cliente,
        COUNT(*) as total_cancelamentos,
        SUM(valor_atual) as total_valor
      FROM clientes_cancelamentos
      GROUP BY nome_cliente
      ORDER BY total_cancelamentos DESC
      LIMIT 10
    `);
    
    res.json({
      stats: statsResult[0],
      pdf_stats: pdfStats,
      top_clientes: topClientes
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Rota para salvar decisão de auditoria (similar ao Python)
app.post('/api/audit', async (req, res) => {
  const { tipo, melhoria } = req.body;
  
  try {
    // Por enquanto, apenas logar a decisão
    console.log('Decisão de auditoria:', { tipo, melhoria, timestamp: new Date() });
    
    // Aqui você pode salvar no banco de dados se quiser
    // Exemplo: criar tabela audit_decisions
    
    res.json({ success: true, message: 'Decisão salva com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar decisão', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('API AuditaAI rodando!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
}); 