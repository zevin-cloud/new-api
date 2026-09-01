import React, { useEffect, useState } from 'react';
import {
  Modal,
  Table,
  Spin,
  Button,
  Typography,
  Empty,
  Input,
  Space,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { IconSearch, IconPlus, IconCheckboxTick } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const MissingModelsModal = ({ visible, onClose, onSuccess, onConfigureModel, t }) => {
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [missingModels, setMissingModels] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const isMobile = useIsMobile();

  const fetchMissing = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/models/missing');
      if (res.data.success) {
        setMissingModels(res.data.data || []);
      } else {
        showError(res.data.message);
      }
    } catch (_) {
      showError(t('获取未配置模型失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (visible) {
      fetchMissing();
      setSearchKeyword('');
      setCurrentPage(1);
      setSelectedRowKeys([]);
    } else {
      setMissingModels([]);
      setSelectedRowKeys([]);
    }
  }, [visible]);

  const handleBatchImport = async (modelsToImport) => {
    if (!modelsToImport || modelsToImport.length === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    try {
      for (const modelName of modelsToImport) {
        try {
          const res = await API.post('/api/models/', {
            model_name: modelName,
            status: 1,
          });
          if (res.data?.success) {
            successCount++;
          }
        } catch (e) {
          // ignore single fail
        }
      }
      if (successCount > 0) {
        showSuccess(t('已成功自动录入 {{count}} 个模型', { count: successCount }));
        setSelectedRowKeys([]);
        fetchMissing();
        onSuccess?.();
      } else {
        showError(t('批量录入失败'));
      }
    } catch (e) {
      showError(t('批量录入失败: ') + e.message);
    } finally {
      setBatchLoading(false);
    }
  };

  // 过滤和分页逻辑
  const filteredModels = missingModels.filter((model) =>
    model.toLowerCase().includes(searchKeyword.toLowerCase()),
  );

  const dataSource = (() => {
    const start = (currentPage - 1) * MODEL_TABLE_PAGE_SIZE;
    const end = start + MODEL_TABLE_PAGE_SIZE;
    return filteredModels.slice(start, end).map((model) => ({
      model,
      key: model,
    }));
  })();

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'model',
      render: (text) => (
        <div className='flex items-center'>
          <Typography.Text strong>{text}</Typography.Text>
        </div>
      ),
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      fixed: 'right',
      width: 200,
      render: (text, record) => (
        <Space>
          <Button
            type='tertiary'
            size='small'
            onClick={() => handleBatchImport([record.model])}
          >
            {t('快速录入')}
          </Button>
          <Button
            type='primary'
            size='small'
            onClick={() => onConfigureModel(record.model)}
          >
            {t('详细配置')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className='flex flex-col gap-2 w-full'>
          <div className='flex items-center gap-2'>
            <Typography.Text
              strong
              className='!text-[var(--semi-color-text-0)] !text-base'
            >
              {t('未配置的模型列表')}
            </Typography.Text>
            <Typography.Text type='tertiary' size='small'>
              {t('共')} {missingModels.length} {t('个未配置模型')}
            </Typography.Text>
          </div>
        </div>
      }
      visible={visible}
      onCancel={() => {
        onClose();
        onSuccess?.();
      }}
      footer={null}
      width={760}
      className='!rounded-lg'
    >
      <Spin spinning={loading || batchLoading}>
        {missingModels.length === 0 && !loading ? (
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无缺失模型')}
            style={{ padding: 30 }}
          />
        ) : (
          <div className='missing-models-content flex flex-col gap-3'>
            {/* 顶部操作与搜索 */}
            <div className='flex flex-col sm:flex-row justify-between items-center gap-2 w-full'>
              <Space>
                <Button
                  theme='solid'
                  type='primary'
                  size='small'
                  icon={<IconCheckboxTick />}
                  disabled={missingModels.length === 0}
                  onClick={() => handleBatchImport(missingModels)}
                >
                  {t('一键录入全部 ({{count}})', { count: missingModels.length })}
                </Button>
                {selectedRowKeys.length > 0 && (
                  <Button
                    theme='light'
                    type='primary'
                    size='small'
                    onClick={() => handleBatchImport(selectedRowKeys)}
                  >
                    {t('录入所选 ({{count}})', { count: selectedRowKeys.length })}
                  </Button>
                )}
              </Space>

              <Input
                placeholder={t('搜索未配置模型...')}
                value={searchKeyword}
                onChange={(v) => {
                  setSearchKeyword(v);
                  setCurrentPage(1);
                }}
                style={{ width: isMobile ? '100%' : 240 }}
                prefix={<IconSearch />}
                showClear
              />
            </div>

            {/* 表格 */}
            {filteredModels.length > 0 ? (
              <Table
                rowKey='key'
                rowSelection={{
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys),
                }}
                columns={columns}
                dataSource={dataSource}
                pagination={{
                  currentPage: currentPage,
                  pageSize: MODEL_TABLE_PAGE_SIZE,
                  total: filteredModels.length,
                  showSizeChanger: false,
                  onPageChange: (page) => setCurrentPage(page),
                }}
              />
            ) : (
              <Empty
                image={
                  <IllustrationNoResult style={{ width: 100, height: 100 }} />
                }
                darkModeImage={
                  <IllustrationNoResultDark
                    style={{ width: 100, height: 100 }}
                  />
                }
                description={
                  searchKeyword ? t('未找到匹配的模型') : t('暂无缺失模型')
                }
                style={{ padding: 20 }}
              />
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default MissingModelsModal;
