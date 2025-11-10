import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, 
  DollarSign, 
  Clock, 
  AlertCircle,
  CheckCircle,
  FileText,
  Database,
  Upload,
  Eye,
  X,
  Search
} from "lucide-react";
import { DashboardMetrics } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Lote {
  id: number;
  nome_arquivo: string;
  data_lote: string;
  importado_em: string;
  total_registros: number;
}

interface Cliente {
  id: number;
  numero_contrato: string;
  especie: string;
  nome_cliente: string;
  codigo_titulo: string;
  cpf_cnpj: string;
  valor_atual: number;
  dias_atraso: number;
  data_vencimento: string;
  created_at: string;
}

const Dashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClientes: 0,
    totalReceitas: 0,
    clientesAtrasados: 0,
    totalComissao: 0,
    mediaAtraso: 0,
    taxaRecuperacao: 0,
    clientesComAudio: 0
  });
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [clientesLote, setClientesLote] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loteSelecionado, setLoteSelecionado] = useState<Lote | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [buscaClientes, setBuscaClientes] = useState("");
  const { toast } = useToast();

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5175';

  const fetchLotes = async () => {
    setLoadingLotes(true);
    try {
      const response = await fetch(`${API_BASE}/api/lotes`);
      const data = await response.json();
      console.log('LOTES:', data);
      setLotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar lotes:', err);
      setLotes([]);
    } finally {
      setLoadingLotes(false);
    }
  };

  const fetchClientesDoLote = async (loteId: number) => {
    setLoadingClientes(true);
    try {
      const response = await fetch(`${API_BASE}/api/clientes/${loteId}/clientes`);
      const data = await response.json();
      console.log('CLIENTES DO LOTE:', data);
      setClientesLote(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar clientes do lote:', err);
      setClientesLote([]);
      toast({
        title: "Erro",
        description: "Erro ao buscar clientes do lote",
        variant: "destructive",
      });
    } finally {
      setLoadingClientes(false);
    }
  };

  const abrirModalClientes = (lote: Lote) => {
    setLoteSelecionado(lote);
    setModalAberto(true);
    fetchClientesDoLote(lote.id);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileContent = await file.text();
      const nomeArquivo = file.name;
      
      // Verificar tamanho do arquivo antes de enviar
      if (fileContent.length > 40 * 1024 * 1024) { // 40MB
        throw new Error('Arquivo muito grande. Tamanho máximo permitido: 40MB');
      }
      
      const response = await fetch(`${API_BASE}/api/lotes/importar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvContent: fileContent,
          nomeArquivo: nomeArquivo,
          dataLote: new Date().toISOString().split('T')[0]
        }),
      });

      // Verificar se a resposta é JSON válida
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Resposta não é JSON:', textResponse.substring(0, 200));
        
        if (response.status === 413) {
          throw new Error('Arquivo muito grande para upload. Tente dividir o arquivo em partes menores.');
        } else {
          throw new Error(`Erro do servidor (${response.status}): ${textResponse.substring(0, 100)}`);
        }
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Sucesso!",
          description: result.message,
        });
        
        // Atualizar lista de lotes
        await fetchLotes();
      } else {
        throw new Error(result.error || 'Erro ao importar arquivo');
      }
    } catch (error) {
      console.error('Erro ao importar arquivo:', error);
      toast({
        title: "Erro",
        description: `Erro ao importar arquivo: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  useEffect(() => {
    fetchLotes();
    
    // Buscar ocorrências para o dashboard
    fetch(`${API_BASE}/api/ocorrencias`)
      .then(res => res.json())
      .then(ocorrencias => {
        console.log('OCORRENCIAS:', ocorrencias);

        // Verificar se ocorrências é um array
        const ocorrenciasArray = Array.isArray(ocorrencias) ? ocorrencias : [];

        setMetrics({
          totalClientes: ocorrenciasArray.length,
          totalReceitas: ocorrenciasArray.reduce((acc, o) => acc + (Number(o.valor_recebido) || 0), 0),
          clientesAtrasados: ocorrenciasArray.filter(o => Number(o.atraso) > 0).length,
          totalComissao: ocorrenciasArray.reduce((acc, o) => acc + (Number(o.comissao) || 0), 0),
          mediaAtraso: ocorrenciasArray.length
            ? Math.round(ocorrenciasArray.reduce((acc, o) => acc + (Number(o.atraso) || 0), 0) / ocorrenciasArray.length)
            : 0,
          taxaRecuperacao: 0,
          clientesComAudio: ocorrenciasArray.filter(o => o.audio_id).length,
        });
      })
      .catch(err => {
        console.error('Erro ao buscar ocorrências:', err);
        // Fallback para clientes se ocorrências não existir
        fetch(`${API_BASE}/api/clientes`)
          .then(res => res.json())
          .then(raw => {
            const clientes = Array.isArray(raw)
              ? raw
              : Array.isArray(raw?.data)
                ? raw.data
                : [];

            const totalClientes = clientes.length;
            const totalReceitas = clientes.reduce((acc, c) => acc + (Number(c.valor_atual || c.valor_recebido) || 0), 0);
            const clientesAtrasados = clientes.filter(c => Number(c.dias_atraso || c.atraso) > 0).length;
            const mediaAtraso = clientes.length
              ? Math.round(clientes.reduce((acc, c) => acc + (Number(c.dias_atraso || c.atraso) || 0), 0) / clientes.length)
              : 0;

            setMetrics({
              totalClientes,
              totalReceitas,
              clientesAtrasados,
              totalComissao: 0,
              mediaAtraso,
              taxaRecuperacao: 0,
              clientesComAudio: 0,
            });
          })
          .catch(err => {
            console.error('Erro ao buscar clientes:', err);
          });
      });
  }, []);

  // Função para corrigir problema de fuso horário na data
  const corrigirDataLote = (data: string) => {
    if (!data) return 'Data não informada';
    try {
      const dataObj = new Date(data);
      return dataObj.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <Badge variant="outline" className="text-xs">
          Sistema de Cancelamentos
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalClientes.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% em relação ao mês anterior
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.totalReceitas)}</div>
                <p className="text-xs text-muted-foreground">
                  +15.3% em relação ao mês anterior
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Atrasados</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.clientesAtrasados.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.totalClientes > 0 ? Math.round((metrics.clientesAtrasados / metrics.totalClientes) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média de Atraso</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.mediaAtraso} dias</div>
                <p className="text-xs text-muted-foreground">
                  Tempo médio de atraso
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Média de Atraso</span>
                  <span className="text-lg font-bold">{metrics.mediaAtraso} dias</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Clientes Atrasados</span>
                  <span className="text-lg font-bold">{metrics.clientesAtrasados}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Clientes com Áudio</span>
                  <span className="text-lg font-bold">{metrics.clientesComAudio}</span>
                </div>
              </CardContent>
            </Card>

            {/* Nova seção de Upload */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Importar Novo Lote
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : uploading 
                        ? 'border-gray-300 bg-gray-50' 
                        : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {uploading ? (
                    <div className="space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-lg font-medium">Solte seu arquivo CSV aqui</p>
                        <p className="text-sm text-muted-foreground">
                          ou{" "}
                          <label htmlFor="file-upload" className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                            clique para selecionar
                          </label>
                        </p>
                      </div>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      <p className="text-xs text-gray-500">
                        Apenas arquivos CSV são aceitos
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção de lotes atualizada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Database className="h-4 w-4" />
                Lotes de Cancelamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLotes ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Carregando lotes...</p>
                </div>
              ) : lotes.length > 0 ? (
                <div className="space-y-3">
                  {lotes.map((lote) => (
                    <div key={lote.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            Lote {lote.id}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {corrigirDataLote(lote.data_lote)}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate" title={lote.nome_arquivo}>
                          {lote.nome_arquivo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lote.total_registros?.toLocaleString() || 0} registros
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Importado em
                          </div>
                          <div className="text-xs font-medium">
                            {corrigirDataLote(lote.importado_em)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirModalClientes(lote)}
                          className="ml-2"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                      </div>
                    </div>
                  ))}
                  {lotes.length > 5 && (
                    <div className="text-center pt-2">
                      <p className="text-xs text-muted-foreground">
                        +{lotes.length - 5} lotes adicionais
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lote encontrado</p>
                  <p className="text-xs text-muted-foreground">Importe um arquivo CSV para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lotes" className="space-y-4">
          {/* Seção de lotes atualizada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Database className="h-4 w-4" />
                Lotes de Cancelamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLotes ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Carregando lotes...</p>
                </div>
              ) : lotes.length > 0 ? (
                <div className="space-y-3">
                  {lotes.map((lote) => (
                    <div key={lote.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            Lote {lote.id}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {corrigirDataLote(lote.data_lote)}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate" title={lote.nome_arquivo}>
                          {lote.nome_arquivo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lote.total_registros?.toLocaleString() || 0} registros
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            Importado em
                          </div>
                          <div className="text-xs font-medium">
                            {corrigirDataLote(lote.importado_em)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirModalClientes(lote)}
                          className="ml-2"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                      </div>
                    </div>
                  ))}
                  {lotes.length > 5 && (
                    <div className="text-center pt-2">
                      <p className="text-xs text-muted-foreground">
                        +{lotes.length - 5} lotes adicionais
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lote encontrado</p>
                  <p className="text-xs text-muted-foreground">Importe um arquivo CSV para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para visualizar clientes do lote */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes do Lote {loteSelecionado?.id}
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              {loteSelecionado?.nome_arquivo} - {loteSelecionado?.total_registros} registros
            </div>
          </DialogHeader>
          
          {/* Barra de Pesquisa */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou número do contrato..."
                value={buscaClientes}
                onChange={(e) => setBuscaClientes(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-[60vh]">
            {loadingClientes ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Carregando clientes...</p>
              </div>
            ) : clientesLote.filter(cliente => 
                cliente.nome_cliente.toLowerCase().includes(buscaClientes.toLowerCase()) ||
                cliente.numero_contrato.includes(buscaClientes)
              ).length > 0 ? (
              <div className="space-y-2">
                {clientesLote.filter(cliente => 
                  cliente.nome_cliente.toLowerCase().includes(buscaClientes.toLowerCase()) ||
                  cliente.numero_contrato.includes(buscaClientes)
                ).map((cliente) => (
                  <div key={cliente.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {cliente.numero_contrato}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {cliente.especie}
                          </Badge>
                          {cliente.dias_atraso > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {cliente.dias_atraso} dias atraso
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate" title={cliente.nome_cliente}>
                          {cliente.nome_cliente}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>CPF: {cliente.cpf_cnpj}</span>
                          <span>Título: {cliente.codigo_titulo}</span>
                          {cliente.data_vencimento && (
                            <span>Venc: {new Date(cliente.data_vencimento).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          R$ {cliente.valor_atual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {buscaClientes ? 'Nenhum cliente encontrado para a busca' : 'Nenhum cliente encontrado neste lote'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
