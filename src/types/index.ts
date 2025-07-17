export interface Customer {
  id: string;
  credor: string;
  cpfCnpj: string;
  taAuto: string;
  matricula: string;
  nome: string;
  vencimento: string;
  atraso: number;
  valorRecebido: number;
  plano: number;
  dataPromessaPagamento: string;
  dataVencimento: string;
  comissao: number;
  acao: string;
  sms: string;
  ura: string;
  envioNegociacao: string;
  audioUrl?: string;
  audioName?: string;
  audioUploadDate?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  uploadDate: string;
  description?: string;
  fileType: string;
}

export interface DashboardMetrics {
  totalClientes: number;
  totalReceitas: number;
  clientesAtrasados: number;
  totalComissao: number;
  mediaAtraso: number;
  taxaRecuperacao: number;
  clientesComAudio: number;
}

export interface AudioFile {
  id: string;
  customerId: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  duration?: number;
  size?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'manager';
  avatar?: string;
}