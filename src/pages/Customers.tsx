import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  Filter, 
  Download, 
  Play, 
  Pause, 
  Volume2,
  Calendar,
  DollarSign,
  Clock,
  User,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle,
  MoreHorizontal,
  Edit,
  FileAudio,
  Paperclip,
  FileText,
  Image,
  File
} from "lucide-react";
import { Customer, Attachment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import React, { useRef } from "react";

// Função para normalizar CPF/CNPJ (remove pontos, traços, barras, espaços)
function normalizaCpfCnpj(str: string) {
  return str.replace(/[\.\-\/]/g, '').replace(/\s/g, '');
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderBy, setOrderBy] = useState("recent");
  const [acaoFilter, setAcaoFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAudioDialogOpen, setIsAudioDialogOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAttachmentsDialogOpen, setIsAttachmentsDialogOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { toast } = useToast();
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API}/api/clientes`)
      .then((res) => res.json())
      .then((data) => {
        // Mapear campos do backend para o formato esperado pelo front
        const mappedCustomers = data.map((c: any) => {
          // Usa o CPF/CNPJ original (com pontuação) para montar a URL do áudio
          const cpfcnpjOriginal = c.cpf_cnpj;
          let audioFileName = undefined;
          if (cpfcnpjOriginal) {
            audioFileName = c.audio_id || undefined;
          }
          return {
            id: c.id,
            credor: c.credor,
            cpfCnpj: c.cpf_cnpj,
            taAuto: c.titulo,
            matricula: c.matricula,
            nome: c.nome,
            vencimento: c.vencimento,
            atraso: c.atraso,
            valorRecebido: c.valor_recebido,
            plano: c.plano,
            dataPromessaPagamento: c.data_pp,
            dataVencimento: c.data_pgto,
            comissao: c.comissao,
            acao: c.acao,
            sms: c.sms ? "SIM" : "NÃO",
            ura: c.ura ? "SIM" : "NÃO",
            envioNegociacao: c.envio_negociacao,
            audioUrl: cpfcnpjOriginal ? `${import.meta.env.VITE_API}/download/${cpfcnpjOriginal}` : undefined,
            audioName: audioFileName,
            audioUploadDate: undefined // Não há campo correspondente
          };
        });
        setCustomers(mappedCustomers);
        setFilteredCustomers(mappedCustomers);
      })
      .catch(() => {
        setCustomers([]);
        setFilteredCustomers([]);
      });
  }, []); // <--- array vazio: executa só uma vez ao montar o componente

  useEffect(() => {
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.cpfCnpj.includes(searchTerm) ||
        customer.credor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(customer => {
        if (statusFilter === "overdue") return customer.atraso > 0;
        if (statusFilter === "withAudio") return customer.audioUrl;
        if (statusFilter === "upToDate") return customer.atraso <= 0;
        return true;
      });
    }

    if (acaoFilter !== "all") {
      filtered = filtered.filter(customer => customer.acao && customer.acao.toLowerCase() === acaoFilter);
    }

    // Ordenação por prioridade: ACD > URA > outros
    filtered = filtered.slice().sort((a, b) => {
      const getPriority = (acao) => {
        if (!acao) return 2;
        const acaoLower = acao.toLowerCase();
        if (acaoLower === "acd") return 0;
        if (acaoLower === "ura") return 1;
        return 2;
      };
      const priorityA = getPriority(a.acao);
      const priorityB = getPriority(b.acao);
      if (priorityA !== priorityB) return priorityA - priorityB;
      // Se mesma prioridade, ordenar por dataVencimento (ou outro campo de data)
      const dateA = a.dataVencimento ? new Date(a.dataVencimento.split('/').reverse().join('-')) : new Date(0);
      const dateB = b.dataVencimento ? new Date(b.dataVencimento.split('/').reverse().join('-')) : new Date(0);
      if (orderBy === "recent") {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });

    setFilteredCustomers(filtered);
    setCurrentPage(1); // Sempre volta para a primeira página ao filtrar
  }, [customers, searchTerm, statusFilter, orderBy, acaoFilter]);

  // Paginação: calcular clientes da página atual
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString.split('/').reverse().join('-')).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (atraso: number) => {
    if (atraso > 60) {
      return <Badge variant="destructive">Alto Atraso</Badge>;
    } else if (atraso > 30) {
      return <Badge variant="secondary" className="bg-warning text-warning-foreground">Médio Atraso</Badge>;
    } else if (atraso > 0) {
      return <Badge variant="outline">Baixo Atraso</Badge>;
    } else {
      return <Badge variant="default" className="bg-success text-success-foreground">Em Dia</Badge>;
    }
  };

  const handleAudioUpload = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsAudioDialogOpen(true);
  };

  const handleAudioSave = () => {
    if (selectedCustomer && audioFile) {
      const updatedCustomers = customers.map(customer =>
        customer.id === selectedCustomer.id
          ? {
              ...customer,
              audioUrl: URL.createObjectURL(audioFile),
              audioName: audioFile.name,
              audioUploadDate: new Date().toLocaleDateString('pt-BR')
            }
          : customer
      );

      setCustomers(updatedCustomers);
      setAudioFile(null);
      setIsAudioDialogOpen(false);
      setSelectedCustomer(null);

      toast({
        title: "Áudio salvo com sucesso!",
        description: `Áudio associado ao cliente ${selectedCustomer.nome}`,
      });
    }
  };

  const loadAttachments = async (cpf: string) => {
    try {
      const encodedCpf = encodeURIComponent(cpf);
      console.log('Buscando anexos para:', cpf, '→ URL codificada:', encodedCpf);
      const response = await fetch(`${import.meta.env.VITE_API}/api/attachments/${encodedCpf}`);
      const data = await response.json();
      setAttachments(data);
    } catch (error) {
      console.error('Erro ao carregar anexos:', error);
      setAttachments([]);
    }
  };

  const handleAttachmentsClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsAttachmentsDialogOpen(true);
    await loadAttachments(customer.cpfCnpj);
  };

  const handleAttachmentDownload = (fileName: string, originalName: string) => {
    window.open(`${import.meta.env.VITE_API}/api/attachments/download/${fileName}`, '_blank');
  };

  const handleDownloadAllAttachments = () => {
    if (!selectedCustomer || attachments.length === 0) return;
    
    // Para cada anexo, abrir em uma nova aba (o navegador vai baixar automaticamente)
    attachments.forEach(attachment => {
      window.open(`${import.meta.env.VITE_API}/api/attachments/download/${attachment.fileName}`, '_blank');
    });
    
    toast({
      title: "Download iniciado!",
      description: `${attachments.length} anexo(s) sendo baixado(s)`,
    });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestão de Clientes</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Visualize e gerencie todos os clientes do sistema</p>
        </div>
        {/* Removidos os botões Exportar e Importar */}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou credor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {/* Filtro de status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
            </Select>
            {/* Filtro de ordenação */}
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Selecionar</SelectItem>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="oldest">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
            {/* Filtro por ação */}
            <Select value={acaoFilter} onValueChange={setAcaoFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="ura">URA</SelectItem>
                <SelectItem value="acd">ACD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Lista de Clientes ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Cards para mobile */}
          <div className="block sm:hidden space-y-3">
            {paginatedCustomers.map((customer) => (
              <div key={customer.id} className="rounded-lg border p-3 flex flex-col gap-2 bg-white shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-full">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium break-words max-w-[120px]">{customer.nome}</div>
                    <div className="text-xs text-muted-foreground">Mat: {customer.matricula}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold">CPF/CNPJ:</span> {customer.cpfCnpj}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold">Credor:</span> {customer.credor}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold">Valor:</span> {formatCurrency(customer.valorRecebido)}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold">Data da ação:</span> {customer.dataVencimento}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold">Última Ação:</span> {customer.acao}
                </div>
                {/* Removido bloco de áudio */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-muted/50 text-muted-foreground">
                    Sem áudio
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAttachmentsClick(customer)}
                    className="flex items-center gap-1 px-2 h-8 text-xs"
                    style={{ minWidth: 0 }}
                  >
                    <Paperclip className="h-4 w-4" />
                    Anexos
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {/* Tabela para telas maiores */}
          <div className="rounded-md border overflow-x-auto hidden sm:block">
            <Table className="min-w-[700px] text-xs sm:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap">CPF/CNPJ</TableHead>
                  <TableHead className="whitespace-nowrap">Credor</TableHead>
                  <TableHead className="whitespace-nowrap">Valor</TableHead>
                  <TableHead className="whitespace-nowrap">Data da ação</TableHead>
                  <TableHead className="whitespace-nowrap">Ultima Ação</TableHead>
                  {/* Removido TableHead de Áudios */}
                  <TableHead className="whitespace-nowrap">
                    Anexos para download
                    <div className="text-xs text-muted-foreground leading-tight">(Evidências de atendimento)</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="table-row">
                    <TableCell>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-primary/10 rounded-full">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium break-words max-w-[120px] sm:max-w-none">{customer.nome}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Mat: {customer.matricula}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium break-words max-w-[90px] sm:max-w-none">{customer.cpfCnpj}</TableCell>
                    <TableCell className="break-words max-w-[90px] sm:max-w-none">{customer.credor}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(customer.valorRecebido)}</TableCell>
                    <TableCell>{customer.dataVencimento}</TableCell>
                    <TableCell>{customer.acao}</TableCell>
                    {/* Removido TableCell de Áudios */}
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAttachmentsClick(customer)}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 h-8 sm:h-9 text-xs sm:text-sm"
                        style={{ minWidth: 0 }}
                      >
                        <Paperclip className="h-4 w-4" />
                        <span>Anexos para download</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
         {/* Controles de Paginação */}
         {totalPages > 1 && (
           <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
             <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
               Anterior
             </Button>
             {Array.from({ length: totalPages }, (_, i) => (
               <Button
                 key={i + 1}
                 size="sm"
                 variant={currentPage === i + 1 ? "default" : "outline"}
                 onClick={() => setCurrentPage(i + 1)}
               >
                 {i + 1}
               </Button>
             ))}
             <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
               Próxima
             </Button>
           </div>
         )}
        </CardContent>
      </Card>

      {/* Dialog para Upload de Áudio */}
      <Dialog open={isAudioDialogOpen} onOpenChange={setIsAudioDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Associar Áudio ao Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-info">Cliente</Label>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedCustomer?.nome}</div>
                <div className="text-sm text-muted-foreground">
                  CPF: {selectedCustomer?.cpfCnpj}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audio-file">Arquivo de Áudio</Label>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="audio-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Volume2 className="w-8 h-8 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Clique para enviar</span> ou arraste o arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">MP3, WAV, M4A (MAX. 10MB)</p>
                  </div>
                  <input
                    id="audio-file"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {audioFile && (
                <div className="text-sm text-muted-foreground">
                  Arquivo selecionado: {audioFile.name}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAudioDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAudioSave}
                disabled={!audioFile}
              >
                Salvar Áudio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Gerenciar Anexos */}
      <Dialog open={isAttachmentsDialogOpen} onOpenChange={setIsAttachmentsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Anexos - {selectedCustomer?.nome}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Informações do Cliente */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">CPF/CNPJ:</span> {selectedCustomer?.cpfCnpj}
                </div>
                <div>
                  <span className="font-medium">Matrícula:</span> {selectedCustomer?.matricula}
                </div>
              </div>
            </div>

            {/* Lista de Anexos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Anexos para download ({attachments.length})</h3>
                {attachments.length > 0 && (
                  <Button
                    onClick={handleDownloadAllAttachments}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Todos
                  </Button>
                )}
              </div>
              
              {attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum anexo encontrado</p>
                  <p className="text-sm">Adicione anexos usando o formulário acima</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(attachment.fileType)}
                        <div>
                          <div className="font-medium">{attachment.originalName}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(attachment.fileSize)} • {new Date(attachment.uploadDate).toLocaleDateString('pt-BR')}
                          </div>
                          {attachment.description && (
                            <div className="text-sm text-muted-foreground">
                              {attachment.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAttachmentDownload(attachment.fileName, attachment.originalName)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;