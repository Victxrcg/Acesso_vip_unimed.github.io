#!/usr/bin/env node
import fs from 'node:fs';
import * as csv from 'csv-parse/sync';
import yaml from 'js-yaml';

const csvPath = process.argv[2] || 'UNIMED_15072025_ocorrencias_.csv';
const csvRaw  = fs.readFileSync(csvPath, 'latin1');

const records = csv.parse(csvRaw, {
  delimiter: ';',
  columns: true,
  skip_empty_lines: true,
});

console.log('Chaves do primeiro registro:', Object.keys(records[0]));

const normalise = (str) => (str ? str.trim().replace(/\s{2,}/g, ' ') : '');

const out = records.map((r, idx) => ({
  id: idx.toString().padStart(3, '0'),
  credor: normalise(r['Credor']),
  cpf_cnpj: normalise(r['CPF / CNPJ']),
  titulo: normalise(r['TÃ­tulo']),
  matricula: normalise(r['MatrÃ­cula']),
  nome: normalise(r['Nome']),
  vencimento: r['Vencimento'],
  atraso: Number(r['Atraso']),
  valor_recebido: Number(
    (r['  Valor Recebido  '] || '0')
      .replace(/\./g, '') // remove pontos de milhar
      .replace(',', '.')  // troca vírgula decimal por ponto
  ) || 0,
  plano: r['Plano'],
  data_pp: r['Data Promessa de Pagamento'],
  data_pgto: r['Data Pagamento'] || null,
  comissao: Number(
    (r['  ComissÃ£o  '] || '0')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0,
  acao: r['Aï¿½ï¿½O'],
  sms: !!r['SMS'],
  ura: !!r['URA'],
  envio_negociacao: r['Envio Negociaï¿½ï¿½o'],
  audio_id: `${r['CPF / CNPJ']}_${r['Nome'] ? r['Nome'].toUpperCase().replace(/[^A-Z0-9]/g,'_') : ''}.mp3`,
}));

fs.writeFileSync('data/clientes.yaml', yaml.dump(out, { noRefs: true }), 'utf8');
console.log('✓  clientes.yaml gerado com', out.length, 'registros');
