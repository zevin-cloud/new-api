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
  Modal,
  Tabs,
  TabPane,
  Table,
  Tag,
  Button,
  Popconfirm,
  Spin,
  Empty,
  Input,
  Descriptions,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconUserGroup,
  IconLayers,
  IconDelete,
} from '@douyinfe/semi-icons';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getGrantBatchDetail } from '../../../../services/modelGrants';
import { timestamp2string, showError } from '../../../../helpers';

const GrantDetailModal = ({ visible, batchItem, onClose, onRevoke }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [userKeyword, setUserKeyword] = useState('');
  const [modelKeyword, setModelKeyword] = useState('');

  const targetId = useMemo(() => {
    if (!batchItem) return null;
    if (batchItem.batch_id > 0) return batchItem.batch_id;
    return (
      batchItem.legacy_id ||
      (Array.isArray(batchItem.grants) && batchItem.grants[0]?.id) ||
      batchItem.id
    );
  }, [batchItem]);

  const isLegacy = useMemo(() => {
    if (!batchItem) return false;
    return !batchItem.batch_id || batchItem.batch_id === 0;
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
      width: 70,
    },
    {
      title: t('用户名 / 显示名'),
      width: 180,
      render: (_, u) => (
        <div className='flex flex-col'>
          <span className='font-medium text-gray-800 dark:text-gray-200'>
            {u.username}
          </span>
          {u.display_name && (
            <span className='text-xs text-gray-400'>{u.display_name}</span>
          )}
        </div>
      ),
    },
    {
      title: t('所属部门'),
      dataIndex: 'department_name',
      width: 150,
      render: (text) => text || <span className='text-gray-400'>-</span>,
    },
    {
      title: t('邮箱'),
      dataIndex: 'email',
      width: 180,
      render: (text) => text || <span className='text-gray-400'>-</span>,
    },
    {
      title: t('授权来源 (并集路径)'),
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

  const subjectColumns = [
    {
      title: t('主体类型'),
      dataIndex: 'type',
      width: 120,
      render: (type) => {
        const meta = subjectTypeMeta[type] || { text: '-', color: 'grey' };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: t('主体名称'),
      dataIndex: 'name',
      render: (name) => <span className='font-medium'>{name}</span>,
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

  const descriptionsData = useMemo(() => {
    if (!detail) return [];
    return [
      {
        key: t('授权编号'),
        value: detail.is_legacy ? `#${detail.subjects?.[0]?.id || targetId}` : `#${detail.batchId}`,
      },
      {
        key: t('授权时间'),
        value: timestamp2string(detail.created_at),
      },
      {
        key: t('有效期'),
        value: expiryTag,
      },
      {
        key: t('并集覆盖用户'),
        value: (
          <span className='font-semibold text-blue-600'>
            {detail.total_users} {t('位')}
          </span>
        ),
      },
      {
        key: t('涵盖模型总数'),
        value: (
          <span className='font-semibold text-green-600'>
            {detail.total_models} {t('个')}
          </span>
        ),
      },
    ];
  }, [detail, expiryTag, targetId, t]);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      width={820}
      title={
        <div className='flex items-center gap-2'>
          <IconUserGroup className='text-blue-500 text-lg' />
          <span>
            {t('授权详情与并集用户')}
            {detail && (
              <span className='text-xs text-gray-500 font-normal ml-2'>
                (ID: {detail.is_legacy ? `#${targetId}` : `#${detail.batchId}`})
              </span>
            )}
          </span>
        </div>
      }
      footer={
        <div className='flex justify-between items-center w-full'>
          <div>
            {batchItem && (
              <Popconfirm
                title={t('确认撤销')}
                content={t('确定撤销此次授权吗？撤销后相关主体将失去此授权的所有模型访问权限。')}
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
          <Button onClick={onClose}>{t('关闭')}</Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        {detail ? (
          <div className='space-y-4'>
            {/* 顶部概览 */}
            <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700'>
              <Descriptions data={descriptionsData} row size='small' />
            </div>

            {/* 选项卡区域 */}
            <Tabs type='line'>
              {/* 1. 并集覆盖用户 */}
              <TabPane
                tab={
                  <span className='flex items-center gap-1'>
                    <IconUserGroup />
                    {t('并集覆盖用户')} ({detail.total_users})
                  </span>
                }
                itemKey='users'
              >
                <div className='space-y-3 pt-2'>
                  <div className='flex justify-between items-center'>
                    <span className='text-xs text-gray-500'>
                      {t('已自动展开部门下成员、用户组成员及个人用户，合并去重后的真实受权人员名单')}
                    </span>
                    <Input
                      size='small'
                      prefix={<IconSearch />}
                      placeholder={t('搜索用户、部门、来源...')}
                      value={userKeyword}
                      onChange={setUserKeyword}
                      showClear
                      style={{ width: 220 }}
                    />
                  </div>
                  <Table
                    columns={userColumns}
                    dataSource={filteredUsers}
                    rowKey='id'
                    size='small'
                    pagination={{
                      pageSize: 8,
                      showSizeChanger: false,
                    }}
                    empty={
                      <Empty
                        image={
                          <IllustrationNoResult
                            style={{ width: 100, height: 100 }}
                          />
                        }
                        darkModeImage={
                          <IllustrationNoResultDark
                            style={{ width: 100, height: 100 }}
                          />
                        }
                        description={t('暂无匹配用户')}
                        style={{ padding: 20 }}
                      />
                    }
                  />
                </div>
              </TabPane>

              {/* 2. 授权模型清单 */}
              <TabPane
                tab={
                  <span className='flex items-center gap-1'>
                    <IconLayers />
                    {t('生效模型清单')} ({detail.total_models})
                  </span>
                }
                itemKey='models'
              >
                <div className='space-y-3 pt-2'>
                  <div className='flex justify-between items-center'>
                    <div className='text-xs text-gray-500 flex items-center gap-2'>
                      <span>{t('所属模型集')}:</span>
                      {(detail.model_sets || []).map((ms) => (
                        <Tag key={ms.id} color='cyan' size='small'>
                          {ms.name} {ms.direct_models ? `(${t('指定模型')})` : ''}
                        </Tag>
                      ))}
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
                  <div className='max-h-72 overflow-y-auto p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-2'>
                    {filteredModels.length > 0 ? (
                      filteredModels.map((m, idx) => (
                        <Tag key={idx} color='green' size='large'>
                          {m}
                        </Tag>
                      ))
                    ) : (
                      <span className='text-gray-400 text-sm'>
                        {t('暂无匹配模型')}
                      </span>
                    )}
                  </div>
                </div>
              </TabPane>

              {/* 3. 原始授权规则主体 */}
              <TabPane
                tab={
                  <span>
                    {t('配置主体规则')} ({detail.subjects?.length || 0})
                  </span>
                }
                itemKey='subjects'
              >
                <div className='pt-2'>
                  <Table
                    columns={subjectColumns}
                    dataSource={detail.subjects || []}
                    rowKey='id'
                    size='small'
                    pagination={false}
                  />
                </div>
              </TabPane>
            </Tabs>
          </div>
        ) : (
          <div className='py-12 flex justify-center'>
            <Empty description={t('未找到授权详情')} />
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default GrantDetailModal;
