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
import {
  Modal,
  Table,
  Button,
  TreeSelect,
  Space,
  Tag,
  Typography,
  Popconfirm,
  Spin,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';

const { Text } = Typography;

const GroupMembersModal = ({ visible, group, onClose, t }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Department tree & users
  const [deptTreeData, setDeptTreeData] = useState([]);
  const [deptUserMap, setDeptUserMap] = useState({});
  const [selectedOrgKeys, setSelectedOrgKeys] = useState([]);
  const [fetchingTree, setFetchingTree] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  useEffect(() => {
    if (visible && group) {
      loadMembers(1);
      loadTreeAndUsers();
      setSelectedOrgKeys([]);
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

  const loadTreeAndUsers = async () => {
    setFetchingTree(true);
    try {
      let rawDepts = [];
      let rawUsers = [];

      try {
        const [resDept, resUser] = await Promise.all([
          API.get('/api/department/tree'),
          API.get('/api/user/search?p=0&page_size=1000'),
        ]);

        if (resDept.data?.success) {
          rawDepts = resDept.data.data || [];
        }
        if (resUser.data?.success) {
          rawUsers = resUser.data.data?.items || resUser.data.data || [];
        }
      } catch (e) {
        // ignore
      }

      // Group users by department_id
      const usersByDept = {};
      const unassignedUsers = [];
      const deptAllUsers = {};

      rawUsers.forEach((u) => {
        const deptId = u.department_id || 0;
        if (deptId > 0) {
          if (!usersByDept[deptId]) usersByDept[deptId] = [];
          usersByDept[deptId].push(u);
        } else {
          unassignedUsers.push(u);
        }
      });

      // Recursive tree builder
      const buildOrgTree = (deptList) => {
        if (!deptList || deptList.length === 0) return { nodes: [], allUids: [] };
        const nodes = [];
        let collectedUids = [];

        deptList.forEach((d) => {
          const directDeptUsers = usersByDept[d.id] || [];
          const directUids = directDeptUsers.map((u) => u.id);

          const { nodes: subNodes, allUids: subUids } = buildOrgTree(d.children);
          const totalDeptUids = [...directUids, ...subUids];
          deptAllUsers[d.id] = totalDeptUids;
          collectedUids = [...collectedUids, ...totalDeptUids];

          const userChildren = directDeptUsers.map((u) => ({
            label: `${u.display_name || u.username} (@${u.username})${u.employee_id ? ` [${u.employee_id}]` : ''}`,
            value: `user_${u.id}`,
            key: `user_${u.id}`,
            isUser: true,
            userId: u.id,
          }));

          const allChildren = [...subNodes, ...userChildren];

          nodes.push({
            label: `${d.name} (${totalDeptUids.length} 人)`,
            value: `dept_${d.id}`,
            key: `dept_${d.id}`,
            isDept: true,
            children: allChildren.length > 0 ? allChildren : undefined,
          });
        });

        return { nodes, allUids: collectedUids };
      };

      const { nodes: tree } = buildOrgTree(rawDepts);

      if (unassignedUsers.length > 0) {
        tree.push({
          label: `${t('未分配部门')} (${unassignedUsers.length} 人)`,
          value: 'dept_unassigned',
          key: 'dept_unassigned',
          disabled: true,
          children: unassignedUsers.map((u) => ({
            label: `${u.display_name || u.username} (@${u.username})${u.employee_id ? ` [${u.employee_id}]` : ''}`,
            value: `user_${u.id}`,
            key: `user_${u.id}`,
            isUser: true,
            userId: u.id,
          })),
        });
      }

      setDeptTreeData(tree);
      setDeptUserMap(deptAllUsers);
    } finally {
      setFetchingTree(false);
    }
  };

  const finalUserIdsToAdd = useMemo(() => {
    const uidSet = new Set();
    (selectedOrgKeys || []).forEach((key) => {
      if (typeof key === 'string') {
        if (key.startsWith('user_')) {
          const uid = parseInt(key.replace('user_', ''), 10);
          if (uid > 0) uidSet.add(uid);
        } else if (key.startsWith('dept_') && key !== 'dept_unassigned') {
          const deptId = parseInt(key.replace('dept_', ''), 10);
          const uids = deptUserMap[deptId] || [];
          uids.forEach((id) => uidSet.add(id));
        }
      }
    });
    return Array.from(uidSet);
  }, [selectedOrgKeys, deptUserMap]);

  const handleAddMembers = async () => {
    if (finalUserIdsToAdd.length === 0) {
      showError(t('请先勾选要添加的用户或部门'));
      return;
    }
    setSubmittingAdd(true);
    try {
      const res = await API.post(`/api/user-group/${group.id}/members`, {
        user_ids: finalUserIdsToAdd,
      });
      if (res.data?.success) {
        showSuccess(t('添加成员成功'));
        setSelectedOrgKeys([]);
        loadMembers(1);
      } else {
        showError(res.data?.message || '添加失败');
      }
    } catch (e) {
      showError('添加失败: ' + e.message);
    } finally {
      setSubmittingAdd(false);
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
          <div className='flex-1'>
            <TreeSelect
              multiple
              maxTagCount={3}
              filterTreeNode
              loading={fetchingTree}
              placeholder={t('按部门展开选择用户，或搜索姓名/工号/用户名...')}
              treeData={deptTreeData}
              value={selectedOrgKeys}
              onChange={(v) => setSelectedOrgKeys(v)}
              className='!rounded-lg'
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 360 }}
            />
          </div>
          <Button
            theme='solid'
            type='primary'
            className='!rounded-lg whitespace-nowrap'
            icon={<IconPlus />}
            onClick={handleAddMembers}
            loading={submittingAdd}
            disabled={finalUserIdsToAdd.length === 0}
          >
            {finalUserIdsToAdd.length > 0
              ? t('添加 ({{count}} 人)', { count: finalUserIdsToAdd.length })
              : t('添加成员')}
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
