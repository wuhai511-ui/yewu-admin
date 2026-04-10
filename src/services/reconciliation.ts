import api from './api';
import type { ApiResponse } from '../types';

export interface ReconciliationBatch {
  id: string;
  batch_no: string;
  check_date: string;
  batch_type: 'ORDER_VS_JY' | 'JY_VS_JS';
  record_count: number;
  match_count: number;
  rolling_count: number;
  long_count: number;
  short_count: number;
  amount_diff_count: number;
  status: number;
  started_at: string;
  finished_at?: string;
}

export interface ReconciliationDetail {
  id: string;
  serial_no: string;
  result_type: 'MATCH' | 'ROLLING' | 'LONG' | 'SHORT' | 'AMOUNT_MISMATCH';
  business_amount?: string;
  channel_amount?: string;
  diff_amount?: string;
  match_date?: string;
}

export const reconciliationApi = {
  list: async (params?: { page?: number; pageSize?: number; status?: number }) => {
    const response = await api.get<ApiResponse<{ data: ReconciliationBatch[]; pagination: { total: number } }>>('/reconciliation/batches', { params });
    return response.data.data;
  },

  create: async (data: { batch_type: string; business_file_id?: string; channel_file_id?: string; check_date?: string }) => {
    const response = await api.post<ApiResponse<ReconciliationBatch>>('/reconciliation/batches', data);
    return response.data.data;
  },

  get: async (id: string) => {
    const response = await api.get<ApiResponse<ReconciliationBatch>>(`/reconciliation/batches/${id}`);
    return response.data.data;
  },

  execute: async (id: string) => {
    const response = await api.post<ApiResponse<{ batch_id: string; stats: any }>>(`/reconciliation/batches/${id}/execute`);
    return response.data.data;
  },

  getDetails: async (id: string, params?: { page?: number; pageSize?: number; result_type?: string }) => {
    const response = await api.get<ApiResponse<{ data: ReconciliationDetail[]; pagination: { total: number } }>>(`/reconciliation/batches/${id}/details`, { params });
    return response.data.data;
  },

  exportReport: async (id: string) => {
    const response = await api.get(`/reconciliation/batches/${id}/report`, { responseType: 'blob' });
    return response.data;
  },
};