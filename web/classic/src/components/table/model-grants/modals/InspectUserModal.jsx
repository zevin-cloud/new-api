/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Select,
  Card,
  Tag,
  Typography,
  Spin,
  Empty,
  Tabs,
  TabPane,
  Banner,
  Table,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconUser,
  IconUsers,
  IconShield,
  IconCheckCircleStroked,
} from '@douyinfe/semi-icons';
import { API, showError, timestamp2string } from '../../../../helpers';

const { Text, Title } = Typography;

const InspectUserModal = ({ visible, onClose, t }) => {
  const [userOptions, setUserOptions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [inspectData, setInspectData] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingInspect, setLoadingInspect] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUsers();
      setSelectedUserId(null);
      setInspectData(null);
    }
  }, [visible]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await API.get('/api/user/search?p=0&page_size=200');
      if (res.data?.success) {
        setUserOptions(
          (res.data.data.items || []).map((u) => ({
            label: `${u.display_name || u.username} (@${u.username})`,
            value: u.id,
          }))
        );
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserChange = async (uid) => {
    setSelectedUserId(uid);
    if (!uid) {
      setInspectData(null);
      return;
    }

    setLoadingInspect(true);
    try {
      const res = await API.get(`/api/model-grant/inspect/${uid}`);
      if (res.data?.success) {
        setInspectData(res.data.data);
      } else {
        showError(res.data?.message || '获取权限诊断信息失败');
      }
    } catch (e) {
      showError('获取权限诊断信息失败: ' + e.message);
    } finally {
      setLoadingInspect(false);
    }
  };

  const renderGrantTable = (grants, emptyText) => {
    if (!grants || grants.length === 0) {
      return (
        <div className='py-4 text-center text-[var(--semi-color-text-2)]'>
          {emptyText || t('暂无相关授权')}
        </div>
      );
    }

    const columns = [
      {
        title: t('模型集'),
        dataIndex: 'model_set_name',
        render: (v) => <Tag color='blue'>{v}</Tag>,
      },
      {
        title: t('包含模型'),
        dataIndex: 'models',
        render: (models) => (
          <div className='flex flex-wrap gap-1 max-w-[320px]'>
            {(models || []).map((m) => (
              <Tag key={m} size='small' color='grey'>
                {m}
              </Tag>
            ))}
          </div>
        ),
      },
      {
        title: t('有效期'),
        dataIndex: 'expired_at',
        render: (v) => {
          if (!v || v === 0) return <Tag color='green'>{t('永久有效')}</Tag>;
          const isExpired = v < Math.floor(Date.now() / 1000);
          return (
            <Tag color={isExpired ? 'red' : 'orange'}>
              {timestamp2string(v)} {isExpired ? `(${t('已过期')})` : ''}
            </Tag>
          );
        },
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={grants}
        pagination={false}
        size='small'
      />
    );
  };

  return (
    <Modal
      title={t('用户模型权限透视与诊断')}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={780}
      className='!rounded-2xl'
    >
      <div className='flex flex-col gap-4 py-2'>
        <div className='flex items-center gap-3'>
          <Text strong>{t('选择要诊断的用户:')}</Text>
          <Select
            filter
            loading={loadingUsers}
            placeholder={t('搜索并选择用户...')}
            value={selectedUserId}
            onChange={handleUserChange}
            optionList={userOptions}
            className='!rounded-lg'
            style={{ width: 320 }}
          />
        </div>

        {loadingInspect ? (
          <div className='flex justify-center items-center py-12'>
            <Spin size='large' />
          </div>
        ) : inspectData ? (
          <div className='flex flex-col gap-4'>
            {/* 用户属性卡片 */}
            <div className='p-3 bg-[var(--semi-color-fill-0)] !rounded-xl border border-[var(--semi-color-border)] flex flex-wrap gap-6 items-center'>
              <div>
                <Text type='secondary'>{t('所属部门')}: </Text>
                <Tag color='cyan'>{inspectData.department_name || t('未分配部门')}</Tag>
              </div>
              <div>
                <Text type='secondary'>{t('所属用户组')}: </Text>
                {inspectData.group_names?.length > 0 ? (
                  inspectData.group_names.map((g) => (
                    <Tag key={g} color='violet' className='mr-1 !rounded-md'>
                      {g}
                    </Tag>
                  ))
                ) : (
                  <Text type='tertiary'>{t('无')}</Text>
                )}
              </div>
              {inspectData.is_admin && (
                <Tag color='red' className='!rounded-md'>{t('管理员 (拥有全部模型权限)')}</Tag>
              )}
            </div>

            {/* 最终有效可用模型列表 */}
            <Card
              title={
                <div className='flex justify-between items-center w-full'>
                  <span className='font-semibold flex items-center gap-1.5'>
                    <IconCheckCircleStroked className='text-green-500' />
                    {t('最终生效可用模型')}
                  </span>
                  <Tag color='green' className='!rounded-md'>
                    {t('共 {{count}} 个可用模型', {
                      count: inspectData.effective_models?.length || 0,
                    })}
                  </Tag>
                </div>
              }
              className='!rounded-xl shadow-sm border border-[var(--semi-color-border)]'
              headerStyle={{ padding: '12px 16px' }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {inspectData.effective_models?.length > 0 ? (
                <div className='flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto'>
                  {inspectData.effective_models.map((m) => (
                    <Tag key={m} color='blue' size='large'>
                      {m}
                    </Tag>
                  ))}
                </div>
              ) : (
                <div className='text-center py-3 text-[var(--semi-color-text-2)]'>
                  {t('该用户暂无任何有效模型调用权限')}
                </div>
              )}
            </Card>

            {/* 权限来源溯源 Tab */}
            <Tabs type='card'>
              <TabPane
                tab={
                  <span>
                    {t('部门授权')} (
                    {inspectData.department_grants?.length || 0})
                  </span>
                }
                itemKey='dept'
              >
                <div className='pt-2'>
                  {renderGrantTable(
                    inspectData.department_grants,
                    t('部门未获得直接或继承的模型集授权')
                  )}
                </div>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    {t('用户组授权')} (
                    {inspectData.group_grants?.length || 0})
                  </span>
                }
                itemKey='group'
              >
                <div className='pt-2'>
                  {renderGrantTable(
                    inspectData.group_grants,
                    t('所在用户组未绑定任何模型集')
                  )}
                </div>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    {t('个人直赋授权')} (
                    {inspectData.direct_grants?.length || 0})
                  </span>
                }
                itemKey='direct'
              >
                <div className='pt-2'>
                  {renderGrantTable(
                    inspectData.direct_grants,
                    t('未直接为该个人单独授予模型集')
                  )}
                </div>
              </TabPane>
            </Tabs>
          </div>
        ) : (
          <div className='py-12'>
            <Empty
              title={t('请在上方选择用户')}
              description={t('选择用户后即可查看该用户所有的模型授权及权限来源分布')}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InspectUserModal;
