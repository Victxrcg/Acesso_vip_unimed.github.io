const { getDbPoolWithTunnel } = require('../lib/db-ssh');

exports.listarClientesDoLote = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query(`
      SELECT id, numero_contrato, especie, nome_cliente, codigo_titulo, cpf_cnpj
      FROM clientes_cancelamentos
      WHERE lote_id = ?
      ORDER BY nome_cliente
    `, [req.params.loteId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar clientes do lote', details: err.message });
  }
  // Não fechar conexão - será reutilizada
}; 