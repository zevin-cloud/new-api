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

import React, { useEffect, useState } from 'react';
import { SideSheet, Descriptions, Tag, Button, Typography, Space, Divider, Spin } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { API, showError, renderQuota } from '../../../../helpers';

const { Title, Text } = Typography;

const UserDetailSideSheet = ({ visible, userId, onClose, t }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  useEffect(() => {
    if (visible && userId) {
      loadDetail(userId);
    } else {
      setDetailData(null);
    }
  }, [visible, userId]);

  const loadDetail = async (id) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/user/${id}/detail`);
      if (res.data?.success) {
        setDetailData(res.data.data);
      } else {
        showError(res.data?.message || '获取用户详情失败');
      }
    } catch (e) {
      showError('获取用户详情失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const user = detailData?.user;
  const deptName = detailData?.department_name || t('未分配部门');
  const userGroups = detailData?.user_groups || [];
  const effectiveModels = detailData?.effective_models || [];

  return (
    <SideSheet
      title={t('用户详情')}
      visible={visible}
      onCancel={onClose}
      placement='right'
      width={560}
    >
      <Spin spinning={loading}>
        {user ? (
          <div className='flex flex-col gap-4'>
            <div>
              <Title heading={4}>{user.display_name || user.username}</Title>
              <Text type='secondary'>@{user.username}</Text>
            </div>

            <Divider />

            <div>
              <Title heading={6} className='mb-2'>{t('基本信息')}</Title>
              <Descriptions
                data={[
                  { key: t('用户 ID'), value: user.id },
                  { key: t('工号'), value: user.employee_id || '-' },
                  { key: t('邮箱'), value: user.email || '-' },
                  {
                    key: t('角色'),
                    value: user.role >= 10 ? (
                      <Tag color='red'>{t('超级管理员')}</Tag>
                    ) : user.role >= 2 ? (
                      <Tag color='orange'>{t('管理员')}</Tag>
                    ) : (
                      <Tag color='blue'>{t('普通用户')}</Tag>
                    ),
                  },
                  {
                    key: t('状态'),
                    value: user.status === 1 ? (
                      <Tag color='green'>{t('已启用')}</Tag>
                    ) : (
                      <Tag color='grey'>{t('已禁用')}</Tag>
                    ),
                  },
                  { key: t('主要部门'), value: <Tag color='cyan'>{deptName}</Tag> },
                ]}
              />
            </div>

            <Divider />

            <div>
              <Title heading={6} className='mb-2'>{t('加入的用户组')}</Title>
              {userGroups.length > 0 ? (
                <Space wrap>
                  {userGroups.map((g) => (
                    <Tag key={g.id} color='violet'>
                      {g.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type='tertiary'>{t('暂未加入任何用户组')}</Text>
              )}
            </div>

            <Divider />

            <div>
              <Title heading={6} className='mb-2'>{t('有效模型权限 (并集计算)')}</Title>
              {user.role >= 2 ? (
                <Tag color='green'>{t('管理员全模型权限')}</Tag>
              ) : effectiveModels.length > 0 ? (
                <Space wrap className='max-h-48 overflow-y-auto'>
                  {effectiveModels.map((m) => (
                    <Tag key={m} color='blue'>
                      {m}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type='tertiary'>{t('暂无可用模型授权')}</Text>
              )}
            </div>

            <Divider />

            <div>
              <Title heading={6} className='mb-2'>{t('快捷管理与审计入口')}</Title>
              <Space>
                <Button
                  theme='light'
                  type='primary'
                  onClick={() => {
                    onClose();
                    navigate(`/console/token?user_id=${user.id}`);
                  }}
                >
                  {t('查看该用户的 API Key ({{count}})', { count: detailData?.token_count || 0 })}
                </Button>
                <Button
                  theme='light'
                  type='tertiary'
                  onClick={() => {
                    onClose();
                    navigate(`/console/log?user_id=${user.id}`);
                  }}
                >
                  {t('查看调用日志')}
                </Button>
              </Space>
            </div>
          </div>
        ) : (
          !loading && (
            <div className='py-16 flex justify-center'>
              <Text type='secondary'>{t('暂无用户详情')}</Text>
            </div>
          )
        )}
      </Spin>
    </SideSheet>
  );
};

export default UserDetailSideSheet;
