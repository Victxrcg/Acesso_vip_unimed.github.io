import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  Activity,
  BarChart3
} from "lucide-react";
import { DashboardMetrics } from "@/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // Buscar ocorrências para o dashboard
    fetch(`${API_BASE}/api/ocorrencias`)
      .then(res => res.json())
      .then(ocorrencias => {
        console.log('OCORRENCIAS:', ocorrencias); // Para depuração

        // Exemplo de métricas (ajuste conforme os campos da sua tabela)
        setMetrics({
          totalClientes: ocorrencias.length,
          totalReceitas: ocorrencias.reduce((acc, o) => acc + (Number(o.valor_recebido) || 0), 0),
          clientesAtrasados: ocorrencias.filter(o => Number(o.atraso) > 0).length,
          totalComissao: ocorrencias.reduce((acc, o) => acc + (Number(o.comissao) || 0), 0),
          mediaAtraso: ocorrencias.length
            ? Math.round(ocorrencias.reduce((acc, o) => acc + (Number(o.atraso) || 0), 0) / ocorrencias.length)
            : 0,
          taxaRecuperacao: 0, // implemente se desejar
          clientesComAudio: ocorrencias.filter(o => o.audio_id).length,
        });
      })
      .catch(err => {
        console.error('Erro ao buscar ocorrências:', err);
        // Fallback para clientes se ocorrências não existir
        fetch(`${API_BASE}/api/clientes`)
          .then(res => res.json())
          .then(clientes => {
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
          });
      });
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // TODO: Integrar atividades recentes reais da API
  // Removido recentActivities

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-success text-success-foreground';
      case 'warning': return 'bg-warning text-warning-foreground';
      case 'info': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'payment': return <DollarSign className="h-4 w-4" />;
      case 'overdue': return <AlertCircle className="h-4 w-4" />;
      case 'contact': return <Users className="h-4 w-4" />;
      case 'audio': return <Activity className="h-4 w-4" />;
      case 'promise': return <Calendar className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Visão geral do sistema de gestão de clientes</p>
        </div>
        {/* Removidos os botões Sistema Online e Relatório */}
      </div>
      
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm sm:text-base font-medium truncate pr-2">Total de Clientes Auditados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{metrics.totalClientes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm sm:text-base font-medium truncate pr-2">Valor Auditado Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{formatCurrency(metrics.totalReceitas)}</div>
          </CardContent>
        </Card>

        {/* Card fictício Lote_001 */}
        <Card className="metric-card sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm sm:text-base font-medium truncate pr-2">Lote_001_Unimed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-semibold text-gray-600">Assunto:</div>
              <div className="text-xs sm:text-sm leading-relaxed break-words">
                RELAÇÃO DE ÊXITO NA COBRANÇA DE FATURAS INADIMPLENTES UNIMED CAMPO GRANDE-MS - FORNECEDOR PARCEIRO: PORTES.
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-semibold text-gray-600">Email:</div>
              <div className="text-xs sm:text-sm font-medium break-all">
                tiago.fruhauf@unimedcg.coop.br
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-semibold text-gray-600">Data:</div>
              <div className="text-xs sm:text-sm font-medium">15/07/2025</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-3 mt-4">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Removido Total de Comissões */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Média de Atraso</span>
                  <span className="text-lg font-bold">{metrics.mediaAtraso} dias</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Status dos Clientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm">Em Dia</span>
                  </div>
                  <span className="font-semibold">{metrics.totalClientes - metrics.clientesAtrasados}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Atrasados</span>
                  </div>
                  <span className="font-semibold">{metrics.clientesAtrasados}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;

function AuditActionsCard() {
  const [selected, setSelected] = useState<string>("");
  const [melhoria, setMelhoria] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("auditDecision");
    if (saved) {
      const { tipo, melhoria } = JSON.parse(saved);
      setSelected(tipo);
      setMelhoria(melhoria);
    }
  }, []);

  const handleSelect = (value: string) => {
    setSelected(value);
  };

  const handleSave = async () => {
    localStorage.setItem(
      "auditDecision",
      JSON.stringify({ tipo: selected, melhoria })
    );
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: selected, melhoria })
      });
      if (res.ok) {
        toast({
          title: "Decisão salva com sucesso!",
          description: selected === "pontos-melhoria" && melhoria ? `Pontos de melhoria: ${melhoria}` : "Arquivo .txt gerado.",
          variant: "default",
        });
      } else {
        const data = await res.json();
        toast({
          title: "Erro ao salvar decisão no servidor",
          description: data.error || "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro de conexão com o servidor",
        description: "Não foi possível salvar a decisão.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Button
          type="button"
          variant={selected === "aprovado" ? "default" : "outline"}
          className={`flex-1 transition-colors ${selected === "aprovado" ? "bg-green-500 text-white" : "hover:bg-green-100 hover:text-green-900"}`}
          onClick={() => handleSelect("aprovado")}
        >
          Aprovar todos auditados
        </Button>
        <Button
          type="button"
          variant={selected === "pontos-melhoria" ? "default" : "outline"}
          className={`flex-1 transition-colors ${selected === "pontos-melhoria" ? "bg-yellow-400 text-black" : "hover:bg-yellow-100 hover:text-yellow-900"}`}
          onClick={() => handleSelect("pontos-melhoria")}
        >
          pontos de melhoria
        </Button>
        <Button
          type="button"
          variant={selected === "nao-conforme" ? "default" : "outline"}
          className={`flex-1 transition-colors ${selected === "nao-conforme" ? "bg-red-500 text-white" : ""}`}
          onClick={() => handleSelect("nao-conforme")}
        >
          Não conforme
        </Button>
      </div>
      {selected === "pontos-melhoria" && (
        <div className="mt-4">
          <Label htmlFor="melhoria" className="mb-1 block">Descreva os pontos de melhoria</Label>
          <Textarea
            id="melhoria"
            placeholder="Ex: Melhorar o processo de contato, revisar documentação..."
            value={melhoria}
            onChange={e => setMelhoria(e.target.value)}
            className="resize-none"
          />
        </div>
      )}
      <div className="pt-6">
        <Button disabled={!selected} className="w-full" onClick={handleSave}>Salvar decisão</Button>
      </div>
    </div>
  );
}