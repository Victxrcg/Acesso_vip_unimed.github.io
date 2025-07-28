const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const lotesRoutes = require('./routes/lotesRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const allowedOrigins = [
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://172.23.96.1:5175',
    'http://10.100.20.241:5175',
    'https://acessovipunimedgithubio-production.up.railway.app'
  ];
// const pdfsRoutes = require('./routes/pdfsRoutes');
const bcrypt = require('bcrypt');
const getDbPoolWithTunnel = require('./lib/db-ssh');

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    console.log('🌐 Requisição de origem:', origin);
    
    // Permite requisições sem origem (ex: ferramentas internas, curl, etc)
    if (!origin) {
      console.log('✅ Permitindo requisição sem origem');
      return callback(null, true);
    }
    
    // Durante desenvolvimento, permitir qualquer origem local
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('172.23.96.1') || origin.includes('10.100.20.241')) {
      console.log('✅ Permitindo origem local:', origin);
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('❌ Origem não permitida:', origin);
      const msg = 'A origem não é permitida pelo CORS.';
      return callback(new Error(msg), false);
    }
    
    console.log('✅ Origem permitida:', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Range', 'Accept-Ranges']
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
    const [rows] = await pool.query('SELECT * FROM ocorrencia');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar ocorrências', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// API para buscar mídia de uma ocorrência específica
app.get('/api/ocorrencias/:id/media', async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [rows] = await pool.query(`
      SELECT 
        id,
        ocorrencia_id,
        media_type,
        file_name,
        file_path,
        mime_type,
        file_size_bytes,
        uploaded_at
      FROM media 
      WHERE ocorrencia_id = ?
      ORDER BY uploaded_at DESC
    `, [id]);
    
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar mídia da ocorrência:', error);
    res.status(500).json({ error: 'Erro ao buscar mídia', details: error.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// API para download de mídia
app.get('/api/media/download/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [rows] = await pool.query(`
      SELECT file_path, mime_type 
      FROM media 
      WHERE file_name = ?
    `, [fileName]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const filePath = rows[0].file_path;
    const mimeType = rows[0].mime_type || 'application/octet-stream';
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no sistema' });
    }
    
    res.setHeader('Content-Type', mimeType);
    res.download(filePath);
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    res.status(500).json({ error: 'Erro ao fazer download', details: error.message });
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

// Endpoint para listar áudios de um cliente
app.get('/api/audios/:cpf', async (req, res) => {
  let pool, server;
  try {
    const { cpf } = req.params;
    console.log('🔍 Buscando áudios para CPF:', cpf);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Primeiro, encontrar a ocorrência pelo CPF
    const [ocorrencias] = await pool.query(
      'SELECT id FROM ocorrencia WHERE cpf_cnpj = ? LIMIT 1',
      [cpf]
    );
    
    if (ocorrencias.length === 0) {
      console.log('❌ Nenhuma ocorrência encontrada para CPF:', cpf);
      return res.json([]);
    }
    
    const ocorrenciaId = ocorrencias[0].id;
    console.log('✅ Ocorrência encontrada, ID:', ocorrenciaId);
    
    // Buscar mídia de áudio para essa ocorrência
    const [mediaRows] = await pool.query(`
      SELECT 
        id,
        ocorrencia_id,
        media_type,
        file_name,
        file_path,
        mime_type,
        file_size_bytes,
        uploaded_at
      FROM media 
      WHERE ocorrencia_id = ? AND media_type = 'audio'
      ORDER BY uploaded_at DESC
    `, [ocorrenciaId]);
    
    console.log(`📋 Total de áudios encontrados: ${mediaRows.length}`);
    
    // Transformar para o formato esperado pelo frontend
    const audios = mediaRows.map(row => ({
      id: String(row.id),
      fileName: row.file_name,
      originalName: row.file_name,
      fileSize: row.file_size_bytes || 0,
      uploadDate: row.uploaded_at,
      description: '',
      fileType: row.mime_type || 'audio/mpeg',
      duration: null
    }));
    
    res.json(audios);
  } catch (err) {
    console.error('❌ Erro ao listar áudios:', err);
    res.status(500).json({ error: 'Erro ao listar áudios', details: err.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Endpoint para download de áudio
app.get('/api/audios/download/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('🔍 Buscando arquivo para download:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [mediaRows] = await pool.query(`
      SELECT file_path, mime_type 
      FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      console.log('❌ Arquivo não encontrado no banco:', fileName);
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const filePath = mediaRows[0].file_path;
    const mimeType = mediaRows[0].mime_type || 'audio/mpeg';
    
    console.log('📁 Caminho do arquivo:', filePath);
    console.log('📄 Tipo MIME:', mimeType);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado no sistema:', filePath);
      return res.status(404).json({ error: 'Arquivo não encontrado no sistema' });
    }
    
    console.log('✅ Arquivo encontrado, iniciando download...');
    
    // Configurar headers para download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Usar stream para arquivos grandes
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Fechar conexões após o download
    fileStream.on('end', () => {
      console.log('✅ Download concluído para:', fileName);
      if (pool) pool.end();
      if (server) server.close();
    });
    
    fileStream.on('error', (error) => {
      console.error('❌ Erro no stream do arquivo:', error);
      res.status(500).json({ error: 'Erro ao fazer download', details: error.message });
      if (pool) pool.end();
      if (server) server.close();
    });
    
  } catch (error) {
    console.error('❌ Erro ao fazer download:', error);
    res.status(500).json({ error: 'Erro ao fazer download', details: error.message });
    if (pool) await pool.end();
    if (server) server.close();
  }
});

// Endpoint para streaming de áudio (reprodução)
app.get('/api/audios/stream/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('🔍 Buscando arquivo para streaming:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [mediaRows] = await pool.query(`
      SELECT file_path, mime_type 
      FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      console.log('❌ Arquivo não encontrado no banco:', fileName);
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const filePath = mediaRows[0].file_path;
    const mimeType = mediaRows[0].mime_type || 'audio/mpeg';
    
    console.log('📁 Caminho do arquivo:', filePath);
    console.log('📄 Tipo MIME:', mimeType);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado no sistema:', filePath);
      return res.status(404).json({ error: 'Arquivo não encontrado no sistema' });
    }

    console.log('✅ Arquivo encontrado, iniciando streaming...');

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Configurar headers CORS para streaming
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    if (range) {
      // Suporte a Range Requests (streaming)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
      const chunksize = (end-start)+1;
      
      console.log(`📊 Streaming range: ${start}-${end}/${fileSize} (${chunksize} bytes)`);
      
      const file = fs.createReadStream(filePath, {start, end});
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      };
      res.writeHead(206, head);
      file.pipe(res);
      
      // Fechar conexões após o streaming
      file.on('end', () => {
        console.log('✅ Streaming concluído para:', fileName);
        if (pool) pool.end();
        if (server) server.close();
      });
      
      file.on('error', (error) => {
        console.error('❌ Erro no stream do arquivo:', error);
        if (pool) pool.end();
        if (server) server.close();
      });
    } else {
      // Streaming completo
      console.log(`📊 Streaming completo: ${fileSize} bytes`);
      
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      
      const file = fs.createReadStream(filePath);
      file.pipe(res);
      
      // Fechar conexões após o streaming
      file.on('end', () => {
        console.log('✅ Streaming completo concluído para:', fileName);
        if (pool) pool.end();
        if (server) server.close();
      });
      
      file.on('error', (error) => {
        console.error('❌ Erro no stream do arquivo:', error);
        if (pool) pool.end();
        if (server) server.close();
      });
    }
  } catch (error) {
    console.error('❌ Erro ao fazer streaming:', error);
    res.status(500).json({ error: 'Erro ao fazer streaming do áudio', details: error.message });
    if (pool) await pool.end();
    if (server) server.close();
  }
});

app.get('/', (req, res) => {
  res.send('API AuditaAI rodando!');
});

// Rota de teste para verificar CORS
app.get('/api/cors-test', (req, res) => {
  console.log('🧪 Teste de CORS solicitado');
  console.log('🌐 Origem:', req.headers.origin);
  console.log('📋 Headers:', req.headers);
  
  res.json({ 
    message: 'CORS funcionando!', 
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
});

// Rota de teste para verificar áudios
app.get('/api/audios/test/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('🧪 Teste de áudio para:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [mediaRows] = await pool.query(`
      SELECT file_path, mime_type, file_size_bytes 
      FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      return res.json({ 
        found: false, 
        message: 'Arquivo não encontrado no banco',
        fileName 
      });
    }
    
    const filePath = mediaRows[0].file_path;
    const exists = fs.existsSync(filePath);
    
    res.json({
      found: true,
      exists: exists,
      fileName,
      filePath,
      mimeType: mediaRows[0].mime_type,
      fileSize: mediaRows[0].file_size_bytes,
      message: exists ? 'Arquivo encontrado e acessível' : 'Arquivo não encontrado no sistema'
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({ error: 'Erro no teste', details: error.message });
  } finally {
    if (pool) await pool.end();
    if (server) server.close();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
}); 