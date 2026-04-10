import React, { useState } from 'react';
import { Table, Card, Tag, Button, Upload, message, Space, Modal, Descriptions } from 'antd';
import { UploadOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { invoiceApi, type Invoice } from '../../services/invoice';

const Invoices: React.FC = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // 查询发票列表
  const { data: invoiceData, isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.list({ pageSize: 100 }),
  });

  // OCR 上传
  const ocrMutation = useMutation({
    mutationFn: (file: File) => invoiceApi.ocr(file),
    onSuccess: () => {
      message.success('发票识别成功');
      refetch();
    },
    onError: (error) => {
      message.error(`识别失败：${(error as Error).message}`);
    },
  });

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      if (!isImage && !isPdf) {
        message.error('只支持图片或 PDF 格式');
        return false;
      }
      ocrMutation.mutate(file);
      return false;
    },
    showUploadList: false,
    accept: 'image/*,.pdf',
  };

  const statusMap: Record<number, { label: string; color: string }> = {
    0: { label: '待识别', color: 'default' },
    1: { label: '已识别', color: 'success' },
    2: { label: '识别失败', color: 'error' },
  };

  const columns = [
    { title: '发票号码', dataIndex: 'invoice_no', key: 'invoice_no' },
    { title: '发票代码', dataIndex: 'invoice_code', key: 'invoice_code' },
    { title: '购买方', dataIndex: 'buyer_name', key: 'buyer_name' },
    { title: '销售方', dataIndex: 'seller_name', key: 'seller_name' },
    {
      title: '价税合计',
      key: 'total_amount',
      render: (_: unknown, record: Invoice) => {
        const amount = parseFloat(record.total_amount) / 100;
        return `¥${amount.toFixed(2)}`;
      },
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
      title: '开票日期',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Invoice) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedInvoice(record);
            setDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Upload {...uploadProps} disabled={ocrMutation.isPending}>
            <Button type="primary" icon={<UploadOutlined />} disabled={ocrMutation.isPending}>
              {ocrMutation.isPending ? '识别中...' : '上传发票识别'}
            </Button>
          </Upload>
        </Space>
      </Card>

      <Card title="发票列表">
        <Table
          columns={columns}
          dataSource={invoiceData?.list.map((item, index) => ({ ...item, key: item.id || index }))}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            total: invoiceData?.pagination.total,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
        />
      </Card>

      <Modal
        title="发票详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedInvoice && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="发票号码">{selectedInvoice.invoice_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="发票代码">{selectedInvoice.invoice_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="购买方">{selectedInvoice.buyer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="购买方税号">{selectedInvoice.buyer_tax_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="销售方">{selectedInvoice.seller_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="销售方税号">{selectedInvoice.seller_tax_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="金额">
              {parseFloat(selectedInvoice.amount) / 100} 元
            </Descriptions.Item>
            <Descriptions.Item label="税额">
              {parseFloat(selectedInvoice.tax_amount) / 100} 元
            </Descriptions.Item>
            <Descriptions.Item label="价税合计" span={2}>
              {parseFloat(selectedInvoice.total_amount) / 100} 元
            </Descriptions.Item>
            <Descriptions.Item label="开票日期">{selectedInvoice.invoice_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {statusMap[selectedInvoice.status]?.label || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Invoices;