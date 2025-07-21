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
    fetch('https://acessovipunimedgithubio-production.up.railway.app/api/clientes')
      .then(res => res.json())
      .then(clientes => {
        console.log('CLIENTES:', clientes); // Depuração
        const totalClientes = clientes.length;
        // Soma simples de valor_recebido
        const totalReceitas = clientes.reduce((acc, c) => acc + (Number(c.valor_recebido) || 0), 0);
        const clientesAtrasados = clientes.filter(c => Number(c.atraso) > 0).length;
        const totalComissao = clientes.reduce((acc, c) => {
          const valor = Number(c.comissao);
          return acc + (isNaN(valor) ? 0 : valor);
        }, 0);
        const mediaAtraso = clientes.length
          ? Math.round(clientes.reduce((acc, c) => acc + (Number(c.atraso) || 0), 0) / clientes.length)
          : 0;
        const clientesComAudio = clientes.filter(c => c.audio_id).length;

        setMetrics({
          totalClientes,
          totalReceitas,
          clientesAtrasados,
          totalComissao,
          mediaAtraso,
          taxaRecuperacao: 0, // implementar se desejar
          clientesComAudio, // adicionar ao objeto
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
    <div className="space-y-4 p-2 sm:p-4 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Visão geral do sistema de gestão de clientes</p>
        </div>
        {/* Removidos os botões Sistema Online e Relatório */}
      </div>
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes Auditados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalClientes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Auditado Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalReceitas)}</div>
          </CardContent>
        </Card>

        {/* Card fictício Lote_001 */}
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-1 font-medium">Lote_001_Unimed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">Assunto:</div>
            <div className="text-lg font-semi mb-1">RELAÇÃO DE ÊXITO NA COBRANÇA DE FATURAS INADIMPLENTES UNIMED CAMPO GRANDE-MS - FORNECEDOR PARCEIRO: PORTES.</div>
            <div className="text-sm font-semibold">Email:</div>
            <div className="text-xl font-bold mb-1">tiago.fruhauf@unimedcg.coop.br</div>
            <div className="text-sm font-semibold">Data:</div>
            <div className="text-l font-bold">15/07/2025</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-3 mt-4 h-1/2">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        </TabsList>


        

        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo Financeiro</CardTitle>
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
                <CardTitle>Status dos Clientes</CardTitle>
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
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-sm">Com Áudio</span>
                  </div>
                  <span className="font-semibold">{metrics.clientesComAudio || 0}</span>
                </div>
                {/* Novo status: Com Arquivos */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Com Arquivos</span>
                  </div>
                  <span className="font-semibold">182</span> {/* Troque para valor real se implementar contagem */}
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Novo card de decisão de auditagem */}
          <div className="max-w-full sm:max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Decisão da Auditagem</CardTitle>
                <p className="text-muted-foreground text-sm mt-1">Conforme sistema de gestão de qualidade ISO 9001:2015.</p>
              </CardHeader>
              <CardContent>
                <AuditActionsCard />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Removidas as abas e conteúdos de Atividades e Analytics */}
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
      const res = await fetch("https://acessovipunimedgithubio-production.up.railway.app/api/audit", {
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
          className={
            `flex-1 transition-colors ${selected === "aprovado" ? "bg-green-600 hover:bg-green-700 text-white" : "hover:bg-green-100 hover:text-green-800"}`
          }
          onClick={() => handleSelect("aprovado")}
        >
          Aprovar todos auditados
        </Button>
        <Button
          type="button"
          variant={selected === "nao-conforme" ? "default" : "outline"}
          className={`flex-1 transition-colors ${selected === "nao-conforme" ? "bg-destructive text-white" : "hover:bg-destructive/10 hover:text-destructive"}`}
          onClick={() => handleSelect("nao-conforme")}
        >
          Não conforme
        </Button>
        <Button
          type="button"
          variant={selected === "pontos-melhoria" ? "default" : "outline"}
          className={`flex-1 transition-colors ${selected === "pontos-melhoria" ? "bg-yellow-400 text-black" : "hover:bg-yellow-100 hover:text-yellow-900"}`}
          onClick={() => handleSelect("pontos-melhoria")}
        >
          Pontos de melhoria
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