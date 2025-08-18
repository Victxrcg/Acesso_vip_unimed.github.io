const fs = require('fs');
const path = require('path');

// Funções utilitárias
function normalizeDateToISO(dateStr) {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  // Tratar valores inválidos/comuns
  if (!trimmed || trimmed === '00/00/0000' || trimmed === '0000-00-00') return null;
  // Formato esperado: dd/mm/yyyy
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [_, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Se já estiver no formato ISO yyyy-mm-dd
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;
  // Caso contrário, não conseguimos interpretar com segurança
  return null;
}

function escapeSqlString(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function parseDecimal(value) {
  if (!value) return null;
  const str = String(value).trim();
  // Remove símbolos de moeda e espaços
  const clean = str.replace(/[R$\s]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Ler o arquivo CSV
const csvPath = path.join(__dirname, '..', 'UNIMED_CANCELAMENTO_170425.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Parsear o CSV (usando ; como delimitador)
const linhas = csvContent.split('\n').filter(linha => linha.trim());
const cabecalho = linhas[0].split(';');
const dados = linhas.slice(1).filter(linha => linha.trim());

console.log(`CSV lido: ${dados.length} registros`);
console.log('Cabeçalho:', cabecalho);

// Processar cada linha
const registros = dados.map(linha => {
  const campos = linha.split(';').map(campo => campo.trim());
  
  // Mapear campos corretamente baseado no CSV
  return {
    numero_contrato: campos[0] || '',           // NumeroContrato
    data_vencimento: campos[1] || null,        // Data Vencimento
    especie: campos[3] || '',                  // Espécie
    nome_cliente: campos[4] || '',             // Nome Cliente
    cod_registro_plano_ans: campos[5] || '',   // Código Registro Plano ANS
    cpf_cnpj: campos[6] || '',                 // CPF/CNPJ
    codigo_titulo: campos[7] || '',            // Código Título (IMPORTANTE!)
    valor_original: campos[8] ? parseDecimal(campos[8]) : null,  // Valor Original
    valor_atual: campos[9] ? parseDecimal(campos[9]) : null,     // Valor Atual
    dias_atraso: parseInt(campos[10]) || 0     // Dias Atraso
  };
});

// Filtrar registros válidos
const registrosValidos = registros.filter(r => 
  r.numero_contrato && r.nome_cliente && r.cpf_cnpj && r.codigo_titulo
);

console.log(`Registros válidos: ${registrosValidos.length}`);

// Gerar SQL
const sqlContent = `-- Script para importar lote de cancelamento UNIMED 17/04/2025
-- Gerado automaticamente em ${new Date().toISOString()}

-- 1. Criar o lote (se não existir)
INSERT IGNORE INTO lotes_cancelamento (id, nome_arquivo, data_lote, total_registros) 
VALUES (5, 'UNIMED_CANCELAMENTO_170425.csv', '2025-04-17', ${registrosValidos.length});

-- 2. Inserir os registros de clientes
INSERT IGNORE INTO clientes_cancelamentos 
(lote_id, numero_contrato, data_vencimento, especie, nome_cliente, cod_registro_plano_ans, cpf_cnpj, codigo_titulo, valor_original, valor_atual, dias_atraso)
VALUES
${registrosValidos.map(registro => {
  const dataVencimento = registro.data_vencimento ? `'${normalizeDateToISO(registro.data_vencimento)}'` : 'NULL';
  const valorOriginal = registro.valor_original !== null ? registro.valor_original : 'NULL';
  const valorAtual = registro.valor_atual !== null ? registro.valor_atual : 'NULL';
  
  return `(5, '${escapeSqlString(registro.numero_contrato)}', ${dataVencimento}, '${escapeSqlString(registro.especie)}', '${escapeSqlString(registro.nome_cliente)}', '${escapeSqlString(registro.cod_registro_plano_ans)}', '${escapeSqlString(registro.cpf_cnpj)}', '${escapeSqlString(registro.codigo_titulo)}', ${valorOriginal}, ${valorAtual}, ${registro.dias_atraso})`;
}).join(',\n')};

-- 3. Atualizar total de registros do lote
UPDATE lotes_cancelamento SET total_registros = ${registrosValidos.length} WHERE id = 5;

-- 4. Verificar resultado
SELECT 
  'Lote criado/atualizado:' as info,
  id, nome_arquivo, data_lote, total_registros, importado_em
FROM lotes_cancelamento WHERE id = 5;

SELECT 
  'Total de registros inseridos:' as info,
  COUNT(*) as total
FROM clientes_cancelamentos WHERE lote_id = 5;
`;

// Salvar o arquivo SQL
const outputPath = path.join(__dirname, 'lote-5-correto-639-registros.sql');
fs.writeFileSync(outputPath, sqlContent);

console.log(`\n✅ Arquivo SQL gerado com sucesso: ${outputPath}`);
console.log(`📊 Total de registros: ${registrosValidos.length}`);
console.log(`📁 Arquivo: ${path.basename(outputPath)}`);
console.log(`\n🚀 Para importar no servidor:`);
console.log(`mysql -h SEU_HOST -u SEU_USUARIO -p SUA_BASE < ${path.basename(outputPath)}`); 