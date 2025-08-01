import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, 
 
  Download, 
  Play, 
  Pause, 
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
  return str.replace(/[.-/]/g, '').replace(/\s/g, '');
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [acaoFilter, setAcaoFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPlaying, setIsPlaying] = useState<number | null>(null);
  const [isAttachmentsDialogOpen, setIsAttachmentsDialogOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAudiosDialogOpen, setIsAudiosDialogOpen] = useState(false);
  const [audios, setAudios] = useState<Attachment[]>([]);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(100);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [audioLoop, setAudioLoop] = useState(false);
  const { toast } = useToast();
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Troque a base das URLs para a produção
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        console.log('Buscando clientes da tabela ocorrencia...');
        const response = await fetch(`${API_BASE}/api/ocorrencias`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Clientes carregados:', data);
        
        // Transformar dados da tabela ocorrencia para o formato esperado
        const transformedCustomers = data.map((ocorrencia: Record<string, unknown>) => ({
          id: Number(ocorrencia.id),
          nome: String(ocorrencia.nome || 'Nome não informado'),
          cpfCnpj: String(ocorrencia.cpf_cnpj),
          credor: String(ocorrencia.credor),
          titulo: String(ocorrencia.titulo || 'N/A'),
          matricula: String(ocorrencia.matricula || 'N/A'),
          valorRecebido: parseFloat(String(ocorrencia.valor_recebido)) || 0,
          dataVencimento: ocorrencia.vencimento ? new Date(String(ocorrencia.vencimento)).toLocaleDateString('pt-BR') : 'N/A',
          atraso: Number(ocorrencia.atraso_dias) || 0,
          acao: String(ocorrencia.acao || 'N/A'),
          plano: ocorrencia.plano ? String(ocorrencia.plano) : undefined,
          dataPromessaPg: ocorrencia.data_promessa_pg ? new Date(String(ocorrencia.data_promessa_pg)).toLocaleDateString('pt-BR') : undefined,
          dataPagamento: ocorrencia.data_pagamento ? new Date(String(ocorrencia.data_pagamento)).toLocaleDateString('pt-BR') : undefined,
          comissao: parseFloat(String(ocorrencia.comissao)) || 0,
          smsEnviado: ocorrencia.sms_enviado === 1,
          uraEnviado: ocorrencia.ura_enviado === 1,
          envioNegociacao: ocorrencia.envio_negociacao ? new Date(String(ocorrencia.envio_negociacao)).toLocaleDateString('pt-BR') : undefined,
          audioUrl: null, // Será carregado separadamente se necessário
          audioName: null,
          audioUploadDate: null
        }));
        
        setCustomers(transformedCustomers);
        setFilteredCustomers(transformedCustomers);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        toast({
          title: "Erro ao carregar clientes",
          description: "Não foi possível carregar os dados dos clientes.",
          variant: "destructive",
        });
        setCustomers([]);
        setFilteredCustomers([]);
      }
    };

    fetchCustomers();
  }, [API_BASE, toast]);

  useEffect(() => {
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.cpfCnpj.includes(searchTerm) ||
        customer.credor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (acaoFilter !== "all") {
      filtered = filtered.filter(customer => customer.acao && customer.acao.toLowerCase() === acaoFilter);
    }

    // Ordenação por prioridade: ACD > URA > outros
    filtered = filtered.slice().sort((a, b) => {
      const getPriority = (acao: string) => {
        if (!acao) return 2;
        const acaoLower = acao.toLowerCase();
        if (acaoLower === "acd") return 0;
        if (acaoLower === "ura") return 1;
        return 2;
      };
      const priorityA = getPriority(a.acao);
      const priorityB = getPriority(b.acao);
      return priorityA - priorityB;
    });

    setFilteredCustomers(filtered);
    setCurrentPage(1); // Sempre volta para a primeira página ao filtrar
  }, [customers, searchTerm, acaoFilter]);

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





  const handlePlayPause = (customer: Customer) => {
    const ref = audioRefs.current[customer.id];
    if (!ref) return;
    if (isPlaying === customer.id) {
      ref.pause();
      setIsPlaying(null);
    } else {
      // Pausa qualquer outro áudio tocando
      Object.values(audioRefs.current).forEach(a => { if (a && !a.paused) a.pause(); });
      ref.currentTime = 0;
      ref.play();
      setIsPlaying(customer.id);
    }
  };

  const loadAttachments = async (ocorrenciaId: number) => {
    try {
      console.log('Buscando anexos para ocorrência:', ocorrenciaId);
      const response = await fetch(`${API_BASE}/api/ocorrencias/${ocorrenciaId}/media`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Anexos carregados:', data);
      
      // Transformar dados da tabela media para o formato esperado
      const transformedAttachments = data.map((media: Record<string, unknown>) => ({
        id: String(media.id),
        fileName: String(media.file_name),
        originalName: String(media.file_name), // Usar file_name como originalName
        fileType: String(media.mime_type || 'application/octet-stream'),
        fileSize: Number(media.file_size_bytes) || 0,
        uploadDate: String(media.uploaded_at),
        description: `${String(media.media_type)} - ${String(media.file_name)}`,
        mediaType: String(media.media_type)
      }));
      
      setAttachments(transformedAttachments);
    } catch (error) {
      console.error('Erro ao carregar anexos:', error);
      setAttachments([]);
    }
  };

  const handleAttachmentsClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsAttachmentsDialogOpen(true);
    await loadAttachments(customer.id);
  };

  const handleAttachmentDownload = (fileName: string, originalName: string) => {
    window.open(`${API_BASE}/api/media/download/${fileName}`, '_blank');
  };

  const loadAudios = async (cpf: string) => {
    try {
      const encodedCpf = encodeURIComponent(cpf); // 🔗 Codifica CPF/CNPJ para URL
      console.log('🎵 Buscando áudios para:', cpf, '→ URL codificada:', encodedCpf);
  
      // 📡 Faz requisição para o backend
      const response = await fetch(`${API_BASE}/api/audios/${encodedCpf}`);
      const data = await response.json();
  
      setAudios(data); // 💾 Salva áudios no estado
      console.log('🎵 Áudios carregados:', data);
    } catch (error) {
      console.error('❌ Erro ao carregar áudios:', error);
      setAudios([]);
    }
  };
  const handleAudiosClick = async (customer: Customer) => {
    setSelectedCustomer(customer);     // 👤 Define cliente selecionado
    setIsAudiosDialogOpen(true);      // 🔓 Abre o modal
    await loadAudios(customer.cpfCnpj); // 🎵 Carrega áudios do cliente
  };

  const handleAudioDownload = (fileName: string, originalName: string) => {
    // 🌐 Abre nova aba para download
    window.open(`${API_BASE}/api/audios/download/${fileName}`, '_blank');
  };

  const handleDownloadAllAudios = () => {
    if (!selectedCustomer || audios.length === 0) return;
  
    // 🔄 Para cada áudio, abre nova aba para download
    audios.forEach(audio => {
      window.open(`${API_BASE}/api/audios/download/${audio.fileName}`, '_blank');
    });
  
    toast({
      title: "Download iniciado!",
      description: `${audios.length} áudio(s) sendo baixado(s)`,
    });
  };

  const handlePlayAudio = (fileName: string) => {
    if (currentPlayingAudio === fileName) {
      // ⏸️ Se já está tocando, pausa
      setCurrentPlayingAudio(null);
      const audioElement = document.getElementById(`audio-${fileName}`) as HTMLAudioElement;
      if (audioElement) {
        audioElement.pause();
      }
    } else {
      // ⏹️ Para todos os outros áudios
      const allAudios = document.querySelectorAll('audio');
      allAudios.forEach(audio => audio.pause());
  
      // ▶️ Toca o áudio selecionado
      setCurrentPlayingAudio(fileName);
      const audioElement = document.getElementById(`audio-${fileName}`) as HTMLAudioElement;
      if (audioElement) {
        audioElement.play().catch(error => {
          console.error('Erro ao reproduzir áudio:', error);
          toast({
            title: "Erro no áudio",
            description: "Não foi possível reproduzir o áudio.",
            variant: "destructive",
          });
          setCurrentPlayingAudio(null);
        });
      }
    }
  };

  const handleDownloadAllAttachments = () => {
    if (!selectedCustomer || attachments.length === 0) return;
    
    // Para cada anexo, abrir em uma nova aba (o navegador vai baixar automaticamente)
    attachments.forEach(attachment => {
      window.open(`${API_BASE}/api/media/download/${attachment.fileName}`, '_blank');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Clientes</h1>
          <p className="text-muted-foreground">Visualize e gerencie todos os clientes do sistema</p>
        </div>
        {/* Removidos os botões Exportar e Importar */}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
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
          <CardTitle className="text-lg">
            Lista de Clientes ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data da Ação</TableHead>
                  <TableHead>Última Ação</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Áudios
                    <div className="text-xs text-muted-foreground leading-tight">(Reproduzir e baixar)</div>
                  </TableHead>
                  <TableHead>
                    Anexos para download
                    <div className="text-xs text-muted-foreground leading-tight">(Evidências de atendimento)</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="table-row">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{customer.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            Mat: {customer.matricula}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{customer.cpfCnpj}</TableCell>
                    <TableCell>{customer.credor}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(customer.valorRecebido)}</TableCell>
                    <TableCell>{customer.envioNegociacao ? formatDate(customer.envioNegociacao) : 'N/A'}</TableCell>
                    <TableCell>{customer.acao}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAudiosClick(customer)}
                        className="flex items-center gap-2"
                      >
                        <FileAudio className="h-4 w-4" />
                        Áudios
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAttachmentsClick(customer)}
                        className="flex items-center gap-2"
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
           <div className="flex justify-center items-center gap-2 mt-4">
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



      {/* 🎵 MODAL DE ÁUDIOS */}
      <Dialog open={isAudiosDialogOpen} onOpenChange={setIsAudiosDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Áudios - {selectedCustomer?.nome}</DialogTitle>
            <DialogDescription>
              Visualize, reproduza e faça download dos áudios associados a este cliente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 👤 Informações do Cliente */}
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

            {/* 🎵 Lista de Áudios */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Áudios ({audios.length})</h3>
                {audios.length > 0 && (
                  <Button
                    onClick={handleDownloadAllAudios} // 💾 Download de todos
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Todos
                  </Button>
                )}
              </div>
              
              {audios.length === 0 ? (
                // 📭 Mensagem quando não há áudios
                <div className="text-center py-8 text-muted-foreground">
                  <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum áudio encontrado</p>
                  <p className="text-sm">Não há áudios disponíveis para este cliente</p>
                </div>
              ) : (
                // 🎵 Lista dos áudios
                <div className="space-y-2">
                  {audios.map((audio) => (
                    <div
                      key={audio.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      {/* 📝 Informações do áudio */}
                      <div className="flex items-center gap-3">
                        <FileAudio className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{audio.originalName}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(audio.fileSize)} • {new Date(audio.uploadDate).toLocaleDateString('pt-BR')}
                          </div>
                          {audio.description && (
                            <div className="text-sm text-muted-foreground">
                              {audio.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 🎮 Controles do áudio */}
                      <div className="flex items-center gap-2">
                        {/* ▶️ Botão Play/Pause */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePlayAudio(audio.fileName)}
                          className="flex items-center gap-1"
                        >
                          {currentPlayingAudio === audio.fileName ? (
                            <>
                              <Pause className="h-4 w-4" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Tocar
                            </>
                          )}
                        </Button>
                        
                        {/* 💾 Botão Download */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAudioDownload(audio.fileName, audio.originalName)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {/* 🎵 Elemento de áudio oculto para reprodução */}
                        <audio
                          id={`audio-${audio.fileName}`}
                          src={`${API_BASE}/api/audios/stream/${audio.fileName}`}
                          onEnded={() => setCurrentPlayingAudio(null)}
                          onError={() => {
                            console.error('Erro ao carregar áudio:', audio.fileName);
                            setCurrentPlayingAudio(null);
                            toast({
                              title: "Erro no áudio",
                              description: "Não foi possível carregar o áudio.",
                              variant: "destructive",
                            });
                          }}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Dialog para Gerenciar Anexos */}
      <Dialog open={isAttachmentsDialogOpen} onOpenChange={setIsAttachmentsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Anexos - {selectedCustomer?.nome}</DialogTitle>
            <DialogDescription>
              Visualize e faça download dos anexos associados a este cliente.
            </DialogDescription>
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
                <h3 className="text-lg font-medium">Anexos ({attachments.length})</h3>
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