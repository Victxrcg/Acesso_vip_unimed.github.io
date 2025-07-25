const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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
    const [rows] = await pool.query('SELECT * FROM ocorrencia');
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

// Endpoint para listar áudios de um cliente
app.get('/api/audios/:cpf', (req, res) => {
  try {
    const { cpf } = req.params;
    const audiosDir = path.join(process.cwd(), '..', 'data', 'audios');
    
    console.log('🔍 Buscando áudios para CPF:', cpf);
    console.log('📁 Diretório de áudios:', audiosDir);
    
    if (!fs.existsSync(audiosDir)) {
      console.log('❌ Diretório de áudios não existe');
      return res.json([]);
    }

    const files = fs.readdirSync(audiosDir);
    console.log('📄 Arquivos encontrados no diretório de áudios:', files);
    
    const audios = [];
    // Normalização condicional para CNPJ
    let cpfOuCnpjBusca = cpf;
    if (cpf.replace(/\D/g, '').length === 14) {
      cpfOuCnpjBusca = cpf.replace(/[.-/]/g, '').replace(/\s/g, '');
    }

    files.forEach(file => {
      // Pega o prefixo do arquivo até o primeiro underline
      const filePrefix = file.split('_')[0];
      const filePrefixBusca = filePrefix.replace(/[.-/]/g, '').replace(/\s/g, '');
      const cpfOuCnpjBuscaNormalizado = cpf.replace(/[.-/]/g, '').replace(/\s/g, '');
      if (filePrefixBusca === cpfOuCnpjBuscaNormalizado) {
        const filePath = path.join(audiosDir, file);
        const stats = fs.statSync(filePath);
        const extension = path.extname(file);
        
        // Filtro por extensões de áudio
        const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac'];
        if (audioExtensions.includes(extension.toLowerCase())) {
          
          // Determina tipo MIME do áudio
          let fileType = 'audio/mpeg';
          switch (extension.toLowerCase()) {
            case '.mp3': fileType = 'audio/mpeg'; break;
            case '.wav': fileType = 'audio/wav'; break;
            case '.m4a': fileType = 'audio/mp4'; break;
            case '.ogg': fileType = 'audio/ogg'; break;
            case '.aac': fileType = 'audio/aac'; break;
          }

          // Monta objeto do áudio
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
    res.json(audios);
  } catch (err) {
    console.error('❌ Erro ao listar áudios:', err);
    res.status(200).json([]); // Sempre retorna array vazio em caso de erro
  }
});

// Endpoint para download de áudio
app.get('/api/audios/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), '..', 'data', 'audios', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer download do áudio', details: err.message });
  }
});

// Endpoint para streaming de áudio (reprodução)
app.get('/api/audios/stream/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), '..', 'data', 'audios', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Suporte a Range Requests (streaming)
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
      // Streaming completo
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

app.get('/', (req, res) => {
  res.send('API AuditaAI rodando!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
}); 