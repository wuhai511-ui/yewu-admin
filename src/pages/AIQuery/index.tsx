import React, { useState, useRef, useCallback } from 'react';
import { Card, Input, Button, List, Typography, Space, Tag, Spin, Alert, Modal, Select, message } from 'antd';
import { SendOutlined, RobotOutlined, PaperClipOutlined, FileTextOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../../services/ai';
import type { ChatMessage, FileAttachment, FileRecognitionResult } from '../../types';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const AIQuery: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [recognitionResults, setRecognitionResults] = useState<FileRecognitionResult[]>([]);
  const [selectedDataType, setSelectedDataType] = useState<'business' | 'channel'>('channel');
  const [selectedFileType, setSelectedFileType] = useState<'JY' | 'JS' | 'SEP' | 'INVOICE'>('JY');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 文件识别（支持批量）
  const recognizeMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const results = await Promise.all(files.map(file => aiApi.recognizeFile(file)));
      return results;
    },
    onSuccess: (results) => {
      setRecognitionResults(results);
      if (results.length > 0) {
        setSelectedDataType(results[0].data_type);
        setSelectedFileType(results[0].file_type);
      }
      setConfirmModalVisible(true);
    },
    onError: (error) => {
      message.error(`文件识别失败：${(error as Error).message}`);
    },
  });

  // 文件上传（支持批量）
  const uploadMutation = useMutation({
    mutationFn: async ({ files, dataType, fileType }: { files: File[]; dataType: 'business' | 'channel'; fileType: 'JY' | 'JS' | 'SEP' | 'INVOICE' }) => {
      const results = await Promise.all(
        files.map(file => aiApi.uploadReconciliationFile(file, dataType, fileType))
      );
      return results;
    },
    onSuccess: (results) => {
      const attachments: FileAttachment[] = results.map((data, index) => ({
        id: data.file_id,
        name: pendingFiles[index]?.name || 'unknown',
        type: data.data_type,
        fileType: data.file_type,
        status: 'success' as const,
        records: data.records,
      }));

      const totalRecords = results.reduce((sum, r) => sum + r.records, 0);
      const fileNames = pendingFiles.map(f => f.name).join('、');

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: `上传了 ${pendingFiles.length} 个对账文件`,
        timestamp: new Date(),
        attachments,
      };

      // 添加AI回复
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✓ 批量上传成功！共 ${pendingFiles.length} 个文件，${totalRecords} 条记录。\n\n文件：${fileNames}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      message.success(`成功上传 ${pendingFiles.length} 个文件`);
      handleCloseConfirmModal();
    },
    onError: (error) => {
      message.error(`上传失败：${(error as Error).message}`);
    },
  });

  // AI查询
  const queryMutation = useMutation({
    mutationFn: (question: string) => aiApi.query(question),
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.answer,
        sql: data.sql,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `查询失败：${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  // 处理文件选择（支持批量）
  const handleFileSelect = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      const isValidType = ['text/plain', 'text/csv', 'application/octet-stream', 'application/pdf', 'image/png', 'image/jpeg'].includes(file.type) ||
        file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.dat') ||
        file.name.endsWith('.pdf') || file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg');

      if (!isValidType) {
        message.error(`${file.name} 格式不支持`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setPendingFiles(validFiles);
    recognizeMutation.mutate(validFiles);
  }, [recognizeMutation]);

  // 确认上传
  const handleConfirmUpload = () => {
    if (pendingFiles.length === 0) return;
    uploadMutation.mutate({
      files: pendingFiles,
      dataType: selectedDataType,
      fileType: selectedFileType,
    });
  };

  // 关闭确认弹窗
  const handleCloseConfirmModal = () => {
    setConfirmModalVisible(false);
    setPendingFiles([]);
    setRecognitionResults([]);
  };

  // 发送消息
  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // 检查是否是上传文件的意图
    if (input.includes('上传') && (input.includes('对账') || input.includes('文件'))) {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '好的，请点击下方📎按钮或直接拖拽文件到聊天区域。我会自动识别数据类型，您确认后即可上传。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      queryMutation.mutate(input);
    }

    setInput('');
  };

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const quickQuestions = [
    '今天交易总额多少？',
    '今天交易笔数多少？',
    '退款记录有哪些？',
    '本周交易趋势如何？',
    '上传对账文件',
  ];

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Text type="secondary">快捷问题：</Text>
            {quickQuestions.map((q) => (
              <Tag
                key={q}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (q === '上传对账文件') {
                    fileInputRef.current?.click();
                  } else {
                    setInput(q);
                  }
                }}
              >
                {q}
              </Tag>
            ))}
          </Space>
        </div>

        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            marginBottom: 16,
            border: isDragging ? '2px dashed #1890ff' : 'none',
            borderRadius: 8,
            transition: 'border 0.2s',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(24, 144, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 18, color: '#1890ff' }}>释放文件以上传</Text>
            </div>
          )}

          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item style={{ border: 'none', padding: '8px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    width: '100%',
                    flexDirection: item.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: item.role === 'user' ? '#1890ff' : '#87e8de',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    {item.role === 'user' ? '我' : <RobotOutlined />}
                  </div>
                  <div style={{ flex: 1, maxWidth: '80%' }}>
                    <Card size="small" style={{ background: item.role === 'user' ? '#e6f7ff' : '#f5f5f5' }}>
                      <Paragraph style={{ marginBottom: item.attachments ? 8 : 0 }}>{item.content}</Paragraph>
                      {item.attachments && item.attachments.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {item.attachments.map((att) => (
                            <Tag
                              key={att.id}
                              icon={<FileTextOutlined />}
                              color={att.status === 'success' ? 'success' : 'processing'}
                            >
                              {att.name} {att.records && `(${att.records}条)`}
                            </Tag>
                          ))}
                        </div>
                      )}
                      {item.sql && (
                        <Paragraph code style={{ marginTop: 8, background: '#f0f0f0', padding: 8 }}>
                          {item.sql}
                        </Paragraph>
                      )}
                    </Card>
                  </div>
                </div>
              </List.Item>
            )}
          />
          {(queryMutation.isPending || recognizeMutation.isPending || uploadMutation.isPending) && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Spin tip={recognizeMutation.isPending ? '正在识别文件...' : uploadMutation.isPending ? '正在上传文件...' : 'AI正在思考...'} />
            </div>
          )}
        </div>

        <Space.Compact style={{ width: '100%' }}>
          <Button
            icon={<PaperClipOutlined />}
            onClick={() => fileInputRef.current?.click()}
            loading={recognizeMutation.isPending || uploadMutation.isPending}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.dat,.pdf,.png,.jpg,.jpeg"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                handleFileSelect(files);
              }
              e.target.value = '';
            }}
          />
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入您的问题，例如：今天交易总额多少？"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={queryMutation.isPending}>
            发送
          </Button>
        </Space.Compact>
      </Card>

      <Card title="使用说明" style={{ width: 300 }}>
        <Alert
          type="info"
          message="AI查询功能"
          description="使用自然语言查询交易数据，支持查询交易总额、笔数、退款记录等。"
          style={{ marginBottom: 16 }}
        />
        <Alert
          type="success"
          message="文件上传"
          description="点击📎按钮或拖拽文件到聊天区域，支持上传对账文件。"
          style={{ marginBottom: 16 }}
        />
        <Paragraph type="secondary">
          <ul style={{ paddingLeft: 16 }}>
            <li>支持中文自然语言提问</li>
            <li>自动生成SQL查询语句</li>
            <li>自动识别文件类型</li>
            <li>支持拖拽上传文件</li>
          </ul>
        </Paragraph>
      </Card>

      {/* 文件确认弹窗 */}
      <Modal
        title={`确认文件信息 (${pendingFiles.length} 个文件)`}
        open={confirmModalVisible}
        onCancel={handleCloseConfirmModal}
        footer={null}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 文件列表 */}
          <div style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto' }}>
            {pendingFiles.map((file, index) => (
              <Paragraph key={index} style={{ marginBottom: 4 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                {file.name}
                {recognitionResults[index] && (
                  <Tag color={recognitionResults[index].confidence > 0.8 ? 'green' : 'orange'} style={{ marginLeft: 8 }}>
                    {recognitionResults[index].records} 条
                  </Tag>
                )}
              </Paragraph>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">AI识别结果：</Text>
            {recognitionResults.length > 0 && (
              <Tag color={recognitionResults[0].confidence > 0.8 ? 'green' : 'orange'}>
                置信度 {Math.round(recognitionResults[0].confidence * 100)}%
              </Tag>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text>数据类型：</Text>
            <Select
              value={selectedDataType}
              onChange={setSelectedDataType}
              style={{ width: 200, marginLeft: 8 }}
              options={[
                { value: 'business', label: '业务系统数据' },
                { value: 'channel', label: '支付渠道对账数据' },
              ]}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text>文件类型：</Text>
            <Select
              value={selectedFileType}
              onChange={setSelectedFileType}
              style={{ width: 200, marginLeft: 8 }}
              options={[
                { value: 'JY', label: 'JY - 交易明细' },
                { value: 'JS', label: 'JS - 结算明细' },
                { value: 'SEP', label: 'SEP - 代付明细' },
                { value: 'INVOICE', label: 'INVOICE - 电子发票' },
              ]}
            />
          </div>

          {recognitionResults.length > 0 && (
            <Paragraph type="secondary">
              总记录数：<Text strong>{recognitionResults.reduce((sum, r) => sum + r.records, 0)}</Text> 条
            </Paragraph>
          )}

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseConfirmModal}>取消</Button>
              <Button
                type="primary"
                onClick={handleConfirmUpload}
                loading={uploadMutation.isPending}
              >
                确认上传
              </Button>
            </Space>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AIQuery;
