require('dotenv').config();
console.log('🔧 Carregando variáveis de ambiente...');
console.log('📁 Diretório atual:', process.cwd());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'https://acesso-vip-unimed-github-io.vercel.app',
  'https://acesso-vip-unimed-github-io.vercel.app/customers',
  'https://acesso-vip-unimed-github-io.vercel.app/login',
  'https://acesso-vip-unimed-github-io.vercel.app/dashboard',
  'https://auditaai.portes.com.br',
  'https://auditaai.portes.com.br/customers',
  'https://auditaai.portes.com.br/login',
  'https://auditaai.portes.com.br/dashboard',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requests sem origin (ex: mobile, curl)
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

app.get('/', (req, res) => {
  console.log('📡 GET / - Página inicial');
  res.send('API Unimed VIP rodando! Versão: 1.0.0');
});

// Endpoint para testar configuração
app.get('/api/test-config', (req, res) => {
  console.log('📡 GET /api/test-config - Testando configuração');
  
  const requiredEnvVars = ['SSH_USER', 'SSH_HOST', 'SSH_PASSWORD', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  const config = {};
  
  console.log('🔍 Verificando variáveis de ambiente...');
  requiredEnvVars.forEach(varName => {
    const hasValue = !!process.env[varName];
    config[varName] = hasValue ? '✅ Configurado' : '❌ Não configurado';
    console.log(`  ${varName}: ${hasValue ? '✅' : '❌'} ${hasValue ? '(valor presente)' : '(valor ausente)'}`);
  });
  
  const allConfigured = requiredEnvVars.every(varName => process.env[varName]);
  console.log(`🎯 Todas configuradas: ${allConfigured ? '✅' : '❌'}`);
  
  res.json({
    message: 'Status da configuração',
    config,
    allConfigured,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/clientes', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'data', 'clientes.yaml');
    console.log('Caminho do arquivo clientes.yaml:', filePath);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    console.log('Conteúdo lido do clientes.yaml (primeiros 500 caracteres):', fileContents.slice(0, 500));
    const data = yaml.load(fileContents);
    res.json(data);
  } catch (err) {
    console.error('Erro ao ler clientes.yaml:', err);
    res.status(500).json({ error: 'Erro ao ler clientes.yaml', details: err.message, stack: err.stack });
  }
});

// Endpoint de login (POST)
app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'vip' && senha === 'unimedvip2024') {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
  }
});

// Novo endpoint GET para /login (mensagem amigável)
app.get('/login', (req, res) => {
  res.status(405).json({ error: 'Use POST para autenticação.' });
});

function normalizaCpfCnpj(str) {
  return str.replace(/[\.\-\/]/g, '').replace(/\s/g, '');
}

app.get('/download/:cpfcnpj', (req, res) => {
  const cpfcnpj = normalizaCpfCnpj(req.params.cpfcnpj);
  const audiosDir = path.join(process.cwd(), 'data', 'audios');
  const files = fs.readdirSync(audiosDir);

  // Procura arquivo que começa com o cpfcnpj normalizado
  const audioFile = files.find(f => normalizaCpfCnpj(f).startsWith(cpfcnpj));
  if (audioFile) {
    res.sendFile(path.join(audiosDir, audioFile));
  } else {
    res.status(404).send('Áudio não encontrado');
  }
});

// Endpoint para listar anexos de um cliente
app.get('/api/attachments/:cpf', (req, res) => {
  try {
    const { cpf } = req.params;
    const attachmentsDir = path.join(process.cwd(), 'data', 'attachments');
    
    console.log('🔍 Buscando anexos para CPF:', cpf);
    console.log('📁 Diretório de anexos:', attachmentsDir);
    
    if (!fs.existsSync(attachmentsDir)) {
      console.log('❌ Diretório de anexos não existe');
      return res.json([]);
    }

    const files = fs.readdirSync(attachmentsDir);
    console.log('📄 Arquivos encontrados no diretório:', files);
    
    const attachments = [];
    // Normaliza apenas se for CNPJ (14 dígitos)
    let cpfOuCnpjBusca = cpf;
    if (cpf.replace(/\D/g, '').length === 14) {
      cpfOuCnpjBusca = normalizaCpfCnpj(cpf);
    }

    files.forEach(file => {
      // Pega o prefixo do arquivo até o primeiro underline
      const filePrefix = file.split('_')[0];
      const filePrefixBusca = normalizaCpfCnpj(filePrefix);
      if (filePrefixBusca === cpfOuCnpjBusca) {
        const filePath = path.join(attachmentsDir, file);
        const stats = fs.statSync(filePath);
        const extension = path.extname(file);
        
        // Extrai o nome original (remove o CPF e timestamp do início)
        const fileNameParts = file.split('_');
        const originalName = fileNameParts.slice(2).join('_'); // Remove CPF e timestamp
        
      // Determina o tipo de arquivo baseado na extensão
      let fileType = 'application/octet-stream';
      switch (extension.toLowerCase()) {
        case '.jpg':
          fileType = 'image/jpeg';
          break;
        case '.jpeg':
          fileType = 'image/jpeg';
          break;
        case '.png':
          fileType = 'image/png';
          break;
        case '.gif':
          fileType = 'image/gif';
          break;
        case '.pdf':
          fileType = 'application/pdf';
          break;
        case '.txt':
          fileType = 'text/plain';
          break;
      }

      attachments.push({
        id: file, // Usa o nome do arquivo como ID
        fileName: file,
        originalName: originalName || file,
        fileSize: stats.size,
        uploadDate: stats.mtime.toISOString(),
        description: '', // Sem descrição por enquanto
        fileType: fileType
      });
    }
  });

  console.log(`📋 Total de anexos encontrados: ${attachments.length}`);
    
    // Ordena por data de modificação (mais recente primeiro)
    attachments.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    
    res.json(attachments);
  } catch (err) {
    console.error('❌ Erro ao listar anexos:', err);
    res.status(500).json({ error: 'Erro ao listar anexos', details: err.message });
  }
});

// Novo endpoint para listar anexos via POST (CPF no body)
app.post('/api/attachments', (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) {
      return res.status(400).json({ error: 'CPF não informado' });
    }
    const attachmentsDir = path.join(process.cwd(), 'data', 'attachments');
    if (!fs.existsSync(attachmentsDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(attachmentsDir);
    const attachments = [];
    files.forEach(file => {
      if (file.startsWith(cpf + '_')) {
        const filePath = path.join(attachmentsDir, file);
        const stats = fs.statSync(filePath);
        const extension = path.extname(file);
        const fileNameParts = file.split('_');
        const originalName = fileNameParts.slice(2).join('_');
        let fileType = 'application/octet-stream';
        switch (extension.toLowerCase()) {
          case '.jpg':
          case '.jpeg':
            fileType = 'image/jpeg';
            break;
          case '.png':
            fileType = 'image/png';
            break;
          case '.gif':
            fileType = 'image/gif';
            break;
          case '.pdf':
            fileType = 'application/pdf';
            break;
          case '.txt':
            fileType = 'text/plain';
            break;
        }
        attachments.push({
          id: file,
          fileName: file,
          originalName: originalName || file,
          fileSize: stats.size,
          uploadDate: stats.mtime.toISOString(),
          description: '',
          fileType: fileType
        });
      }
    });
    attachments.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    res.json(attachments);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar anexos', details: err.message });
  }
});

// Endpoint para download de anexo
app.get('/api/attachments/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), 'data', 'attachments', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer download do anexo', details: err.message });
  }
});

app.post('/api/audit', (req, res) => {
  try {
    const { tipo, melhoria } = req.body;
    if (!tipo) return res.status(400).json({ error: 'Tipo de decisão é obrigatório' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `audit_decision_${timestamp}.txt`;
    const filePath = path.join(process.cwd(), 'Aceites', fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true }); // Garante que a pasta existe
    let content = `Decisão: ${tipo}\n`;
    if (melhoria) content += `Pontos de melhoria: ${melhoria}\n`;
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, file: fileName });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar decisão', details: err.message });
  }
});

app.get('/api/audit/download/:file', (req, res) => {
  const { file } = req.params;
  const filePath = path.join(process.cwd(), 'Aceites', file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  res.download(filePath);
});

// Endpoint para listar áudios de um cliente
app.get('/api/audios/:cpf', (req, res) => {
  try {
    const { cpf } = req.params;
    const audiosDir = path.join(process.cwd(), 'data', 'audios'); // 📁 Pasta dos áudios
    
    console.log('🔍 Buscando áudios para CPF:', cpf);
    console.log('📁 Diretório de áudios:', audiosDir);
    
    if (!fs.existsSync(audiosDir)) {
      console.log('❌ Diretório de áudios não existe');
      return res.json([]);
    }

    const files = fs.readdirSync(audiosDir); // 📄 Lê todos os arquivos
    console.log('📄 Arquivos encontrados no diretório de áudios:', files);
    
    const audios = [];
    // 🎯 Normalização condicional para CNPJ
    let cpfOuCnpjBusca = cpf;
    if (cpf.replace(/\D/g, '').length === 14) {
      cpfOuCnpjBusca = normalizaCpfCnpj(cpf);
    }

    files.forEach(file => {
      // Pega o prefixo do arquivo até o primeiro underline
      const filePrefix = file.split('_')[0];
      const filePrefixBusca = normalizaCpfCnpj(filePrefix);
      const cpfOuCnpjBuscaNormalizado = normalizaCpfCnpj(cpf);
      if (filePrefixBusca === cpfOuCnpjBuscaNormalizado) {
        const filePath = path.join(audiosDir, file);
        const stats = fs.statSync(filePath);
        const extension = path.extname(file);
        
        // 🎵 Filtro por extensões de áudio
        const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];
        if (audioExtensions.includes(extension.toLowerCase())) {
          
          // 📝 Determina tipo MIME do áudio
          let fileType = 'audio/mpeg';
          switch (extension.toLowerCase()) {
            case '.mp3': fileType = 'audio/mpeg'; break;
            case '.wav': fileType = 'audio/wav'; break;
            case '.m4a': fileType = 'audio/mp4'; break;
            case '.ogg': fileType = 'audio/ogg'; break;
            case '.aac': fileType = 'audio/aac'; break;
          }

          // 📝 Monta objeto do áudio
          audios.push({
            id: file,
            fileName: file,
            originalName: file.split('_').slice(1).join('_'), // Remove CPF do nome
            fileSize: stats.size,
            uploadDate: stats.mtime.toISOString(),
            description: '',
            fileType: fileType,
            duration: null
          });
        }
      }
    });

    console.log(`📋 Total de áudios encontrados: ${audios.length}`);
    res.json(audios); // 📤 Retorna lista de áudios
  } catch (err) {
    console.error('❌ Erro ao listar áudios:', err);
    res.status(200).json([]); // Sempre retorna array vazio em caso de erro
  }
});

// Endpoint para download de áudio
app.get('/api/audios/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), 'data', 'audios', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(filePath); // 📤 Força download
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer download do áudio', details: err.message });
  }
});

// Endpoint para streaming de áudio (reprodução)
app.get('/api/audios/stream/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), 'data', 'audios', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // 🔄 Suporte a Range Requests (streaming)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
      const chunksize = (end-start)+1;
      const file = fs.createReadStream(filePath, {start, end});
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // 📤 Streaming completo
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer streaming do áudio', details: err.message });
  }
});

// ===== NOVAS APIs PARA TABELA OCORRENCIA E MEDIA =====

// MySQL connection com SSH tunnel
const mysql = require('mysql2/promise');
const tunnel = require('tunnel-ssh');

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

// Função para obter conexão MySQL com SSH tunnel
async function getConnection() {
  console.log('🔧 Iniciando getConnection()...');
  
  // Verificar se as variáveis de ambiente estão configuradas
  const requiredEnvVars = ['SSH_USER', 'SSH_HOST', 'SSH_PASSWORD', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  console.log('🔍 Verificando variáveis de ambiente...');
  requiredEnvVars.forEach(varName => {
    const hasValue = !!process.env[varName];
    console.log(`  ${varName}: ${hasValue ? '✅' : '❌'} ${hasValue ? '(presente)' : '(ausente)'}`);
  });
  
  if (missingVars.length > 0) {
    console.error('❌ Variáveis de ambiente não configuradas:', missingVars);
    throw new Error(`Variáveis de ambiente não configuradas: ${missingVars.join(', ')}`);
  }
  
  console.log('🔧 Configuração SSH Tunnel:');
  console.log('  SSH_USER:', process.env.SSH_USER);
  console.log('  SSH_HOST:', process.env.SSH_HOST);
  console.log('  SSH_PASSWORD:', process.env.SSH_PASSWORD ? '✅ Configurado' : '❌ Não configurado');
  console.log('  DB_USER:', process.env.DB_USER);
  console.log('  DB_PASS:', process.env.DB_PASS ? '✅ Configurado' : '❌ Não configurado');
  console.log('  DB_NAME:', process.env.DB_NAME);
  console.log('  DB_HOST:', process.env.DB_HOST || 'localhost (padrão)');
  console.log('  DB_PORT:', process.env.DB_PORT || '3306 (padrão)');
  
  console.log('🔧 Configuração do tunnel:', {
    username: process.env.SSH_USER,
    host: process.env.SSH_HOST,
    port: 22,
    dstHost: process.env.DB_HOST || 'localhost',
    dstPort: parseInt(process.env.DB_PORT) || 3306,
    localHost: '127.0.0.1',
    localPort: 3307
  });
  
  return new Promise((resolve, reject) => {
    console.log('🚇 Iniciando SSH tunnel...');
    
    tunnel(tunnelConfig, (error, server) => {
      if (error) {
        console.error('❌ Erro no SSH tunnel:', error);
        console.error('📋 Stack trace do SSH:', error.stack);
        reject(error);
        return;
      }
      
      console.log('✅ SSH tunnel estabelecido');
      
      const dbConfig = {
        host: '127.0.0.1',
        port: 3307,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
      };
      
      console.log('🔧 Configuração MySQL:', {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        database: dbConfig.database,
        password: dbConfig.password ? '✅ Configurado' : '❌ Não configurado'
      });
      
      const connection = mysql.createConnection(dbConfig);
      
      connection.then(conn => {
        console.log('✅ Conexão MySQL estabelecida');
        resolve({ connection: conn, server });
      }).catch(err => {
        console.error('❌ Erro ao conectar com MySQL:', err);
        console.error('📋 Stack trace do MySQL:', err.stack);
        server.close();
        reject(err);
      });
    });
  });
}

// API para listar todas as ocorrências
app.get('/api/ocorrencias', async (req, res) => {
  console.log('📡 GET /api/ocorrencias - Buscando ocorrências');
  let connection, server;
  
  try {
    console.log('🔗 Iniciando conexão com banco...');
    ({ connection, server } = await getConnection());
    console.log('✅ Conexão estabelecida, executando query...');
    
    const query = `
      SELECT 
        id,
        credor,
        cpf_cnpj,
        titulo,
        matricula,
        nome,
        vencimento,
        atraso_dias,
        valor_recebido,
        plano,
        data_promessa_pg,
        data_pagamento,
        comissao,
        acao,
        sms_enviado,
        ura_enviado,
        envio_negociacao,
        created_at
      FROM ocorrencia 
      ORDER BY created_at DESC
    `;
    
    console.log('📊 Executando query SQL...');
    const [rows] = await connection.execute(query);
    console.log(`✅ Query executada com sucesso. ${rows.length} registros encontrados.`);
    
    await connection.end();
    if (server) server.close();
    console.log('🔒 Conexões fechadas');
    
    res.json(rows);
  } catch (error) {
    console.error('❌ Erro ao buscar ocorrências:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao buscar ocorrências', 
      details: error.message,
      stack: error.stack 
    });
  } finally {
    try {
      if (connection) {
        await connection.end();
        console.log('🔒 Conexão MySQL fechada');
      }
      if (server) {
        server.close();
        console.log('🔒 SSH tunnel fechado');
      }
    } catch (closeError) {
      console.error('❌ Erro ao fechar conexões:', closeError);
    }
  }
});

// API para buscar mídia de uma ocorrência específica
app.get('/api/ocorrencias/:id/media', async (req, res) => {
  let connection, server;
  try {
    const { id } = req.params;
    ({ connection, server } = await getConnection());
    
    const [rows] = await connection.execute(`
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
    
    await connection.end();
    if (server) server.close();
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar mídia da ocorrência:', error);
    res.status(500).json({ error: 'Erro ao buscar mídia', details: error.message });
  } finally {
    if (connection) await connection.end();
    if (server) server.close();
  }
});

// API para download de mídia
app.get('/api/media/download/:fileName', async (req, res) => {
  let connection, server;
  try {
    const { fileName } = req.params;
    
    ({ connection, server } = await getConnection());
    
    const [rows] = await connection.execute(`
      SELECT file_path, mime_type 
      FROM media 
      WHERE file_name = ?
    `, [fileName]);
    
    await connection.end();
    if (server) server.close();
    
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
    if (connection) await connection.end();
    if (server) server.close();
  }
});

app.listen(PORT, () => {
  const publicUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL || null;
  if (publicUrl) {
    console.log(`Servidor backend rodando em ${publicUrl}`);
  } else {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
  }
}); 