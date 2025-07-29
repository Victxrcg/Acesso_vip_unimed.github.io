const { getDbPoolWithTunnel } = require('../lib/db-ssh');

exports.listarLotes = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query(`
      SELECT id, nome_arquivo, data_lote, importado_em, total_registros
      FROM lotes_cancelamento
      ORDER BY data_lote DESC, id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar lotes', details: err.message });
  }
  // Não fechar conexão - será reutilizada
}; 