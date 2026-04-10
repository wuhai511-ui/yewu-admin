import api from './api';
import type { ApiResponse } from '../types';

export interface Invoice {
  id: string;
  file_id: string;
  invoice_no?: string;
  invoice_code?: string;
  buyer_name?: string;
  buyer_tax_no?: string;
  seller_name?: string;
  seller_tax_no?: string;
  amount: string;
  tax_amount: string;
  total_amount: string;
  invoice_date?: string;
  status: number;
  created_at: string;
}

export const invoiceApi = {
  list: async (params?: { page?: number; pageSize?: number; status?: number }) => {
    const response = await api.get<ApiResponse<{ list: Invoice[]; pagination: { total: number } }>>('/invoices', { params });
    return response.data.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return response.data.data;
  },

  ocr: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiResponse<Invoice>>('/invoices/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
};