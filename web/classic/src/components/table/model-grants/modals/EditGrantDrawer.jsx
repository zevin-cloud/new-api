/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SideSheet,
  Table,
  Tag,
  Button,
  Popconfirm,
  Spin,
  Empty,
  Input,
  Descriptions,
  Space,
  Typography,
  Card,
  Divider,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconUserGroup,
  IconLayers,
  IconDelete,
  IconClose,
} from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getGrantBatchDetail } from '../../../../services/modelGrants';
import { timestamp2string, showError } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Title, Text } = Typography;

const EditGrantDrawer = ({ visible, batchItem, onClose, onRevoke }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [userKeyword, setUserKeyword] = useState('');
  const [modelKeyword, setModelKeyword] = useState('');

  const targetId = useMemo(() => {
    if (!batchItem) return null;
    if (batchItem.batch_id > 0) return batchItem.batch_id;
    if (batchItem.batchId > 0) return batchItem.batchId;
    if (
      typeof batchItem.id === 'string' &&
      batchItem.id.startsWith('batch_')
    ) {
      const parsed = parseInt(batchItem.id.replace('batch_', ''), 10);
      if (parsed > 0) return parsed;
    }
    const legacy =
      batchItem.legacy_id ||
      batchItem.legacyId ||
      (Array.isArray(batchItem.grants) && batchItem.grants[0]?.id) ||
      batchItem.id;
    if (typeof legacy === 'string' && legacy.startsWith('grant_')) {
      return parseInt(legacy.replace('grant_', ''), 10);
    }
    return legacy;
  }, [batchItem]);

  const isLegacy = useMemo(() => {
    if (!batchItem) return false;
    const bid = batchItem.batch_id || batchItem.batchId || 0;
    return bid <= 0;
  }, [batchItem]);

  useEffect(() => {
    if (!visible || !targetId) {
      setDetail(null);
      setUserKeyword('');
      setModelKeyword('');
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const loadDetail = async () => {
      try {
        const queryId = isLegacy ? `grant_${targetId}?type=legacy` : targetId;
        const data = await getGrantBatchDetail(queryId, controller.signal);
        if (!controller.signal.aborted) {
          setDetail(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          showError(err.message || t('获取授权详情失败'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDetail();
    return () => controller.abort();
  }, [visible, targetId, isLegacy, t]);

  const filteredUsers = useMemo(() => {
    const list = detail?.union_users || [];
    if (!userKeyword.trim()) return list;
    const kw = userKeyword.toLowerCase();
    return list.filter(
      (u) =>
        u.username?.toLowerCase().includes(kw) ||
        u.display_name?.toLowerCase().includes(kw) ||
        u.email?.toLowerCase().includes(kw) ||
        u.department_name?.toLowerCase().includes(kw) ||
        u.sources?.some((s) => s.toLowerCase().includes(kw))
    );
  }, [detail?.union_users, userKeyword]);

  const filteredModels = useMemo(() => {
    const list = detail?.models || [];
    if (!modelKeyword.trim()) return list;
    const kw = modelKeyword.toLowerCase();
    return list.filter((m) => m.toLowerCase().includes(kw));
  }, [detail?.models, modelKeyword]);

  const subjectTypeMeta = {
    1: { text: t('部门'), color: 'blue' },
    2: { text: t('用户组'), color: 'violet' },
    3: { text: t('个人用户'), color: 'cyan' },
  };

  const userColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 65,
    },
    {
      title: t('用户姓名 / 账号'),
      width: 170,
      render: (_, u) => (
        <div className='flex flex-col'>
          <span className='font-medium text-gray-800 dark:text-gray-200'>
            {u.display_name || u.username}
          </span>
          <span className='text-xs text-gray-400'>@{u.username}</span>
        </div>
      ),
    },
    {
      title: t('所属部门'),
      dataIndex: 'department_name',
      width: 130,
      render: (text) => text || <span className='text-gray-400'>-</span>,
    },
    {
      title: t('邮箱'),
      dataIndex: 'email',
      width: 160,
      render: (text) => text || <span className='text-gray-400'>-</span>,
    },
    {
      title: t('权限来源'),
      dataIndex: 'sources',
      render: (sources) => (
        <div className='flex flex-wrap gap-1'>
          {(sources || []).map((src, idx) => (
            <Tag key={idx} color='purple' size='small'>
              {src}
            </Tag>
          ))}
        </div>
      ),
    },
  ];

  const expiryTag = useMemo(() => {
    if (!detail) return null;
    if (!detail.expired_at || detail.expired_at === 0) {
      return <Tag color='green'>{t('永不过期')}</Tag>;
    }
    const isExpired = detail.expired_at <= Date.now() / 1000;
    return (
      <Tag color={isExpired ? 'red' : 'orange'}>
        {timestamp2string(detail.expired_at)} {isExpired ? `(${t('已过期')})` : ''}
      </Tag>
    );
  }, [detail, t]);

  const overviewData = useMemo(() => {
    if (!detail) return [];
    return [
      {
        key: t('授权编号'),
        value: `#${detail.batch_id || targetId || '-'}`,
      },
      {
        key: t('授权时间'),
        value: timestamp2string(detail.created_at),
      },
      {
        key: t('有效期状态'),
        value: expiryTag,
      },
      {
        key: t('覆盖成员总数'),
        value: (
          <span className='font-semibold text-blue-600'>
            {detail.total_users || 0} {t('位')}
          </span>
        ),
      },
      {
        key: t('涵盖模型总数'),
        value: (
          <span className='font-semibold text-green-600'>
            {detail.total_models || 0} {t('个')}
          </span>
        ),
      },
    ];
  }, [detail, expiryTag, targetId, t]);

  return (
    <SideSheet
      placement='right'
      title={
        <Space>
          <Tag color='blue' shape='circle'>
            {t('编辑')}
          </Tag>
          <Title heading={4} className='m-0'>
            {t('授权详情与管理')}
            {targetId && (
              <span className='text-sm text-gray-500 font-normal ml-2 font-mono'>
                (#{targetId})
              </span>
            )}
          </Title>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      width={isMobile ? '100%' : 660}
      footer={
        <div className='flex justify-between items-center bg-white dark:bg-gray-900 p-3 w-full border-t border-gray-100 dark:border-gray-800'>
          <div>
            {batchItem && (
              <Popconfirm
                title={t('确认撤销')}
                content={t('确定撤销此次授权吗？撤销后相关成员将失去此授权的所有模型访问权限。')}
                onConfirm={() => {
                  onRevoke?.(batchItem);
                  onClose();
                }}
              >
                <Button type='danger' theme='light' icon={<IconDelete />}>
                  {t('撤销本次授权')}
                </Button>
              </Popconfirm>
            )}
          </div>
          <Button theme='light' type='primary' onClick={onClose} icon={<IconClose />}>
            {t('关闭')}
          </Button>
        </div>
      }
      closeIcon={null}
    >
      <Spin spinning={loading}>
        {detail ? (
          <div className='p-3 space-y-4'>
            {/* 顶部指标卡片 */}
            <Card className='!rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800'>
              <Descriptions data={overviewData} row size='small' />
            </Card>

            {/* 1. 授权主体与覆盖成员 */}
            <Card className='!rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800'>
              <div className='flex items-center gap-2 mb-2'>
                <IconUserGroup className='text-blue-500 text-lg' />
                <Title heading={5} className='m-0'>
                  {t('授权对象与实际覆盖成员')}
                </Title>
              </div>

              {/* 配置的主体规则 */}
              <div className='mb-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl'>
                <Text type='secondary' className='text-xs block mb-1.5 font-medium'>
                  {t('已授权主体规则')}:
                </Text>
                <div className='flex flex-wrap gap-1.5'>
                  {(detail.subjects || []).map((sub, idx) => {
                    const meta = subjectTypeMeta[sub.type] || { color: 'grey', text: '' };
                    return (
                      <Tag key={idx} color={meta.color}>
                        {meta.text}: {sub.name}
                      </Tag>
                    );
                  })}
                </div>
              </div>

              <Divider margin='12px' />

              {/* 覆盖成员列表 */}
              <div className='space-y-2'>
                <div className='flex justify-between items-center'>
                  <div>
                    <Text strong className='text-sm'>
                      {t('实际生效成员名单')}
                    </Text>
                    <span className='text-xs text-gray-500 ml-2'>
                      ({detail.total_users || 0} {t('人')})
                    </span>
                  </div>
                  <Input
                    size='small'
                    prefix={<IconSearch />}
                    placeholder={t('搜索成员姓名、部门...')}
                    value={userKeyword}
                    onChange={setUserKeyword}
                    showClear
                    style={{ width: 200 }}
                  />
                </div>

                <Table
                  columns={userColumns}
                  dataSource={filteredUsers}
                  rowKey='id'
                  size='small'
                  pagination={{
                    pageSize: 6,
                    showSizeChanger: false,
                  }}
                  empty={
                    <Empty
                      image={
                        <IllustrationNoResult
                          style={{ width: 80, height: 80 }}
                        />
                      }
                      darkModeImage={
                        <IllustrationNoResultDark
                          style={{ width: 80, height: 80 }}
                        />
                      }
                      description={t('暂无匹配成员')}
                      style={{ padding: 12 }}
                    />
                  }
                />
              </div>
            </Card>

            {/* 2. 授权模型资源 */}
            <Card className='!rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800'>
              <div className='flex items-center gap-2 mb-2'>
                <IconLayers className='text-green-500 text-lg' />
                <Title heading={5} className='m-0'>
                  {t('已授权模型资源')}
                </Title>
              </div>

              {/* 所属模型集 */}
              <div className='mb-3'>
                <Text type='secondary' className='text-xs block mb-1.5 font-medium'>
                  {t('涵盖模型集')}:
                </Text>
                <div className='flex flex-wrap gap-1.5'>
                  {(detail.model_sets || []).map((ms) => (
                    <Tag key={ms.id} color='cyan'>
                      {ms.name} {ms.direct_models ? `(${t('指定模型')})` : ''}
                    </Tag>
                  ))}
                </div>
              </div>

              <Divider margin='12px' />

              {/* 模型清单 */}
              <div className='space-y-2'>
                <div className='flex justify-between items-center'>
                  <div>
                    <Text strong className='text-sm'>
                      {t('可用模型清单')}
                    </Text>
                    <span className='text-xs text-gray-500 ml-2'>
                      ({detail.total_models || 0} {t('个')})
                    </span>
                  </div>
                  <Input
                    size='small'
                    prefix={<IconSearch />}
                    placeholder={t('搜索模型名称...')}
                    value={modelKeyword}
                    onChange={setModelKeyword}
                    showClear
                    style={{ width: 180 }}
                  />
                </div>

                <div className='max-h-56 overflow-y-auto p-3 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex flex-wrap gap-1.5'>
                  {filteredModels.length > 0 ? (
                    filteredModels.map((m, idx) => (
                      <Tag key={idx} color='green' size='large'>
                        {m}
                      </Tag>
                    ))
                  ) : (
                    <span className='text-gray-400 text-xs py-4 text-center w-full'>
                      {t('未找到匹配模型')}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className='py-16 flex justify-center'>
            <Empty description={t('未找到授权详情')} />
          </div>
        )}
      </Spin>
    </SideSheet>
  );
};

export default EditGrantDrawer;
