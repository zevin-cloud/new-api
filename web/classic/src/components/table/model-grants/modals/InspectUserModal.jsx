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

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
import { showError, timestamp2string } from '../../../../helpers';

import {
  loadGrantUsers,
  inspectGrantUser,
} from '../../../../services/modelGrants';

const { Text, Title } = Typography;

const InspectUserModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const activeInspect = useRef(null);
  const [userOptions, setUserOptions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [inspectData, setInspectData] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingInspect, setLoadingInspect] = useState(false);

  useEffect(() => {
    if (visible) {
      const controller = new AbortController();
      loadUsers(controller.signal);
      setSelectedUserId(null);
      setInspectData(null);
      return () => {
        controller.abort();
        activeInspect.current?.abort();
      };
    }
  }, [visible]);

  const loadUsers = async (signal) => {
    setLoadingUsers(true);
    try {
      const users = await loadGrantUsers(signal);
      if (!signal.aborted)
        setUserOptions(
          users.map((user) => ({
            label:
              (user.display_name || user.username) +
              ' (@' +
              user.username +
              ')',
            value: user.id,
          }))
        );
    } catch (error) {
      if (!signal.aborted)
        showError(error.message || t('Unable to load authorization data'));
    } finally {
      if (!signal.aborted) setLoadingUsers(false);
    }
  };

  const handleUserChange = async (uid) => {
    activeInspect.current?.abort();
    setSelectedUserId(uid);
    setInspectData(null);
    setLoadingInspect(false);
    if (!uid) return;
    const controller = new AbortController();
    activeInspect.current = controller;
    setLoadingInspect(true);
    try {
      const data = await inspectGrantUser(uid, controller.signal);
      if (!controller.signal.aborted) setInspectData(data);
    } catch (error) {
      if (!controller.signal.aborted)
        showError(error.message || t('Unable to load authorization data'));
    } finally {
      if (!controller.signal.aborted) setLoadingInspect(false);
    }
  };

  const renderGrantTable = (grants, emptyText) => {
    if (!grants || grants.length === 0) {
      return (
        <div className='py-4 text-center text-[var(--semi-color-text-2)]'>
          {emptyText || t('No related authorizations')}
        </div>
      );
    }

    const columns = [
      {
        title: t('Model set'),
        dataIndex: 'model_set_name',
        render: (v) => (
          <span className='block max-w-[200px] truncate' title={v}>
            {v}
          </span>
        ),
      },
      {
        title: t('Included models'),
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
          if (!v || v === 0)
            return <Tag color='green'>{t('Never expires')}</Tag>;
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
      title={t('User model access diagnostics')}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={780}
      className='!rounded-2xl'
    >
      <div className='flex flex-col gap-4 py-2'>
        <div className='flex items-center gap-3'>
          <Text strong>{t('User to inspect:')}</Text>
          <Select
            filter
            loading={loadingUsers}
            placeholder={t('Search and select a user...')}
            value={selectedUserId}
            onChange={handleUserChange}
            optionList={userOptions}
            className='!rounded-lg'
            style={{ width: 320 }}
          />
        </div>

        {loadingInspect && (
          <div className='flex justify-center items-center py-12'>
            <Spin size='large' />
          </div>
        )}
        {!loadingInspect && inspectData && (
          <div className='flex flex-col gap-4'>
            {/* 用户属性卡片 */}
            <div className='p-3 bg-[var(--semi-color-fill-0)] !rounded-xl border border-[var(--semi-color-border)] flex flex-wrap gap-6 items-center'>
              <div>
                <Text type='secondary'>{t('User department')}: </Text>
                <Tag color='cyan'>
                  {inspectData.department_name || t('No department')}
                </Tag>
              </div>
              <div>
                <Text type='secondary'>{t('User groups')}: </Text>
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
                <Tag color='red' className='!rounded-md'>
                  {t('Administrator (all model access)')}
                </Tag>
              )}
            </div>

            {/* 最终有效可用模型列表 */}
            <Card
              title={
                <div className='flex justify-between items-center w-full'>
                  <span className='font-semibold flex items-center gap-1.5'>
                    <IconCheckCircleStroked className='text-green-500' />
                    {t('Effective models')}
                  </span>
                  <Tag color='green' className='!rounded-md'>
                    {inspectData.is_admin
                      ? t('All models available')
                      : t('{{count}} models available', {
                          count: inspectData.effective_models?.length || 0,
                        })}
                  </Tag>
                </div>
              }
              className='!rounded-xl shadow-sm border border-[var(--semi-color-border)]'
              headerStyle={{ padding: '12px 16px' }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {inspectData.is_admin && (
                <Banner
                  type='info'
                  description={t(
                    'Administrators have access to all models. API key restrictions and channel availability still apply.'
                  )}
                />
              )}
              {!inspectData.is_admin &&
                inspectData.effective_models?.length > 0 && (
                  <div className='flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto'>
                    {inspectData.effective_models.map((m) => (
                      <Tag key={m} color='blue' size='large'>
                        {m}
                      </Tag>
                    ))}
                  </div>
                )}
              {!inspectData.is_admin &&
                !inspectData.effective_models?.length && (
                  <div className='text-center py-3 text-[var(--semi-color-text-2)]'>
                    {t('This user has no active model access')}
                  </div>
                )}
            </Card>

            {/* 权限来源溯源 Tab */}
            <Tabs type='card'>
              <TabPane
                tab={
                  <span>
                    {t('Department grants')} (
                    {inspectData.department_grants?.length || 0})
                  </span>
                }
                itemKey='dept'
              >
                <div className='pt-2'>
                  {renderGrantTable(
                    inspectData.department_grants,
                    t('No direct or inherited department grants')
                  )}
                </div>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    {t('Group grants')} ({inspectData.group_grants?.length || 0}
                    )
                  </span>
                }
                itemKey='group'
              >
                <div className='pt-2'>
                  {renderGrantTable(
                    inspectData.group_grants,
                    t('No model sets assigned to these groups')
                  )}
                </div>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    {t('Direct user grants')} (
                    {inspectData.direct_grants?.length || 0})
                  </span>
                }
                itemKey='direct'
              >
                <div className='pt-2'>
                  {renderGrantTable(
                    inspectData.direct_grants,
                    t('No model sets assigned directly to this user')
                  )}
                </div>
              </TabPane>
            </Tabs>
          </div>
        )}
        {!loadingInspect && !inspectData && (
          <div className='py-12'>
            <Empty
              title={t('Select a user above')}
              description={t(
                'Select a user to see their model access and authorization sources'
              )}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InspectUserModal;
