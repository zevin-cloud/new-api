/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Form, Radio, Select } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const UserGroupModal = ({ visible, editingGroup, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);
  const [userOptions, setUserOptions] = useState([]);
  const [searchUserLoading, setSearchUserLoading] = useState(false);

  const loadInitialUsers = async () => {
    setSearchUserLoading(true);
    try {
      const res = await API.get('/api/user/search?keyword=&p=0&page_size=50');
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
      const res = await API.get(`/api/user/search?keyword=${encodeURIComponent(query)}&p=0&page_size=50`);
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
      if (editingGroup) {
        // Update
        const res = await API.put(`/api/user-group/${editingGroup.id}`, {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          user_ids: values.user_ids || [],
        });
        if (res.data?.success) {
          showSuccess(t('更新用户组成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '更新失败');
        }
      } else {
        // Create
        const res = await API.post('/api/user-group', {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          user_ids: values.user_ids || [],
        });
        if (res.data?.success) {
          showSuccess(t('创建用户组成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '创建失败');
        }
      }
    } catch (e) {
      // form validation
    }
  };

  return (
    <Modal
      title={editingGroup ? t('编辑用户组') : t('新建用户组')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      width={640}
      destroyOnClose
    >
      <Form getFormApi={(api) => (formApiRef.current = api)}>
        <Form.Input
          field='name'
          label={t('用户组名称')}
          placeholder={t('例如：开发组、算法组、实习生组')}
          rules={[{ required: true, message: t('请输入用户组名称') }]}
        />
        <Form.TextArea
          field='description'
          label={t('用户组说明')}
          placeholder={t('说明该组的用途及授权范围（可选）')}
          rows={3}
        />
        <Form.Select
          field='user_ids'
          label={t('用户组成员')}
          placeholder={t('输入用户名、姓名或工号搜索并选择待加入的用户（可选）')}
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
        <Form.RadioGroup field='status' label={t('状态')} initValue={1}>
          <Radio value={1}>{t('启用')}</Radio>
          <Radio value={2}>{t('禁用')}</Radio>
        </Form.RadioGroup>
      </Form>
    </Modal>
  );
};

export default UserGroupModal;
