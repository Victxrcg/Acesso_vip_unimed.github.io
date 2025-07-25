import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  Users, 
  FileText, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileDown,
  Eye
} from "lucide-react";

const Compliance = () => {
  const [lotes, setLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const API_BASE = import.meta.env.VITE_API_URL;

  // Buscar lotes ao montar
  useEffect(() => {
    setLoadingLotes(true);
    console.log('Buscando lotes...');
    fetch(`${API_BASE}/api/lotes_cancelamento`)
      .then(res => {
        console.log('Status da resposta (lotes):', res.status);
        return res.json();
      })
      .then(data => {
        console.log('LOTES:', data);
        console.log('Quantidade de lotes:', data.length);
        setLotes(data);
        if (data.length > 0) {
          console.log('Selecionando primeiro lote:', data[0].id);
          setSelectedLote(data[0].id);
        }
        setLoadingLotes(false);
      })
      .catch(err => {
        console.error('Erro ao buscar lotes:', err);
        setLotes([]);
        setLoadingLotes(false);
      });
  }, []);

  // Buscar clientes do lote selecionado
  useEffect(() => {
    if (selectedLote) {
      setLoadingClientes(true);
      console.log('Buscando clientes para lote:', selectedLote);
      fetch(`${API_BASE}/api/lotes_cancelamento/${selectedLote}/clientes`)
        .then(res => {
          console.log('Status da resposta:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('CLIENTES DO LOTE (RAW):', data);
          console.log('Quantidade de clientes:', data.length);
          
          if (data.length === 0) {
            console.log('Nenhum cliente encontrado para este lote');
            setClientes([]);
            return;
          }
          
          console.log('Primeiro cliente:', data[0]);
          
          // Agrupar clientes por CPF/CNPJ para evitar duplicatas
          const clientesAgrupados = data.reduce((acc, cliente) => {
            const cpfCnpj = cliente.cpf_cnpj;
            
            if (!acc[cpfCnpj]) {
              acc[cpfCnpj] = {
                ...cliente,
                contratos: [cliente.numero_contrato],
                codigos: [cliente.codigo_titulo],
                especies: [cliente.especie]
              };
            } else {
              if (!acc[cpfCnpj].contratos.includes(cliente.numero_contrato)) {
                acc[cpfCnpj].contratos.push(cliente.numero_contrato);
              }
              if (!acc[cpfCnpj].codigos.includes(cliente.codigo_titulo)) {
                acc[cpfCnpj].codigos.push(cliente.codigo_titulo);
              }
              if (!acc[cpfCnpj].especies.includes(cliente.especie)) {
                acc[cpfCnpj].especies.push(cliente.especie);
              }
            }
            
            return acc;
          }, {});
          
          const clientesUnicos = Object.values(clientesAgrupados);
          console.log('CLIENTES AGRUPADOS:', clientesUnicos);
          console.log('Quantidade de clientes únicos:', clientesUnicos.length);
          setClientes(clientesUnicos);
          setLoadingClientes(false);
        })
        .catch(err => {
          console.error('Erro ao buscar clientes do lote:', err);
          setClientes([]);
          setLoadingClientes(false);
        });
    }
  }, [selectedLote]);

  // Filtrar clientes baseado na busca
  const filteredClientes = clientes.filter(cliente =>
    cliente.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cpf_cnpj.includes(searchTerm)
  );

  // Calcular paginação
  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClientes = filteredClientes.slice(startIndex, endIndex);

  // Resetar página quando mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, selectedLote]);

  // Estatísticas do lote selecionado
  const selectedLoteData = lotes.find(l => l.id === selectedLote);
  const totalContratos = clientes.reduce((acc, c) => acc + c.contratos.length, 0);
  const totalEspecies = clientes.reduce((acc, c) => acc + c.especies.length, 0);
  const totalCodigos = clientes.reduce((acc, c) => acc + c.codigos.length, 0);
  
  // Função para normalizar CPF/CNPJ (adicionar zeros à esquerda)
  const normalizeCpfCnpj = (cpfCnpj) => {
    if (!cpfCnpj) return "";
    
    // Remove todos os caracteres não numéricos
    let clean = cpfCnpj.replace(/\D/g, "");
    
    // Adiciona zeros à esquerda se necessário
    if (clean.length === 9) {
      clean = "00" + clean; // Adiciona 2 zeros para CPF
    } else if (clean.length === 10) {
      clean = "0" + clean; // Adiciona 1 zero para CPF
    } else if (clean.length === 12) {
      clean = "00" + clean; // Adiciona 2 zeros para CNPJ
    } else if (clean.length === 13) {
      clean = "0" + clean; // Adiciona 1 zero para CNPJ
    }
    
    return clean;
  };



  // Função para formatar CPF/CNPJ
  const formatCpfCnpj = (cpfCnpj) => {
    if (!cpfCnpj) return "";
    
    // Primeiro normaliza o CPF/CNPJ
    const normalized = normalizeCpfCnpj(cpfCnpj);
    
    // Formata CPF (11 dígitos)
    if (normalized.length === 11) {
      return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    
    // Formata CNPJ (14 dígitos)
    if (normalized.length === 14) {
      return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    // Se não for CPF nem CNPJ válido, retorna o valor original
    return cpfCnpj;
  };

  // Função para verificar se é CPF ou CNPJ válido
  const isValidCpfCnpj = (cpfCnpj) => {
    if (!cpfCnpj) return false;
    const normalized = normalizeCpfCnpj(cpfCnpj);
    return normalized.length === 11 || normalized.length === 14;
  };

  // Função para verificar se existe PDF para o cliente
  const hasPdfNotification = (cliente) => {
    // Aqui você pode implementar a lógica para verificar se existe PDF
    // Por enquanto, vou simular que alguns clientes têm PDF
    const cpfCnpj = normalizeCpfCnpj(cliente.cpf_cnpj);
    return cpfCnpj.length > 0; // Simulação: todos os clientes com CPF/CNPJ válido têm PDF
  };

  // Função para baixar PDF
  const downloadPdf = (cliente) => {
    const cpfCnpj = normalizeCpfCnpj(cliente.cpf_cnpj);
    const fileName = `${cpfCnpj}_${cliente.nome_cliente.replace(/\s+/g, '_')}.pdf`;
    
    // Aqui você implementaria a lógica real de download
    console.log(`Baixando PDF para: ${fileName}`);
    
    // Simulação de download
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/notificacoes/${cpfCnpj}/pdf`;
    link.download = fileName;
    link.click();
  };

  // Estatísticas de CPF/CNPJ
  const cpfsCount = clientes.filter(c => normalizeCpfCnpj(c.cpf_cnpj).length === 11).length;
  const cnpjsCount = clientes.filter(c => normalizeCpfCnpj(c.cpf_cnpj).length === 14).length;
  
  // Estatísticas de PDFs
  const pdfsCount = clientes.filter(c => hasPdfNotification(c)).length;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar de Lotes */}
      <aside className="w-80 border-r bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Compliance</h2>
          </div>
          <p className="text-sm text-gray-600">Gerencie os lotes de cancelamento</p>
        </div>

        <div className="p-4">
          {loadingLotes ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-3">Carregando lotes...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Lotes Disponíveis</h3>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  {lotes.length}
                </Badge>
              </div>
              
              {lotes.map((lote) => (
                <button
                  key={lote.id}
                  className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                    selectedLote === lote.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedLote(lote.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-semibold text-gray-900">
                        {new Date(lote.data_lote).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {selectedLote === lote.id && (
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2 truncate">
                    {lote.nome_arquivo}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{lote.total_registros || 0} registros</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="h-3 w-3" />
                      <span>Lote #{lote.id}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-6 flex flex-col h-full">
        {selectedLote && selectedLoteData ? (
          <div className="flex flex-col h-full space-y-6">
            {/* Header do Lote */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    Lote {new Date(selectedLoteData.data_lote).toLocaleDateString('pt-BR')}
                  </h1>
                  <p className="text-gray-600">{selectedLoteData.nome_arquivo}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                  <Button size="sm">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Relatório
                  </Button>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Clientes Únicos</p>
                      <p className="text-2xl font-bold text-blue-700">{clientes.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Total Contratos</p>
                      <p className="text-2xl font-bold text-blue-700">{totalContratos}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-indigo-900">Espécies</p>
                      <p className="text-2xl font-bold text-indigo-700">{totalEspecies}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-sky-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-sm font-medium text-sky-900">Títulos</p>
                      <p className="text-2xl font-bold text-sky-700">{totalCodigos}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome ou CPF/CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos os clientes</option>
                    <option value="multiple">Múltiplos contratos</option>
                    <option value="single">Contrato único</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabela de Clientes */}
            <Card className="shadow-sm flex-1 flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Lista de Clientes
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-gray-50">
                      {filteredClientes.length} de {clientes.length}
                    </Badge>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                      Página {currentPage} de {totalPages}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="rounded-lg border overflow-hidden flex-1 flex flex-col">
                  <Table className="flex-1">
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-900">Cliente & Espécie</TableHead>
                        <TableHead className="font-semibold text-gray-900">CPF/CNPJ</TableHead>
                        <TableHead className="font-semibold text-gray-900">Contrato</TableHead>
                        <TableHead className="font-semibold text-gray-900">Títulos</TableHead>
                        <TableHead className="font-semibold text-gray-900">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="flex-1">
                      {loadingClientes ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-3">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <p className="text-gray-600">Carregando clientes...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : currentClientes.length > 0 ? (
                        currentClientes.map((cliente, index) => (
                          <TableRow 
                            key={cliente.cpf_cnpj} 
                            className={`hover:bg-gray-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-semibold text-blue-700">
                                    {cliente.nome_cliente.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 text-sm truncate">{cliente.nome_cliente}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {cliente.especies.map((especie, idx) => (
                                      <Badge 
                                        key={idx} 
                                        variant="secondary" 
                                        className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs"
                                      >
                                        {especie}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm whitespace-nowrap">
                                <span className="text-gray-900 font-medium">
                                  {formatCpfCnpj(cliente.cpf_cnpj)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {cliente.contratos.map((contrato, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary" 
                                    className="bg-blue-50 text-blue-700 border-blue-200 text-sm"
                                  >
                                    {contrato}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {cliente.codigos.map((codigo, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary" 
                                    className="bg-sky-50 text-sky-700 border-sky-200 text-sm"
                                  >
                                    {codigo}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {hasPdfNotification(cliente) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadPdf(cliente)}
                                    className="h-8 w-8 p-0 bg-blue-50 border-blue-200 hover:bg-blue-100"
                                    title="Baixar Notificação PDF"
                                  >
                                    <FileDown className="h-4 w-4 text-blue-600" />
                                  </Button>
                                ) : (
                                  <div className="h-8 w-8 bg-gray-100 rounded border flex items-center justify-center">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-blue-50 border-blue-200 hover:bg-blue-100"
                                  title="Visualizar Detalhes"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-3">
                              <AlertCircle className="h-12 w-12 text-gray-400" />
                              <div>
                                <p className="text-lg font-medium text-gray-900">Nenhum cliente encontrado</p>
                                <p className="text-gray-600">
                                  {searchTerm ? 'Tente ajustar os filtros de busca' : 'Este lote não possui clientes'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                {filteredClientes.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span>
                        Mostrando {startIndex + 1} a {Math.min(endIndex, filteredClientes.length)} de {filteredClientes.length} clientes
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNumber;
                          if (totalPages <= 5) {
                            pageNumber = i + 1;
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i;
                          } else {
                            pageNumber = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNumber}
                              variant={currentPage === pageNumber ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNumber)}
                              className="h-8 w-8 p-0"
                            >
                              {pageNumber}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione um Lote</h3>
              <p className="text-gray-600">Escolha um lote na sidebar para visualizar os clientes</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Compliance; 