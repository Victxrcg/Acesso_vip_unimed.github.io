const { getDbPoolWithTunnel } = require('../lib/db');

exports.listarClientesDoLote = async (req, res) => {
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
    console.error('❌ Erro ao buscar clientes do lote:', err);
    res.status(500).json({ error: 'Erro ao buscar clientes do lote', details: err.message });
  }
  // Não fechar conexão - será reutilizada
}; 