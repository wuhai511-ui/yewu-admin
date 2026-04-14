import React, { useState } from 'react';
import { Table, Card, Tag, Button, DatePicker, Space, Modal, Descriptions, Upload, message, Select } from 'antd';
import { SyncOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fileApi } from '../../services/file';
import { reconciliationApi, type ReconciliationBatch } from '../../services/reconciliation';

type UploadFileType = 'BUSINESS_ORDER' | 'JY' | 'JS' | 'SEP';

const Reconciliation: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [detailVisible, setDetailVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ReconciliationBatch | null>(null);
  const [uploadFileType, setUploadFileType] = useState<UploadFileType>('BUSINESS_ORDER');
  const queryClient = useQueryClient();

  // 查询对账批次列表
  const { data: batchData, isLoading: batchLoading } = useQuery({
    queryKey: ['reconciliation-batches'],
    queryFn: () => reconciliationApi.list({ pageSize: 100 }),
  });

  // 查询文件列表
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['files', selectedDate],
    queryFn: () => fileApi.list({ pageSize: 100 }),
  });

  // 执行对账
  const executeMutation = useMutation({
    mutationFn: (batchId: string) => reconciliationApi.execute(batchId),
    onSuccess: (data) => {
      message.success(`对账完成！匹配: ${data.stats.match}, 滚动: ${data.stats.rolling}, 长款: ${data.stats.long}, 短款: ${data.stats.short}, 金额差异: ${data.stats.amount_diff}`);
      queryClient.invalidateQueries({ queryKey: ['reconciliation-batches'] });
    },
    onError: (error) => {
      message.error(`对账失败：${(error as Error).message}`);
    },
  });

  // 创建对账批次
  const createBatchMutation = useMutation({
    mutationFn: () => reconciliationApi.create({ batch_type: 'ORDER_VS_JY', check_date: selectedDate }),
    onSuccess: (batch) => {
      executeMutation.mutate(batch.id);
    },
    onError: (error) => {
      message.error(`创建批次失败：${(error as Error).message}`);
    },
  });

  // 文件上传
  const uploadMutation = useMutation({
    mutationFn: ({ file, fileType }: { file: File; fileType: UploadFileType }) => fileApi.upload(file, fileType),
    onSuccess: (data) => {
      message.success(`文件上传成功，解析出 ${data.records} 条记录`);
      setUploadModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error) => {
      message.error(`上传失败：${(error as Error).message}`);
    },
  });

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const isValidType = ['text/plain', 'text/csv', 'application/octet-stream'].includes(file.type) ||
        file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.dat') ||
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (!isValidType) {
        message.error('只支持 .txt, .csv, .dat, .xlsx, .xls 格式的文件');
        return false;
      }

      uploadMutation.mutate({ file, fileType: uploadFileType });
      return false;
    },
    showUploadList: false,
    accept: '.txt,.csv,.dat,.xlsx,.xls',
  };

  const statusMap: Record<number, { label: string; color: string }> = {
    0: { label: '待处理', color: 'default' },
    1: { label: '处理中', color: 'processing' },
    2: { label: '完成', color: 'success' },
    3: { label: '失败', color: 'error' },
  };

  const batchColumns = [
    { title: '批次号', dataIndex: 'batch_no', key: 'batch_no' },
    { title: '对账日期', dataIndex: 'check_date', key: 'check_date' },
    { title: '类型', dataIndex: 'batch_type', key: 'batch_type' },
    { title: '记录数', dataIndex: 'record_count', key: 'record_count' },
    { title: '对平', dataIndex: 'match_count', key: 'match_count' },
    {
      title: '滚动',
      key: 'rolling_count',
      render: (_: unknown, record: ReconciliationBatch) => record.rolling_count,
    },
    {
      title: '长款',
      key: 'long_count',
      render: (_: unknown, record: ReconciliationBatch) => <Tag color="blue">{record.long_count}</Tag>,
    },
    {
      title: '短款',
      key: 'short_count',
      render: (_: unknown, record: ReconciliationBatch) => <Tag color="orange">{record.short_count}</Tag>,
    },
    {
      title: '金额差异',
      key: 'amount_diff_count',
      render: (_: unknown, record: ReconciliationBatch) => <Tag color="red">{record.amount_diff_count}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => {
        const config = statusMap[status] || { label: '未知', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ReconciliationBatch) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => { setSelectedBatch(record); setDetailVisible(true); }}>
            详情
          </Button>
          {record.status === 0 && (
            <Button type="link" icon={<SyncOutlined />} onClick={() => executeMutation.mutate(record.id)}>
              执行
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 文件列表表格列（修正字段名）
  const fileColumns = [
    { title: '文件名', dataIndex: 'filename', key: 'filename' },
    {
      title: '文件类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          JY: { label: '交易明细', color: 'blue' },
          JS: { label: '结算明细', color: 'green' },
          SEP: { label: '代付明细', color: 'purple' },
          BUSINESS_ORDER: { label: '业务订单', color: 'cyan' },
        };
        const config = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    { title: '记录数', dataIndex: 'records', key: 'records' },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => {
        const sourceMap: Record<string, string> = { sftp: 'SFTP', upload: '上传', api: 'API' };
        return sourceMap[source] || source;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  const handleExecute = () => {
    createBatchMutation.mutate();
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>对账日期：</span>
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(date) => setSelectedDate(date?.format('YYYY-MM-DD') || '')}
          />
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleExecute}
            loading={createBatchMutation.isPending || executeMutation.isPending}
          >
            执行对账
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
            上传对账文件
          </Button>
        </Space>
      </Card>

      {/* 已上传文件列表 */}
      {files.length > 0 && (
        <Card title="已上传文件" style={{ marginBottom: 16 }}>
          <Table
            columns={fileColumns}
            dataSource={files.map((f, i) => ({ ...f, key: f.id || i }))}
            loading={filesLoading}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      <Card title="对账批次">
        <Table
          columns={batchColumns}
          dataSource={batchData?.list.map((b, i) => ({ ...b, key: b.id || i }))}
          loading={batchLoading}
          pagination={false}
        />
      </Card>

      {/* 文件上传弹窗 */}
      <Modal
        title="上传对账文件"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ padding: '24px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>文件类型</div>
            <Select<UploadFileType>
              value={uploadFileType}
              onChange={setUploadFileType}
              style={{ width: '100%' }}
              options={[
                { value: 'BUSINESS_ORDER', label: '业务订单' },
                { value: 'JY', label: '交易明细' },
                { value: 'JS', label: '结算明细' },
                { value: 'SEP', label: '代付明细' },
              ]}
            />
          </div>
          <Upload.Dragger {...uploadProps} disabled={uploadMutation.isPending}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持格式：.txt, .csv, .dat, .xlsx, .xls<br />
              文件类型：业务订单、JY（交易明细）、JS（结算明细）、SEP（代付明细）
            </p>
          </Upload.Dragger>
          {uploadMutation.isPending && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Tag color="processing">正在上传并解析文件...</Tag>
            </div>
          )}
        </div>
      </Modal>

      {/* 对账详情弹窗 */}
      <Modal
        title="对账详情"
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedBatch(null); }}
        footer={null}
        width={800}
      >
        {selectedBatch && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="批次号">{selectedBatch.batch_no}</Descriptions.Item>
            <Descriptions.Item label="对账日期">{selectedBatch.check_date}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedBatch.batch_type}</Descriptions.Item>
            <Descriptions.Item label="状态">{statusMap[selectedBatch.status]?.label}</Descriptions.Item>
            <Descriptions.Item label="记录数">{selectedBatch.record_count}</Descriptions.Item>
            <Descriptions.Item label="对平">{selectedBatch.match_count}</Descriptions.Item>
            <Descriptions.Item label="滚动匹配">{selectedBatch.rolling_count}</Descriptions.Item>
            <Descriptions.Item label="长款">{selectedBatch.long_count}</Descriptions.Item>
            <Descriptions.Item label="短款">{selectedBatch.short_count}</Descriptions.Item>
            <Descriptions.Item label="金额差异">{selectedBatch.amount_diff_count}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Reconciliation;
