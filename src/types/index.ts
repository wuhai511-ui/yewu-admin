// API响应格式
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// 用户
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  name: string;
}

// 商户
export interface Merchant {
  id: string;
  merchant_no: string;
  name: string;
  status: number;
  created_at: string;
  updated_at: string;
}

// 交易
export interface Transaction {
  id: string;
  merchant_id: string;
  trans_date: string;
  trans_time: string;
  lakala_serial: string;
  trans_type: string;
  amount: number;
  fee: number;
  settle_amount: number;
  pay_channel: string;
  merchant_order_no: string;
}

// 对账结果
export interface Reconciliation {
  batch_id: string;
  check_date: string;
  file_type: string;
  record_count: number;
  match_count: number;
  mismatch_count: number;
  status: number;
}

// AI查询结果
export interface AIQueryResult {
  answer: string;
  sql: string;
  records: unknown[];
  confidence: number;
  llm: string;
}

// 文件附件类型
export interface FileAttachment {
  id: string;
  name: string;
  type: 'business' | 'channel';  // 业务系统数据 / 支付渠道数据
  fileType: 'JY' | 'JS' | 'SEP' | 'INVOICE'; // 交易明细/结算明细/代付明细/电子发票
  status: 'uploading' | 'success' | 'error';
  records?: number;
  size?: number;
}

// AI聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

// 文件识别结果
export interface FileRecognitionResult {
  data_type: 'business' | 'channel';
  file_type: 'JY' | 'JS' | 'SEP' | 'INVOICE';
  records: number;
  preview?: Record<string, unknown>[];
  confidence: number;
}

// 文件上传结果
export interface AIFileUploadResult {
  file_id: string;
  data_type: 'business' | 'channel';
  file_type: 'JY' | 'JS' | 'SEP' | 'INVOICE';
  records: number;
  message: string;
}

// 批量上传结果
export interface BatchUploadResult {
  success: number;
  failed: number;
  results: AIFileUploadResult[];
}
