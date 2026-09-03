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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CardPro from '../../common/ui/CardPro';
import UserGroupsTable from './UserGroupsTable';
import UserGroupsActions from './UserGroupsActions';
import UserGroupsFilters from './UserGroupsFilters';
import UserGroupModal from './modals/UserGroupModal';
import GroupMembersModal from './modals/GroupMembersModal';
import { API, showError, showSuccess } from '../../../helpers';
import { Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const UserGroupsPage = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [managingMembersGroup, setManagingMembersGroup] = useState(null);

  const loadGroups = async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/user-group?page=${p}&page_size=${pageSize}&keyword=${encodeURIComponent(kw)}`);
      if (res.data?.success) {
        setGroups(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || 1);
      } else {
        showError(res.data?.message || '获取用户组列表失败');
      }
    } catch (e) {
      showError('获取用户组列表失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups(1);
  }, []);

  const handleSearch = (kw) => {
    setKeyword(kw);
    loadGroups(1, kw);
  };

  const handleAdd = () => {
    setEditingGroup(null);
    setShowGroupModal(true);
  };

  const handleEdit = (record) => {
    setEditingGroup(record);
    setShowGroupModal(true);
  };

  const handleManageMembers = (record) => {
    setManagingMembersGroup(record);
    setShowMembersModal(true);
  };

  const handleDelete = async (record) => {
    try {
      const res = await API.delete(`/api/user-group/${record.id}`);
      if (res.data?.success) {
        showSuccess(t('删除用户组成功'));
        loadGroups(page);
      } else {
        showError(res.data?.message || '删除失败');
      }
    } catch (e) {
      showError('删除失败: ' + e.message);
    }
  };

  return (
    <>
      <UserGroupModal
        visible={showGroupModal}
        editingGroup={editingGroup}
        onClose={() => setShowGroupModal(false)}
        onSuccess={() => {
          setShowGroupModal(false);
          loadGroups(page);
        }}
        t={t}
      />

      <GroupMembersModal
        visible={showMembersModal}
        group={managingMembersGroup}
        onClose={() => {
          setShowMembersModal(false);
          loadGroups(page);
        }}
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <div>
            <Title heading={4}>{t('用户组管理')}</Title>
            <Text type='secondary'>
              {t('支持跨部门将用户聚合为项目组或业务组，并集中授予模型集访问权限。')}
            </Text>
          </div>
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <UserGroupsActions onAdd={handleAdd} t={t} />
            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
              <UserGroupsFilters onSearch={handleSearch} loading={loading} t={t} />
            </div>
          </div>
        }
        t={t}
      >
        <UserGroupsTable
          groups={groups}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => loadGroups(p)}
          onEdit={handleEdit}
          onManageMembers={handleManageMembers}
          onDelete={handleDelete}
          t={t}
        />
      </CardPro>
    </>
  );
};

export default UserGroupsPage;
