/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  TreeSelect,
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

  const [deptTreeData, setDeptTreeData] = useState([]);
  const [selectedOrgKeys, setSelectedOrgKeys] = useState([]);
  const [fetchingTree, setFetchingTree] = useState(false);
  const [loading, setLoading] = useState(false);

  // Map of department ID -> list of user IDs (for whole dept selection)
  const [deptUserMap, setDeptUserMap] = useState({});

  const isEdit = Boolean(editingGroup);

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
            label: `${d.name} (${directDeptUsers.length} 人)`,
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

  const loadGroupMembers = async (groupId) => {
    try {
      const res = await API.get(`/api/user-group/${groupId}/members?page=1&page_size=1000`);
      if (res.data?.success) {
        const members = res.data.data.items || [];
        const userKeys = members.map((m) => `user_${m.user_id || m.id}`);
        setSelectedOrgKeys(userKeys);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (visible) {
      loadTreeAndUsers();
      if (editingGroup) {
        if (formApiRef.current) {
          formApiRef.current.setValues({
            name: editingGroup.name,
            description: editingGroup.description || '',
            status: editingGroup.status !== undefined ? editingGroup.status : 1,
          });
        }
        loadGroupMembers(editingGroup.id);
      } else {
        setSelectedOrgKeys([]);
        if (formApiRef.current) {
          formApiRef.current.setValues({
            name: '',
            description: '',
            status: 1,
          });
        }
      }
    }
  }, [visible, editingGroup]);

  const finalUserIds = useMemo(() => {
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

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      setLoading(true);

      if (editingGroup) {
        const res = await API.put(`/api/user-group/${editingGroup.id}`, {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          user_ids: finalUserIds,
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
          user_ids: finalUserIds,
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
        <div className='flex justify-between items-center bg-white p-3'>
          <Text type='secondary' className='text-xs'>
            {finalUserIds.length > 0
              ? t('已选择 {{count}} 名组成员', { count: finalUserIds.length })
              : t('未选择成员（可稍后添加）')}
          </Text>
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
      <Spin spinning={loading || fetchingTree}>
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

            {/* 组织架构选人树卡片 */}
            <Card className='!rounded-2xl shadow-sm border-0'>
              <div className='flex items-center mb-3'>
                <Avatar size='small' color='green' className='mr-2 shadow-md'>
                  <IconUser size={16} />
                </Avatar>
                <div>
                  <Text className='text-lg font-medium'>{t('成员配置（组织架构树）')}</Text>
                  <div className='text-xs text-gray-600'>
                    {t('按部门展开选择用户，或直接勾选整个部门批量加入')}
                  </div>
                </div>
              </div>

              <Row gutter={12}>
                <Col span={24}>
                  <div className='flex flex-col gap-1.5'>
                    <Text strong>{t('选择组成员')}</Text>
                    <TreeSelect
                      multiple
                      maxTagCount={4}
                      filterTreeNode
                      placeholder={t('搜索姓名、用户名、工号或按部门展开勾选...')}
                      treeData={deptTreeData}
                      value={selectedOrgKeys}
                      onChange={(v) => setSelectedOrgKeys(v)}
                      className='!rounded-lg'
                      style={{ width: '100%' }}
                      dropdownStyle={{ maxHeight: 360 }}
                    />
                    <Text type='secondary' className='text-xs'>
                      {t('可直接勾选部门批量添加该部门所有用户，也可展开部门精确勾选成员')}
                    </Text>
                  </div>
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
