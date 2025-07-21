const express = require('express');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'https://acesso-vip-unimed-github-io.vercel.app',
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
  res.send('API Unimed VIP rodando! Consulte /api/clientes, /login, etc.');
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

function normalizaCpfCnpj(str: string) {
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

// Endpoint para listar anexos de um cliente (GET)
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

    files.forEach(file => {
      console.log(`🔍 Verificando arquivo: ${file}`);
      console.log(`🔍 Procurando por: ${cpf}_`);
      
      // Verifica se o arquivo começa com o CPF do cliente
      if (file.startsWith(cpf + '_')) {
        console.log(`✅ Arquivo encontrado: ${file}`);
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

app.listen(PORT, () => {
  const publicUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL || null;
  if (publicUrl) {
    console.log(`Servidor backend rodando em ${publicUrl}`);
  } else {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
  }
}); 