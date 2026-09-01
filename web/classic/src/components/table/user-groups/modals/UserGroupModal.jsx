/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState } from 'react';
import {
  SideSheet,
  Form,
  Radio,
  Button,
  Space,
  Tag,
  Typography,
  Card,
  Avatar,
  Spin,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconUserGroup,
  IconUser,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Title, Text } = Typography;

const UserGroupModal = ({ visible, editingGroup, onClose, onSuccess, t }) => {
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [userOptions, setUserOptions] = useState([]);
  const [searchUserLoading, setSearchUserLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(editingGroup);

  const loadInitialUsers = async () => {
    setSearchUserLoading(true);
    try {
      const res = await API.get('/api/user/search?keyword=&p=0&page_size=100');
      if (res.data?.success) {
        const items = res.data.data.items || res.data.data || [];
        setUserOptions((prev) => {
          const map = new Map();
          (prev || []).forEach((u) => map.set(u.id, u));
          items.forEach((u) => map.set(u.id, u));
          return Array.from(map.values());
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setSearchUserLoading(false);
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      const res = await API.get(`/api/user-group/${groupId}/members?page=1&page_size=1000`);
      if (res.data?.success) {
        const members = res.data.data.items || [];
        const userIds = members.map((m) => m.user_id || m.id);
        if (formApiRef.current) {
          formApiRef.current.setValue('user_ids', userIds);
        }
        setUserOptions((prev) => {
          const map = new Map();
          (prev || []).forEach((u) => map.set(u.id, u));
          members.forEach((m) => {
            const uid = m.user_id || m.id;
            map.set(uid, {
              id: uid,
              username: m.username,
              display_name: m.display_name,
              employee_id: m.employee_id,
              email: m.email,
            });
          });
          return Array.from(map.values());
        });
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSearchUsers = async (query) => {
    if (!query) return;
    setSearchUserLoading(true);
    try {
      const res = await API.get(`/api/user/search?keyword=${encodeURIComponent(query)}&p=0&page_size=100`);
      if (res.data?.success) {
        const items = res.data.data.items || res.data.data || [];
        setUserOptions((prev) => {
          const map = new Map();
          (prev || []).forEach((u) => map.set(u.id, u));
          items.forEach((u) => map.set(u.id, u));
          return Array.from(map.values());
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setSearchUserLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadInitialUsers();
      if (formApiRef.current) {
        if (editingGroup) {
          formApiRef.current.setValues({
            name: editingGroup.name,
            description: editingGroup.description || '',
            status: editingGroup.status !== undefined ? editingGroup.status : 1,
            user_ids: [],
          });
          loadGroupMembers(editingGroup.id);
        } else {
          formApiRef.current.setValues({
            name: '',
            description: '',
            status: 1,
            user_ids: [],
          });
        }
      }
    }
  }, [visible, editingGroup]);

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      setLoading(true);
      if (editingGroup) {
        const res = await API.put(`/api/user-group/${editingGroup.id}`, {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          user_ids: values.user_ids || [],
        });
        if (res.data?.success) {
          showSuccess(t('更新用户组成功'));
          onSuccess();
          onClose();
        } else {
          showError(res.data?.message || '更新失败');
        }
      } else {
        const res = await API.post('/api/user-group', {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          user_ids: values.user_ids || [],
        });
        if (res.data?.success) {
          showSuccess(t('创建用户组成功'));
          onSuccess();
          onClose();
        } else {
          showError(res.data?.message || '创建失败');
        }
      }
    } catch (e) {
      // validation error
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideSheet
      placement='right'
      title={
        <Space>
          <Tag color={isEdit ? 'blue' : 'green'} shape='circle'>
            {isEdit ? t('更新') : t('新建')}
          </Tag>
          <Title heading={4} className='m-0'>
            {isEdit ? t('编辑用户组') : t('新建用户组')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={visible}
      width={isMobile ? '100%' : 640}
      footer={
        <div className='flex justify-end bg-white p-3'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={handleSubmit}
              icon={<IconSave />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
              type='primary'
              onClick={onClose}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={onClose}
    >
      <Spin spinning={loading}>
        <Form getFormApi={(api) => (formApiRef.current = api)}>
          <div className='p-2 space-y-3'>
            {/* 基本信息卡片 */}
            <Card className='!rounded-2xl shadow-sm border-0'>
              <div className='flex items-center mb-3'>
                <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                  <IconUserGroup size={16} />
                </Avatar>
                <div>
                  <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                  <div className='text-xs text-gray-600'>
                    {t('定义用户组的名称与用途说明')}
                  </div>
                </div>
              </div>

              <Row gutter={12}>
                <Col span={24}>
                  <Form.Input
                    field='name'
                    label={t('用户组名称')}
                    placeholder={t('例如：开发组、算法组、实习生组')}
                    rules={[{ required: true, message: t('请输入用户组名称') }]}
                    showClear
                  />
                </Col>

                <Col span={24}>
                  <Form.TextArea
                    field='description'
                    label={t('用户组说明')}
                    placeholder={t('说明该组的用途及授权范围（可选）')}
                    rows={3}
                    showClear
                  />
                </Col>

                <Col span={24}>
                  <Form.RadioGroup field='status' label={t('状态')} initValue={1}>
                    <Radio value={1}>{t('启用')}</Radio>
                    <Radio value={2}>{t('禁用')}</Radio>
                  </Form.RadioGroup>
                </Col>
              </Row>
            </Card>

            {/* 成员设置卡片 */}
            <Card className='!rounded-2xl shadow-sm border-0'>
              <div className='flex items-center mb-3'>
                <Avatar size='small' color='green' className='mr-2 shadow-md'>
                  <IconUser size={16} />
                </Avatar>
                <div>
                  <Text className='text-lg font-medium'>{t('成员配置')}</Text>
                  <div className='text-xs text-gray-600'>
                    {t('为该用户组添加初始成员')}
                  </div>
                </div>
              </div>

              <Row gutter={12}>
                <Col span={24}>
                  <Form.Select
                    field='user_ids'
                    label={t('待加入成员')}
                    placeholder={t('搜索选择待加入的用户（支持工号、姓名、用户名）')}
                    optionList={userOptions.map((u) => ({
                      label: `${u.display_name ? `${u.display_name} (@${u.username})` : u.username}${u.employee_id ? ` [${u.employee_id}]` : ''}`,
                      value: u.id,
                      key: u.id,
                    }))}
                    multiple
                    filter
                    remote
                    loading={searchUserLoading}
                    onSearch={handleSearchUsers}
                    style={{ width: '100%' }}
                    showClear
                  />
                </Col>
              </Row>
            </Card>
          </div>
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default UserGroupModal;
