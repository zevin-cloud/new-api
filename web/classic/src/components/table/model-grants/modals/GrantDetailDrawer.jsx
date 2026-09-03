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
  Avatar,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconUser,
  IconEdit,
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

const GrantDetailDrawer = ({
  visible,
  batchItem,
  onClose,
  onEdit,
  onRevoke,
}) => {
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

  const allModels = useMemo(() => detail?.models || [], [detail?.models]);

  const filteredModels = useMemo(() => {
    if (!modelKeyword.trim()) return allModels;
    const kw = modelKeyword.toLowerCase();
    return allModels.filter((m) => m.toLowerCase().includes(kw));
  }, [allModels, modelKeyword]);

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
        (u.employee_id && String(u.employee_id).toLowerCase().includes(kw))
    );
  }, [detail?.union_users, userKeyword]);

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
        key: t('授权模型'),
        value: (
          <span className='font-semibold text-green-600'>
            {detail.total_models || 0} {t('个')}
          </span>
        ),
      },
      {
        key: t('被授权用户'),
        value: (
          <span className='font-semibold text-blue-600'>
            {detail.total_users || 0} {t('位')}
          </span>
        ),
      },
    ];
  }, [detail, expiryTag, targetId, t]);

  const userColumns = [
    {
      title: t('用户'),
      render: (_, u) => (
        <div className='flex items-center gap-2.5'>
          <Avatar size='small' color='blue'>
            {u.display_name?.[0] || u.username?.[0] || <IconUser />}
          </Avatar>
          <div className='flex flex-col min-w-0'>
            <span className='font-medium text-gray-800 dark:text-gray-200 truncate'>
              {u.display_name || u.username}
            </span>
            <span className='text-xs text-gray-400 truncate'>@{u.username}</span>
          </div>
        </div>
      ),
    },
    {
      title: t('所属部门'),
      dataIndex: 'department_name',
      render: (text) =>
        text ? (
          <Tag color='blue' size='small'>
            {text}
          </Tag>
        ) : (
          <span className='text-gray-400'>-</span>
        ),
    },
    {
      title: t('邮箱 / 工号'),
      render: (_, u) => (
        <div className='flex flex-col text-xs text-gray-500 dark:text-gray-400'>
          {u.email ? <span>{u.email}</span> : null}
          {u.employee_id ? <span>工号: {u.employee_id}</span> : null}
          {!u.email && !u.employee_id ? <span className='text-gray-400'>-</span> : null}
        </div>
      ),
    },
  ];

  return (
    <SideSheet
      placement='right'
      title={
        <Space>
          <Tag color='teal' shape='circle'>
            {t('详情')}
          </Tag>
          <Title heading={4} className='m-0'>
            {t('授权详情')}
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
      width={isMobile ? '100%' : 680}
      footer={
        <div className='flex justify-between items-center bg-white dark:bg-gray-900 px-4 py-3 w-full border-t border-gray-100 dark:border-gray-800'>
          <Space>
            {batchItem && (
              <Button
                theme='solid'
                type='primary'
                icon={<IconEdit />}
                onClick={() => {
                  onClose();
                  onEdit?.(batchItem);
                }}
              >
                {t('编辑此授权')}
              </Button>
            )}
            {batchItem && (
              <Popconfirm
                title={t('确认撤销')}
                content={t('确定撤销此次授权吗？撤销后所有成员将失去本次授予的模型访问权限。')}
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
          </Space>
          <Button theme='light' type='tertiary' onClick={onClose} icon={<IconClose />}>
            {t('关闭')}
          </Button>
        </div>
      }
      closeIcon={null}
    >
      <Spin spinning={loading}>
        {detail ? (
          <div className='p-4 space-y-4'>
            {/* 1. 基本信息概要 */}
            <Card className='!rounded-xl shadow-sm border border-gray-100 dark:border-gray-800' bodyStyle={{ padding: '12px 16px' }}>
              <Descriptions data={overviewData} row size='small' />
            </Card>

            {/* 2. 授权的模型列表 */}
            <Card className='!rounded-xl shadow-sm border border-gray-100 dark:border-gray-800' bodyStyle={{ padding: '14px 16px' }}>
              <div className='flex justify-between items-center mb-3'>
                <div className='flex items-center gap-2'>
                  <Title heading={5} className='m-0'>
                    {t('授权模型')}
                  </Title>
                  <Tag color='green' size='small' shape='circle'>
                    {allModels.length}
                  </Tag>
                </div>
                {allModels.length > 5 && (
                  <Input
                    size='small'
                    prefix={<IconSearch />}
                    placeholder={t('搜索模型...')}
                    value={modelKeyword}
                    onChange={setModelKeyword}
                    showClear
                    style={{ width: 180 }}
                  />
                )}
              </div>

              {filteredModels.length > 0 ? (
                <div className='flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800/40 rounded-lg'>
                  {filteredModels.map((m, idx) => (
                    <Tag
                      key={idx}
                      color='green'
                      size='large'
                      className='!text-xs font-mono font-medium'
                    >
                      {m}
                    </Tag>
                  ))}
                </div>
              ) : (
                <div className='py-6 text-center text-xs text-gray-400'>
                  {t('未找到匹配的模型')}
                </div>
              )}
            </Card>

            {/* 3. 被授权的用户列表 */}
            <Card className='!rounded-xl shadow-sm border border-gray-100 dark:border-gray-800' bodyStyle={{ padding: '14px 16px' }}>
              <div className='flex justify-between items-center mb-3'>
                <div className='flex items-center gap-2'>
                  <Title heading={5} className='m-0'>
                    {t('被授权用户')}
                  </Title>
                  <Tag color='blue' size='small' shape='circle'>
                    {detail?.union_users?.length || 0}
                  </Tag>
                </div>
                <Input
                  size='small'
                  prefix={<IconSearch />}
                  placeholder={t('搜索姓名、部门、账号...')}
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
                  showSizeChanger: true,
                  pageSizeOptions: [6, 12, 24],
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
                    description={t('未找到匹配的用户')}
                    style={{ padding: 12 }}
                  />
                }
              />
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

export default GrantDetailDrawer;
