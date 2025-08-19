import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  FileText, 
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileDown,
  Paperclip
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
  const [itemsPerPage] = useState(35);
  const [anexos, setAnexos] = useState({});
  const [loadingAnexos, setLoadingAnexos] = useState({});
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
        console.log('Tipo de dados:', typeof data);
        console.log('É array?', Array.isArray(data));
        console.log('Quantidade de lotes:', Array.isArray(data) ? data.length : 'N/A');
        
        if (Array.isArray(data)) {
          setLotes(data);
          if (data.length > 0) {
            console.log('Selecionando primeiro lote:', data[0].id);
            setSelectedLote(data[0].id);
          }
        } else {
          console.error('Dados não são um array:', data);
          setLotes([]);
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
          console.log('Tipo de dados:', typeof data);
          console.log('É array?', Array.isArray(data));
          console.log('Quantidade de clientes:', Array.isArray(data) ? data.length : 'N/A');
          
          if (!Array.isArray(data)) {
            console.error('❌ Dados não são um array:', data);
            setClientes([]);
            setLoadingClientes(false);
            return;
          }
          
          if (data.length === 0) {
            console.log('Nenhum cliente encontrado para este lote');
            setClientes([]);
            setLoadingClientes(false);
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
          
          // Buscar anexos para todos os clientes automaticamente
          clientesUnicos.forEach(cliente => {
            buscarAnexos(cliente);
          });
          
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

  // Detectar mudanças no tamanho da janela
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estatísticas do lote selecionado
  const selectedLoteData = Array.isArray(lotes) ? lotes.find(l => l.id === selectedLote) : null;
  const totalContratos = clientes.reduce((acc, c) => acc + c.contratos.length, 0);
  const totalEspecies = clientes.reduce((acc, c) => acc + c.especies.length, 0);
  const totalCodigos = clientes.reduce((acc, c) => acc + c.codigos.length, 0);
  
  // Função para normalizar CPF/CNPJ
  const normalizeCpfCnpj = (cpfCnpj) => {
    if (!cpfCnpj) return "";
    
    // Remove apenas caracteres não numéricos, preservando zeros
    let clean = cpfCnpj.toString().replace(/\D/g, "");
    
    // Para CPF (11 dígitos)
    if (clean.length <= 11) {
      // Pad com zeros à esquerda para garantir 11 dígitos
      clean = clean.padStart(11, '0');
    }
    // Para CNPJ (14 dígitos)
    else if (clean.length <= 14) {
      // Pad com zeros à esquerda para garantir 14 dígitos
      clean = clean.padStart(14, '0');
    }
    
    return clean;
  };

  // Função para formatar CPF/CNPJ
  const formatCpfCnpj = (cpfCnpj) => {
    if (!cpfCnpj) return "";
    const normalized = normalizeCpfCnpj(cpfCnpj);
    if (normalized.length === 11) {
      return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (normalized.length === 14) {
      return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return cpfCnpj;
  };

  // Função para buscar anexos de um cliente
  const buscarAnexos = async (cliente) => {
    const cpfCnpj = normalizeCpfCnpj(cliente.cpf_cnpj);
    if (!cpfCnpj) return;
    
    setLoadingAnexos(prev => ({ ...prev, [cpfCnpj]: true }));
    
    try {
      console.log('🔍 Buscando anexos para CPF:', cpfCnpj);
      const anexosRes = await fetch(`${API_BASE}/api/clientes/anexos/${cpfCnpj}`);
      const anexosData = await anexosRes.json();
      console.log('✅ Anexos encontrados:', anexosData);
      setAnexos(prev => ({ ...prev, [cpfCnpj]: anexosData }));
    } catch (error) {
      console.error('❌ Erro ao buscar anexos:', error);
      setAnexos(prev => ({ ...prev, [cpfCnpj]: [] }));
    } finally {
      setLoadingAnexos(prev => ({ ...prev, [cpfCnpj]: false }));
    }
  };

  // Função para verificar se cliente tem anexos
  const hasAnexos = (cliente) => {
    const cpfCnpj = normalizeCpfCnpj(cliente.cpf_cnpj);
    return anexos[cpfCnpj] && anexos[cpfCnpj].length > 0;
  };

  // Função para baixar anexo
  const downloadAnexo = (fileName) => {
    console.log('📥 Baixando anexo:', fileName);
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/media/download/${fileName}`;
    link.download = fileName;
    link.click();
  };

  // Função para obter ícone baseado no tipo de arquivo
  const getFileIcon = (fileName) => {
    if (!fileName) return <FileText className="h-4 w-4 text-gray-500" />;
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <FileText className="h-4 w-4 text-green-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6 p-4 lg:p-6">
      {/* Header Principal */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h1 className="text-2xl lg:text-3xl font-bold">Compliance</h1>
          </div>
          <p className="text-sm lg:text-base text-muted-foreground">Normativa ANS nº 593</p>
        </div>
      </div>

      {/* Seção de Lotes Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base lg:text-lg font-semibold">Lotes Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLotes ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Carregando lotes...</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {Array.isArray(lotes) && lotes.map((lote) => (
                <button
                  key={lote.id}
                  className={`flex-shrink-0 text-left p-2 sm:p-3 rounded-lg border transition-all duration-200 min-w-[180px] sm:min-w-[200px] ${
                    selectedLote === lote.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedLote(lote.id)}
                >
                  <div className="flex items-start justify-between mb-1 sm:mb-2">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                        {new Date(lote.data_lote).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {selectedLote === lote.id && (
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-1 sm:mb-2 truncate">
                    {lote.nome_arquivo}
                  </div>
                  
                  <div className="flex items-center space-x-2 sm:space-x-3 text-xs text-gray-500">
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
        </CardContent>
      </Card>

      {selectedLote && selectedLoteData ? (
        <>
          {/* Header do Lote */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 gap-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">
                    Lote {new Date(selectedLoteData.data_lote).toLocaleDateString('pt-BR')}
                  </h1>
                  <p className="text-sm lg:text-base text-gray-600 truncate">{selectedLoteData.nome_arquivo}</p>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Clientes Únicos</p>
                      <p className="text-2xl font-bold text-blue-700">{clientes.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Total Contratos</p>
                      <p className="text-2xl font-bold text-green-700">{totalContratos}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Espécies</p>
                      <p className="text-2xl font-bold text-blue-700">{totalEspecies}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Títulos</p>
                      <p className="text-2xl font-bold text-green-700">{totalCodigos}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Total Anexos</p>
                      <p className="text-2xl font-bold text-green-700">
                        {(() => {
                          let total = 0;
                          Object.values(anexos).forEach((anexosCliente: any) => {
                            if (Array.isArray(anexosCliente)) {
                              total += anexosCliente.length;
                            }
                          });
                          return total;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base lg:text-lg font-semibold">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CPF/CNPJ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
            </CardContent>
          </Card>

          {/* Lista de Clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base lg:text-lg font-semibold">
                Lista de Clientes ({filteredClientes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile: Cards Layout */}
              <div className="block md:hidden space-y-4">
                {loadingClientes ? (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-gray-600">Carregando clientes...</p>
                    </div>
                  </div>
                ) : currentClientes.length > 0 ? (
                  currentClientes.map((cliente, index) => (
                    <Card key={cliente.cpf_cnpj} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header com avatar e nome */}
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-blue-700">
                                {cliente.nome_cliente.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">{cliente.nome_cliente}</p>
                              <p className="font-mono text-xs text-gray-600">{formatCpfCnpj(cliente.cpf_cnpj)}</p>
                            </div>
                          </div>
                          
                          {/* Espécies */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Espécies:</p>
                            <div className="flex flex-wrap gap-1">
                              {cliente.especies.map((especie, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="secondary" 
                                  className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-1 py-0"
                                >
                                  {especie}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Contratos */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Contratos:</p>
                            <div className="flex flex-wrap gap-1">
                              {cliente.contratos.map((contrato, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="secondary" 
                                  className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1 py-0"
                                >
                                  {contrato}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Títulos */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Títulos:</p>
                            <div className="flex flex-wrap gap-1">
                              {cliente.codigos.map((codigo, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="secondary" 
                                  className="bg-sky-50 text-sky-700 border-sky-200 text-xs px-1 py-0"
                                >
                                  {codigo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Anexos */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">
                              Anexos: {loadingAnexos[normalizeCpfCnpj(cliente.cpf_cnpj)] ? (
                                <span className="text-blue-600">carregando...</span>
                              ) : (
                                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs ml-1">
                                  {hasAnexos(cliente) ? anexos[normalizeCpfCnpj(cliente.cpf_cnpj)].length : 0}
                                </Badge>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {loadingAnexos[normalizeCpfCnpj(cliente.cpf_cnpj)] ? (
                                <div className="flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                  <span className="text-xs text-gray-500">Buscando anexos...</span>
                                </div>
                              ) : hasAnexos(cliente) ? (
                                <div className="flex flex-wrap gap-1">
                                  {anexos[normalizeCpfCnpj(cliente.cpf_cnpj)].map((anexo, idx) => (
                                    <Button
                                      key={idx}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => downloadAnexo(anexo.file_name)}
                                      className="h-6 px-2 text-xs bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100"
                                      title={`Baixar ${anexo.file_name} (Tipo: ${anexo.tipo})`}
                                    >
                                      {getFileIcon(anexo.file_name)}
                                      <span className="ml-1 truncate max-w-16">
                                        {anexo.file_name.split('.').pop()?.toUpperCase()}
                                      </span>
                                    </Button>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 italic">Nenhum anexo encontrado</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <AlertCircle className="h-12 w-12 text-gray-400" />
                      <div>
                        <p className="text-base font-medium text-gray-900">Nenhum cliente encontrado</p>
                        <p className="text-sm text-gray-600">
                          {searchTerm ? 'Tente ajustar os filtros de busca' : 'Este lote não possui clientes'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-900 min-w-[200px]">Cliente & Espécie</TableHead>
                        <TableHead className="font-semibold text-gray-900 min-w-[120px] whitespace-nowrap">CPF/CNPJ</TableHead>
                        <TableHead className="font-semibold text-gray-900 min-w-[100px]">Contrato</TableHead>
                        <TableHead className="font-semibold text-gray-900 min-w-[100px]">Títulos</TableHead>
                        <TableHead className="font-semibold text-gray-900 min-w-[120px]">Anexos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingClientes ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-3">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <p className="text-sm lg:text-base text-gray-600">Carregando clientes...</p>
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
                                  <p className="font-semibold text-gray-900 text-xs lg:text-sm truncate">{cliente.nome_cliente}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {cliente.especies.map((especie, idx) => (
                                      <Badge 
                                        key={idx} 
                                        variant="secondary" 
                                        className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-1 py-0"
                                      >
                                        {especie}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs lg:text-sm whitespace-nowrap">
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
                                    className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1 py-0"
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
                                    className="bg-sky-50 text-sky-700 border-sky-200 text-xs px-1 py-0"
                                  >
                                    {codigo}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Paperclip className="h-3 w-3 text-gray-500" />
                                  {loadingAnexos[normalizeCpfCnpj(cliente.cpf_cnpj)] ? (
                                    <span className="text-xs text-blue-600">carregando...</span>
                                  ) : (
                                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                      {hasAnexos(cliente) ? anexos[normalizeCpfCnpj(cliente.cpf_cnpj)].length : 0}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {loadingAnexos[normalizeCpfCnpj(cliente.cpf_cnpj)] ? (
                                    <div className="flex items-center space-x-2">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                      <span className="text-xs text-gray-500">Buscando...</span>
                                    </div>
                                  ) : hasAnexos(cliente) ? (
                                    <div className="flex flex-wrap gap-1">
                                      {anexos[normalizeCpfCnpj(cliente.cpf_cnpj)].map((anexo, idx) => (
                                        <Button
                                          key={idx}
                                          variant="outline"
                                          size="sm"
                                          onClick={() => downloadAnexo(anexo.file_name)}
                                          className="h-6 px-2 text-xs bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100"
                                          title={`Baixar ${anexo.file_name} (Tipo: ${anexo.tipo})`}
                                        >
                                          {getFileIcon(anexo.file_name)}
                                          <span className="ml-1 truncate max-w-16">
                                            {anexo.file_name.split('.').pop()?.toUpperCase()}
                                          </span>
                                        </Button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400 italic">Nenhum anexo</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center space-y-3">
                              <AlertCircle className="h-12 w-12 text-gray-400" />
                              <div>
                                <p className="text-base lg:text-lg font-medium text-gray-900">Nenhum cliente encontrado</p>
                                <p className="text-sm lg:text-base text-gray-600">
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
              </div>

              {/* Controles de Paginação */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div className="text-sm text-muted-foreground order-2 sm:order-1">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredClientes.length)} de {filteredClientes.length} clientes
                  </div>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="text-xs hidden sm:inline-flex"
                      title="Primeira página"
                    >
                      <ChevronsLeft className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="text-xs"
                    >
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {(() => {
                        const pages = [];
                        const maxVisiblePages = windowWidth < 768 ? 3 : 5;
                        
                        if (totalPages <= maxVisiblePages) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(
                              <Button
                                key={i}
                                variant={currentPage === i ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(i)}
                                className="w-8 h-8 p-0 text-xs"
                              >
                                {i}
                              </Button>
                            );
                          }
                        } else {
                          pages.push(
                            <Button
                              key={1}
                              variant={currentPage === 1 ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(1)}
                              className="w-8 h-8 p-0 text-xs"
                            >
                              1
                            </Button>
                          );
                          
                          let startPage = Math.max(2, currentPage - 1);
                          let endPage = Math.min(totalPages - 1, currentPage + 1);
                          
                          if (currentPage <= 3) {
                            startPage = 2;
                            endPage = Math.min(totalPages - 1, maxVisiblePages - 1);
                          }
                          
                          if (currentPage >= totalPages - 2) {
                            startPage = Math.max(2, totalPages - (maxVisiblePages - 1));
                            endPage = totalPages - 1;
                          }
                          
                          if (startPage > 2) {
                            pages.push(
                              <span key="ellipsis1" className="px-2 text-xs text-gray-500">
                                ...
                              </span>
                            );
                          }
                          
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <Button
                                key={i}
                                variant={currentPage === i ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(i)}
                                className="w-8 h-8 p-0 text-xs"
                              >
                                {i}
                              </Button>
                            );
                          }
                          
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="ellipsis2" className="px-2 text-xs text-gray-500">
                                ...
                              </span>
                            );
                          }
                          
                          if (totalPages > 1) {
                            pages.push(
                              <Button
                                key={totalPages}
                                variant={currentPage === totalPages ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                className="w-8 h-8 p-0 text-xs"
                              >
                                {totalPages}
                              </Button>
                            );
                          }
                        }
                        
                        return pages;
                      })()}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="text-xs"
                    >
                      Próxima
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="text-xs hidden sm:inline-flex"
                      title="Última página"
                    >
                      <ChevronsRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione um Lote</h3>
            <p className="text-gray-600">Escolha um lote acima para visualizar os clientes</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compliance; 