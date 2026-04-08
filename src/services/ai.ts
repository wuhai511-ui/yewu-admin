import api from './api';
import type { ApiResponse, AIQueryResult, FileRecognitionResult, AIFileUploadResult } from '../types';

export const aiApi = {
  query: async (question: string, merchantId?: string): Promise<AIQueryResult> => {
    const response = await api.post<ApiResponse<AIQueryResult>>('/ai/query', {
      question,
      merchantId,
    });
    return response.data.data;
  },

  health: async (): Promise<{ llmAvailable: boolean; llm: string }> => {
    const response = await api.get<ApiResponse<{ llmAvailable: boolean; llm: string }>>('/ai/health');
    return response.data.data;
  },

  // 识别文件类型（自动识别数据类型和文件类型）
  recognizeFile: async (file: File): Promise<FileRecognitionResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<FileRecognitionResult>>('/ai/recognize', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  // 上传对账文件
  uploadReconciliationFile: async (
    file: File,
    dataType: 'business' | 'channel',
    fileType: 'JY' | 'JS' | 'SEP'
  ): Promise<AIFileUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', dataType);
    formData.append('file_type', fileType);

    const response = await api.post<ApiResponse<AIFileUploadResult>>('/ai/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
