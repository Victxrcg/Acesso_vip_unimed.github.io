const { getDbPoolWithTunnel } = require('../lib/db');

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
    console.warn('⚠️ Falha ao buscar lotes no banco. Ativando fallback de desenvolvimento.', err.message);

    // Fallback simples em desenvolvimento para não quebrar a UI
    if (process.env.NODE_ENV === 'development') {
      const hoje = new Date();
      const iso = (d) => new Date(d).toISOString();
      const mock = [
        { id: 3, nome_arquivo: 'UNIMED_CANCELAMENTO_15072025.csv', data_lote: iso(hoje), importado_em: iso(hoje), total_registros: 291 },
        { id: 2, nome_arquivo: 'UNIMED_CANCELAMENTO_14072025.csv', data_lote: iso(hoje.getTime() - 86400000), importado_em: iso(hoje), total_registros: 180 },
        { id: 1, nome_arquivo: 'UNIMED_CANCELAMENTO_13072025.csv', data_lote: iso(hoje.getTime() - 172800000), importado_em: iso(hoje), total_registros: 150 },
      ];
      return res.json(mock);
    }
    res.status(500).json({ error: 'Erro ao buscar lotes', details: err.message });
  }
  // Não fechar conexão - será reutilizada
}; 