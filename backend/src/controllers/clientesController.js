const db = require('../lib/db');

const listarClientesDoLote = async (req, res) => {
  try {
    const { loteId } = req.params;
    
    const [clientes] = await db.query(
      'SELECT * FROM clientes_cancelamentos WHERE lote_id = ? ORDER BY nome_cliente',
      [loteId]
    );
    
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: error.message });
  }
};

const buscarAnexosPorCpf = async (req, res) => {
  try {
    const { cpf } = req.params;
    
    // Buscar anexos por CPF
    const [anexos] = await db.query(
      'SELECT * FROM cancelamento_pdfs WHERE cpf = ?',
      [cpf]
    );
    
    res.json(anexos);
  } catch (error) {
    console.error('Erro ao buscar anexos:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listarClientesDoLote,
  buscarAnexosPorCpf
}; 