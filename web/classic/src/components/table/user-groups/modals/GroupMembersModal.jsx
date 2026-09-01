/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Select, Space, Tag, Typography, Popconfirm, Spin } from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';

const { Text } = Typography;

const GroupMembersModal = ({ visible, group, onClose, t }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userOptions, setUserOptions] = useState([]);
  const [selectedUserIdsToAdd, setSelectedUserIdsToAdd] = useState([]);
  const [searchUserLoading, setSearchUserLoading] = useState(false);

  useEffect(() => {
    if (visible && group) {
      loadMembers(1);
    }
  }, [visible, group]);

  const loadMembers = async (p = 1) => {
    if (!group) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/user-group/${group.id}/members?page=${p}&page_size=10`);
      if (res.data?.success) {
        setMembers(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || 1);
      } else {
        showError(res.data?.message || '获取成员失败');
      }
    } catch (e) {
      showError('获取成员失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async (query) => {
    if (!query) return;
    setSearchUserLoading(true);
    try {
      const res = await API.get(`/api/user/search?keyword=${query}&p=0&page_size=20`);
      if (res.data?.success) {
        setUserOptions(res.data.data.items || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setSearchUserLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUserIdsToAdd.length === 0) {
      showError(t('请选择要添加的用户'));
      return;
    }
    try {
      const res = await API.post(`/api/user-group/${group.id}/members`, {
        user_ids: selectedUserIdsToAdd,
      });
      if (res.data?.success) {
        showSuccess(t('添加成员成功'));
        setSelectedUserIdsToAdd([]);
        loadMembers(1);
      } else {
        showError(res.data?.message || '添加失败');
      }
    } catch (e) {
      showError('添加失败: ' + e.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const res = await API.delete(`/api/user-group/${group.id}/members`, {
        data: { user_ids: [userId] },
      });
      if (res.data?.success) {
        showSuccess(t('移除成员成功'));
        loadMembers(page);
      } else {
        showError(res.data?.message || '移除失败');
      }
    } catch (e) {
      showError('移除失败: ' + e.message);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: t('用户名'), dataIndex: 'username', width: 130 },
    { title: t('姓名'), dataIndex: 'display_name', width: 130 },
    { title: t('工号'), dataIndex: 'employee_id', width: 110, render: (v) => v || '-' },
    { title: t('邮箱'), dataIndex: 'email', render: (v) => v || '-' },
    {
      title: t('操作'),
      key: 'op',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title={t('确认移出')}
          content={t('确定将 {{name}} 移出该用户组吗？', { name: record.username })}
          onConfirm={() => handleRemoveMember(record.id)}
        >
          <Button size='small' type='danger' theme='borderless'>
            {t('移出')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={t('成员管理 - {{name}} (共 {{total}} 人)', { name: group?.name, total })}
      visible={visible}
      onCancel={onClose}
      width={780}
      className='!rounded-2xl'
      footer={
        <Button theme='light' className='!rounded-lg' onClick={onClose}>
          {t('关闭')}
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex gap-2 items-center p-3 bg-[var(--semi-color-fill-0)] !rounded-xl border border-[var(--semi-color-border)]'>
          <Select
            placeholder={t('输入用户名、姓名或工号搜索待添加的用户')}
            filter
            remote
            multiple
            loading={searchUserLoading}
            onSearch={handleSearchUsers}
            value={selectedUserIdsToAdd}
            onChange={(val) => setSelectedUserIdsToAdd(val)}
            className='!rounded-lg'
            style={{ width: '100%' }}
          >
            {userOptions.map((u) => (
              <Select.Option key={u.id} value={u.id}>
                {u.display_name ? `${u.display_name} (@${u.username})` : u.username} {u.employee_id ? `[${u.employee_id}]` : ''}
              </Select.Option>
            ))}
          </Select>
          <Button
            theme='solid'
            type='primary'
            className='!rounded-lg whitespace-nowrap'
            icon={<IconPlus />}
            onClick={handleAddMembers}
            disabled={selectedUserIdsToAdd.length === 0}
          >
            {t('添加成员')}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={members}
          loading={loading}
          pagination={{
            currentPage: page,
            pageSize: 10,
            total: total,
            onPageChange: (p) => loadMembers(p),
          }}
          size='small'
        />
      </div>
    </Modal>
  );
};

export default GroupMembersModal;
