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

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  const publicUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_URL || null;
  if (publicUrl) {
    console.log(`Servidor backend rodando em ${publicUrl}`);
  } else {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
  }
}); 