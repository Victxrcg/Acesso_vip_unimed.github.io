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
const { getDbPoolWithTunnel, closeAllConnections } = require('./lib/db-ssh');

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
  }
  // Não fechar conexão - será reutilizada
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
  }
  // Não fechar conexão - será reutilizada
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
  }
  // Não fechar conexão - será reutilizada
});

// API para download de mídia
app.get('/api/media/download/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('🔍 Buscando arquivo para download:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar o arquivo com todas as colunas
    const [rows] = await pool.query(`
      SELECT * FROM media 
      WHERE file_name = ?
    `, [fileName]);
    
    if (rows.length === 0) {
      console.log('❌ Arquivo não encontrado no banco:', fileName);
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const fileData = rows[0];
    console.log('✅ Arquivo encontrado no banco');
    
    // Verificar se existe alguma coluna com dados binários
    const binaryColumns = ['file_data', 'data', 'content', 'binary_data', 'file_content'];
    let binaryData = null;
    let binaryColumn = null;
    
    for (const col of binaryColumns) {
      if (fileData[col]) {
        binaryData = fileData[col];
        binaryColumn = col;
        break;
      }
    }
    
    if (binaryData) {
      console.log(`✅ Dados binários encontrados na coluna: ${binaryColumn}`);
      
      const mimeType = fileData.mime_type || 'application/octet-stream';
      
      // Configurar headers para download
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Enviar dados binários diretamente do banco
      res.send(binaryData);
      
      console.log('✅ Download concluído para:', fileName);
    } else {
      console.log('❌ Nenhuma coluna com dados binários encontrada');
      console.log('📋 Colunas disponíveis:', Object.keys(fileData));
      
      // Fallback: tentar usar file_path se não houver dados binários
      const filePath = fileData.file_path;
      const mimeType = fileData.mime_type || 'application/octet-stream';
      
      if (fs.existsSync(filePath)) {
        console.log('📁 Usando fallback: arquivo do sistema');
        res.setHeader('Content-Type', mimeType);
        res.download(filePath);
      } else {
        return res.status(404).json({ 
          error: 'Dados do arquivo não encontrados no banco',
          availableColumns: Object.keys(fileData),
          message: 'O arquivo precisa estar armazenado como dados binários no banco'
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao fazer download:', error);
    res.status(500).json({ error: 'Erro ao fazer download', details: error.message });
  }
  // Não fechar conexão - será reutilizada
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
  }
  // Não fechar conexão - será reutilizada
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
  }
  // Não fechar conexão - será reutilizada
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
  }
  // Não fechar conexão - será reutilizada
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
  }
  // Não fechar conexão - será reutilizada
});

// Endpoint para download de áudio
app.get('/api/audios/download/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('🔍 Buscando áudio para download:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Primeiro, vamos verificar todas as colunas disponíveis
    const [columns] = await pool.query(`
      DESCRIBE media
    `);
    
    console.log('📋 Colunas disponíveis na tabela media:', columns.map(c => c.Field));
    
    // Buscar o áudio com todas as colunas
    const [mediaRows] = await pool.query(`
      SELECT * FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      console.log('❌ Áudio não encontrado no banco:', fileName);
      return res.status(404).json({ error: 'Áudio não encontrado' });
    }
    
    const audioData = mediaRows[0];
    console.log('✅ Áudio encontrado no banco');
    console.log('📄 Dados completos:', audioData);
    
    // Verificar se existe alguma coluna com dados binários
    const binaryColumns = ['file_data', 'data', 'content', 'binary_data', 'file_content'];
    let binaryData = null;
    let binaryColumn = null;
    
    for (const col of binaryColumns) {
      if (audioData[col]) {
        binaryData = audioData[col];
        binaryColumn = col;
        break;
      }
    }
    
    if (binaryData) {
      console.log(`✅ Dados binários encontrados na coluna: ${binaryColumn}`);
      
      const mimeType = audioData.mime_type || 'audio/mpeg';
      
      // Configurar headers para download
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Enviar dados binários diretamente do banco
      res.send(binaryData);
      
      console.log('✅ Download concluído para:', fileName);
    } else {
      console.log('❌ Nenhuma coluna com dados binários encontrada');
      console.log('📋 Colunas disponíveis:', Object.keys(audioData));
      return res.status(404).json({ 
        error: 'Dados do áudio não encontrados no banco',
        availableColumns: Object.keys(audioData),
        message: 'O áudio precisa estar armazenado como dados binários no banco'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao fazer download:', error);
    res.status(500).json({ error: 'Erro ao fazer download', details: error.message });
  }
  // Não fechar conexão - será reutilizada
});

// Endpoint para streaming de áudio (reprodução)
app.get('/api/audios/stream/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('🔍 Buscando áudio para streaming:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar o áudio com todas as colunas
    const [mediaRows] = await pool.query(`
      SELECT * FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      console.log('❌ Áudio não encontrado no banco:', fileName);
      return res.status(404).json({ error: 'Áudio não encontrado' });
    }
    
    const audioData = mediaRows[0];
    console.log('✅ Áudio encontrado no banco');
    
    // Verificar se existe alguma coluna com dados binários
    const binaryColumns = ['file_data', 'data', 'content', 'binary_data', 'file_content'];
    let binaryData = null;
    let binaryColumn = null;
    
    for (const col of binaryColumns) {
      if (audioData[col]) {
        binaryData = audioData[col];
        binaryColumn = col;
        break;
      }
    }
    
    if (binaryData) {
      console.log(`✅ Dados binários encontrados na coluna: ${binaryColumn}`);
      
      const mimeType = audioData.mime_type || 'audio/mpeg';
      const fileSize = audioData.file_size_bytes || binaryData.length;
      const range = req.headers.range;

      // Configurar headers CORS para streaming
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Accept-Ranges', 'bytes');

      if (range && fileSize > 0) {
        // Suporte a Range Requests (streaming)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
        const chunksize = (end-start)+1;
        
        console.log(`📊 Streaming range: ${start}-${end}/${fileSize} (${chunksize} bytes)`);
        
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeType,
        };
        res.writeHead(206, head);
        
        // Enviar apenas a parte solicitada dos dados
        const buffer = Buffer.from(binaryData);
        res.end(buffer.slice(start, end + 1));
      } else {
        // Streaming completo
        console.log(`📊 Streaming completo: ${fileSize} bytes`);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', fileSize);
        
        // Enviar todos os dados do áudio
        res.send(binaryData);
      }
      
      console.log('✅ Streaming concluído para:', fileName);
    } else {
      console.log('❌ Nenhuma coluna com dados binários encontrada');
      console.log('📋 Colunas disponíveis:', Object.keys(audioData));
      return res.status(404).json({ 
        error: 'Dados do áudio não encontrados no banco',
        availableColumns: Object.keys(audioData),
        message: 'O áudio precisa estar armazenado como dados binários no banco'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao fazer streaming:', error);
    res.status(500).json({ error: 'Erro ao fazer streaming do áudio', details: error.message });
  }
  // Não fechar conexão - será reutilizada
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
    
    // Primeiro, vamos verificar a estrutura da tabela
    const [columns] = await pool.query(`
      DESCRIBE media
    `);
    
    console.log('📋 Estrutura da tabela media:', columns);
    
    // Agora buscar o áudio com todas as colunas disponíveis
    const [mediaRows] = await pool.query(`
      SELECT * FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      return res.json({ 
        found: false, 
        message: 'Áudio não encontrado no banco',
        fileName 
      });
    }
    
    const audioData = mediaRows[0];
    
    res.json({
      found: true,
      fileName: audioData.file_name,
      mimeType: audioData.mime_type,
      fileSize: audioData.file_size_bytes,
      uploadDate: audioData.uploaded_at,
      allColumns: Object.keys(audioData),
      data: audioData,
      message: 'Áudio encontrado - verifique as colunas disponíveis'
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({ error: 'Erro no teste', details: error.message });
  }
  // Não fechar conexão - será reutilizada
});

// Rota para adicionar coluna de dados binários
app.post('/api/setup/add-binary-column', async (req, res) => {
  let pool, server;
  try {
    console.log('🔧 Adicionando coluna file_data à tabela media...');
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Verificar se a coluna já existe
    const [columns] = await pool.query(`
      DESCRIBE media
    `);
    
    const hasFileData = columns.some(col => col.Field === 'file_data');
    
    if (hasFileData) {
      console.log('✅ Coluna file_data já existe');
      return res.json({ 
        success: true, 
        message: 'Coluna file_data já existe na tabela media',
        columns: columns.map(c => c.Field)
      });
    }
    
    // Adicionar a coluna file_data
    await pool.query(`
      ALTER TABLE media 
      ADD COLUMN file_data LONGBLOB 
      COMMENT 'Dados binários do arquivo'
    `);
    
    console.log('✅ Coluna file_data adicionada com sucesso');
    
    // Verificar a estrutura atualizada
    const [updatedColumns] = await pool.query(`
      DESCRIBE media
    `);
    
    res.json({ 
      success: true, 
      message: 'Coluna file_data adicionada com sucesso',
      columns: updatedColumns.map(c => c.Field)
    });
    
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
    res.status(500).json({ 
      error: 'Erro ao adicionar coluna', 
      details: error.message 
    });
  }
  // Não fechar conexão - será reutilizada
});

// Rota para carregar arquivo de áudio no banco
app.post('/api/audios/upload/:fileName', async (req, res) => {
  let pool, server;
  try {
    const { fileName } = req.params;
    console.log('📤 Carregando arquivo de áudio:', fileName);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Primeiro, verificar se o arquivo existe no sistema
    const [mediaRows] = await pool.query(`
      SELECT file_path FROM media 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileName]);
    
    if (mediaRows.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado no banco' });
    }
    
    const filePath = mediaRows[0].file_path;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: 'Arquivo não encontrado no sistema',
        path: filePath,
        message: 'O arquivo precisa existir no sistema para ser carregado no banco'
      });
    }
    
    // Ler o arquivo como buffer
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📊 Arquivo lido: ${fileBuffer.length} bytes`);
    
    // Atualizar o registro com os dados binários
    await pool.query(`
      UPDATE media 
      SET file_data = ? 
      WHERE file_name = ? AND media_type = 'audio'
    `, [fileBuffer, fileName]);
    
    console.log('✅ Arquivo carregado no banco com sucesso');
    
    res.json({ 
      success: true, 
      message: 'Arquivo carregado no banco com sucesso',
      fileName,
      fileSize: fileBuffer.length
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar arquivo:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar arquivo', 
      details: error.message 
    });
  }
  // Não fechar conexão - será reutilizada
});

// Rota para carregar todos os arquivos de áudio no banco
app.post('/api/audios/upload-all', async (req, res) => {
  let pool, server;
  try {
    console.log('📤 Carregando todos os arquivos de áudio no banco...');
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar todos os registros de áudio
    const [mediaRows] = await pool.query(`
      SELECT file_name, file_path FROM media 
      WHERE media_type = 'audio' AND file_data IS NULL
    `);
    
    console.log(`📋 Encontrados ${mediaRows.length} arquivos para carregar`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of mediaRows) {
      try {
        const filePath = row.file_path;
        
        if (!fs.existsSync(filePath)) {
          console.log(`❌ Arquivo não encontrado: ${filePath}`);
          results.push({
            fileName: row.file_name,
            success: false,
            error: 'Arquivo não encontrado no sistema'
          });
          errorCount++;
          continue;
        }
        
        // Ler o arquivo como buffer
        const fileBuffer = fs.readFileSync(filePath);
        
        // Atualizar o registro com os dados binários
        await pool.query(`
          UPDATE media 
          SET file_data = ? 
          WHERE file_name = ?
        `, [fileBuffer, row.file_name]);
        
        console.log(`✅ ${row.file_name}: ${fileBuffer.length} bytes`);
        
        results.push({
          fileName: row.file_name,
          success: true,
          fileSize: fileBuffer.length
        });
        successCount++;
        
      } catch (error) {
        console.error(`❌ Erro ao carregar ${row.file_name}:`, error.message);
        results.push({
          fileName: row.file_name,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }
    
    console.log(`📊 Resumo: ${successCount} sucessos, ${errorCount} erros`);
    
    res.json({ 
      success: true, 
      message: `Carregamento concluído: ${successCount} sucessos, ${errorCount} erros`,
      results,
      summary: {
        total: mediaRows.length,
        success: successCount,
        error: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar arquivos:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar arquivos', 
      details: error.message 
    });
  }
  // Não fechar conexão - será reutilizada
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});

// Fechar conexões quando o servidor for encerrado
process.on('SIGINT', async () => {
  console.log('\n🔄 Encerrando servidor...');
  await closeAllConnections();
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Encerrando servidor...');
  await closeAllConnections();
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
}); 