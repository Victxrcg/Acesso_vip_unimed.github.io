const { getDbPoolWithTunnel } = require('../lib/db');

const listarClientesDoLote = async (req, res) => {
  let pool, server;
  try {
    const { loteId } = req.params;
    console.log('🔍 Buscando clientes para lote:', loteId);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar todos os clientes do lote com mais informações
    const [rows] = await pool.query(`
      SELECT 
        id,
        numero_contrato,
        especie,
        nome_cliente,
        codigo_titulo,
        cpf_cnpj,
        valor_atual,
        dias_atraso,
        data_vencimento,
        created_at
      FROM clientes_cancelamentos
      WHERE lote_id = ?
      ORDER BY nome_cliente
    `, [loteId]);
    
    console.log(`📋 Total de clientes encontrados para lote ${loteId}:`, rows.length);
    
    if (rows.length > 0) {
      console.log('📋 Primeiro cliente:', {
        id: rows[0].id,
        nome: rows[0].nome_cliente,
        cpf: rows[0].cpf_cnpj,
        contrato: rows[0].numero_contrato
      });
    }
    
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar clientes do lote:', err.message);

    if (process.env.NODE_ENV === 'development') {
      // Fallback simples para não quebrar a UI
      const mock = [
        {
          id: 1,
          numero_contrato: 'C-001',
          especie: 'ACD',
          nome_cliente: 'REBECA BRITO SILVA',
          codigo_titulo: '05157928106-001',
          cpf_cnpj: '051.579.281-06',
          valor_atual: 64.80,
          dias_atraso: 30,
          data_vencimento: '2025-06-16',
          created_at: new Date().toISOString(),
          lote_id: Number(req.params.loteId || 1)
        }
      ];
      return res.json(mock);
    }

    res.status(500).json({ error: 'Erro ao buscar clientes do lote', details: err.message });
  }
  // Não fechar conexão - será reutilizada
};

const buscarAnexosPorCpf = async (req, res) => {
  let pool, server;
  try {
    const { cpf } = req.params;
    console.log('🔍 Buscando anexos para CPF:', cpf);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Normalizar CPF (remover zeros à esquerda)
    const cpfNormalizado = cpf.replace(/^0+/, '');
    console.log('🔧 CPF normalizado:', cpfNormalizado);
    
    // 1. Buscar anexos diretamente pelo CPF normalizado (lotes novos)
    let [anexos] = await pool.query(
      'SELECT * FROM cancelamento_pdfs WHERE cpf = ?',
      [cpfNormalizado]  // ← CORREÇÃO: usar cpfNormalizado
    );
    
    console.log(`📎 Anexos encontrados diretamente pelo CPF: ${anexos.length}`);
    
    // 2. Se não encontrar, buscar por contrato MAS filtrando pelo CPF específico (lotes antigos)
    if (anexos.length === 0) {
      console.log('�� CPF não encontrado diretamente, buscando por contrato com filtro de CPF...');
      
      // Primeiro, encontrar o cliente específico pelo CPF
      const [clientes] = await pool.query(
        'SELECT id, numero_contrato, nome_cliente, cpf_cnpj FROM clientes_cancelamentos WHERE cpf_cnpj = ? OR cpf_cnpj = ?',
        [cpf, cpfNormalizado]
      );
      
      if (clientes.length > 0) {
        const cliente = clientes[0];
        console.log('✅ Cliente encontrado:', cliente.nome_cliente, 'Contrato:', cliente.numero_contrato);
        
        // Buscar anexos pelo contrato MAS apenas do cliente específico
        [anexos] = await pool.query(`
          SELECT cp.*, cc.cpf_cnpj, cc.nome_cliente, cc.numero_contrato
          FROM cancelamento_pdfs cp
          INNER JOIN clientes_cancelamentos cc ON cp.cancelamento_id = cc.id
          WHERE cc.numero_contrato = ? AND cc.cpf_cnpj = ?
        `, [cliente.numero_contrato, cpfNormalizado]);
        
        console.log(`📎 Anexos encontrados por contrato + CPF: ${anexos.length}`);
      } else {
        console.log('❌ Cliente não encontrado para CPF:', cpf);
      }
    }
    
    console.log(`📎 Total de anexos encontrados para CPF ${cpf}:`, anexos.length);
    res.json(anexos);
  } catch (error) {
    console.error('❌ Erro ao buscar anexos:', error);
    res.status(500).json({ error: error.message });
  }
  // Não fechar conexão - será reutilizada
};

module.exports = {
  listarClientesDoLote,
  buscarAnexosPorCpf
}; 