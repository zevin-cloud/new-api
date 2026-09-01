/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState } from 'react';
import { Modal, Upload, Button, Table, Tag, Typography, Banner, Spin } from '@douyinfe/semi-ui';
import { IconUpload, IconFile } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text, Title } = Typography;

const UserImportModal = ({ visible, onClose, onSuccess, t }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [executing, setExecuting] = useState(false);

  const handleUploadChange = async ({ fileList }) => {
    if (fileList && fileList.length > 0) {
      const currentFile = fileList[0].fileInstance;
      setFile(currentFile);
      setLoading(true);

      const formData = new FormData();
      formData.append('file', currentFile);

      try {
        const res = await API.post('/api/user/import/preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.success) {
          setPreviewData(res.data.data);
        } else {
          showError(res.data?.message || '预检解析失败');
        }
      } catch (e) {
        showError('上传解析失败: ' + e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExecute = async () => {
    if (!previewData || !previewData.rows || previewData.rows.length === 0) {
      showError(t('没有可导入的数据'));
      return;
    }

    setExecuting(true);
    try {
      const res = await API.post('/api/user/import/execute', {
        rows: previewData.rows,
      });
      if (res.data?.success) {
        showSuccess(t('批量导入执行完成: 成功 {{success}} 行，失败 {{error}} 行', {
          success: res.data.data.success_count,
          error: res.data.data.error_count,
        }));
        onSuccess();
      } else {
        showError(res.data?.message || '执行导入失败');
      }
    } catch (e) {
      showError('执行导入失败: ' + e.message);
    } finally {
      setExecuting(false);
    }
  };

  const columns = [
    { title: t('行号'), dataIndex: 'row_index', width: 70 },
    { title: t('用户名'), dataIndex: 'username', width: 120 },
    { title: t('姓名'), dataIndex: 'display_name', width: 120 },
    { title: t('工号'), dataIndex: 'employee_id', width: 100 },
    { title: t('邮箱'), dataIndex: 'email', width: 160 },
    { title: t('部门'), dataIndex: 'department', width: 120 },
    { title: t('用户组'), dataIndex: 'user_groups', width: 140 },
    {
      title: t('预检动作'),
      dataIndex: 'action',
      width: 100,
      render: (val, record) => {
        if (val === 'create') return <Tag color='green'>{t('新增')}</Tag>;
        if (val === 'update') return <Tag color='blue'>{t('更新')}</Tag>;
        if (val === 'error') return <Tag color='red'>{t('错误')}</Tag>;
        return <Tag color='grey'>{val}</Tag>;
      },
    },
    {
      title: t('说明/错误'),
      dataIndex: 'error_message',
      render: (val) => val ? <Text type='danger'>{val}</Text> : '-',
    },
  ];

  return (
    <Modal
      title={t('批量导入用户')}
      visible={visible}
      onCancel={onClose}
      width={900}
      footer={
        <div className='flex justify-between items-center w-full'>
          <Button
            theme='light'
            type='tertiary'
            onClick={() => {
              const csvContent = 'data:text/csv;charset=utf-8,用户名,姓名,工号,邮箱,部门,用户组\nzhangsan,张三,EMP001,zhangsan@example.com,研发中心,AI 项目组\n';
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', 'user_import_template.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            {t('下载 CSV 导入模板')}
          </Button>

          <div className='flex gap-2'>
            <Button theme='light' type='tertiary' onClick={onClose}>
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              disabled={!previewData || previewData.rows?.length === 0}
              loading={executing}
              onClick={handleExecute}
            >
              {t('确认执行导入')}
            </Button>
          </div>
        </div>
      }
    >
      <div className='flex flex-col gap-4'>
        <Banner
          type='info'
          description={t('支持上传 CSV 格式文件进行用户批量新增与更新。系统将自动根据部门名称和用户组名称关联组织架构。')}
        />

        <Upload
          action=''
          accept='.csv'
          limit={1}
          showUploadList={false}
          customRequest={() => {}}
          onChange={handleUploadChange}
        >
          <Button icon={<IconUpload />} theme='light'>
            {file ? t('重新选择文件: {{name}}', { name: file.name }) : t('选择 CSV 文件并预检')}
          </Button>
        </Upload>

        <Spin spinning={loading}>
          {previewData && (
            <div className='flex flex-col gap-2'>
              <div className='flex gap-4 p-2 bg-[var(--semi-color-fill-0)] rounded'>
                <Text>{t('总行数')}: <b>{previewData.total}</b></Text>
                <Text>{t('待新增')}: <b className='text-green-600'>{previewData.create_count}</b></Text>
                <Text>{t('待更新')}: <b className='text-blue-600'>{previewData.update_count}</b></Text>
                <Text>{t('错误行')}: <b className='text-red-600'>{previewData.error_count}</b></Text>
              </div>

              <Table
                columns={columns}
                dataSource={previewData.rows || []}
                pagination={{ pageSize: 5 }}
                size='small'
              />
            </div>
          )}
        </Spin>
      </div>
    </Modal>
  );
};

export default UserImportModal;
