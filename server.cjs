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
})); // Libera para qualquer origem
app.use(express.json());

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

app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'vip' && senha === 'unimedvip2024') {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
  }
});

function normalizaCpfCnpj(str) {
  return str.replace(/[.\-\/]/g, '').replace(/\s/g, '');
}


app.get('/download/:cpfcnpj', (req, res) => {
  const cpfcnpj  = normalizaCpfCnpj(req.params.cpfcnpj);
  const audiosDir = path.join(process.cwd(), 'data', 'audios');

  try {
    const files = fs.readdirSync(audiosDir);
    const audioFile = files.find(f => normalizaCpfCnpj(f).startsWith(cpfcnpj));

    if (!audioFile) {
      console.log('❌ Áudio não encontrado para CPF/CNPJ:', cpfcnpj);
      return res.status(404).send('Áudio não encontrado');
    }

    const filePath = path.join(audiosDir, audioFile);

    // ⚠️ Cabeçalhos para driblar bloqueio do firewall
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${audioFile}"`,
      'Cache-Control': 'no-store',
    });

    console.log('📧 Servindo áudio:', audioFile, 'para CPF/CNPJ:', cpfcnpj);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Erro ao buscar áudio:', err);
    res.status(500).send('Erro interno do servidor');
  }
});

// Endpoint para listar arquivos de áudio disponíveis
app.get('/audios', (req, res) => {
  const audiosDir = path.join(process.cwd(), 'data', 'audios');
  if (!fs.existsSync(audiosDir)) return res.json([]);
  const files = fs.readdirSync(audiosDir).filter(f => f.endsWith('.mp3'));
  res.json(files);
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
      let filePrefixBusca = filePrefix;
      if (filePrefix.replace(/\D/g, '').length === 14) {
        filePrefixBusca = normalizaCpfCnpj(filePrefix);
      }
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
    const filePath = path.join(process.cwd(), 'my-panel/data/attachments', fileName);
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
  const filePath = path.join(process.cwd(), 'my-panel/data/attachments', file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  res.download(filePath);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend rodando em http://0.0.0.0:${PORT}`);
});
server.setTimeout(0); // Sem timeout