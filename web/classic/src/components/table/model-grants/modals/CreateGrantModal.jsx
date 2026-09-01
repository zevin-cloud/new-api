/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect, useMemo } from 'react';
import {
  SideSheet,
  Select,
  Input,
  DatePicker,
  Button,
  Tag,
  Typography,
  TreeSelect,
  Space,
  Spin,
  Card,
  Avatar,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconUserGroup,
  IconLayers,
  IconClock,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

const CreateGrantModal = ({ visible, onClose, onSuccess, t }) => {
  const isMobile = useIsMobile();

  // 1. Organization tree selection (Depts and Dept Users)
  const [deptTreeData, setDeptTreeData] = useState([]);
  const [selectedOrgKeys, setSelectedOrgKeys] = useState([]);

  // 2. User groups selection
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);

  // 3. Resource selections
  const [modelSets, setModelSets] = useState([]);
  const [selectedModelSetIds, setSelectedModelSetIds] = useState([]);

  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModelNames, setSelectedModelNames] = useState([]);
  const [customSetName, setCustomSetName] = useState('');

  // 4. Expiration time (DateTime string or -1 for never)
  const [expiredTime, setExpiredTime] = useState(-1);

  // Status
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAllOptions();
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setSelectedOrgKeys([]);
    setSelectedGroupIds([]);
    setSelectedModelSetIds([]);
    setSelectedModelNames([]);
    setCustomSetName('');
    setExpiredTime(-1);
  };

  const handleQuickExpire = (days, months = 0, years = 0) => {
    if (days === 0 && months === 0 && years === 0) {
      setExpiredTime(-1);
      return;
    }
    const now = new Date();
    if (years > 0) {
      now.setFullYear(now.getFullYear() + years);
    } else if (months > 0) {
      now.setMonth(now.getMonth() + months);
    } else if (days > 0) {
      now.setDate(now.getDate() + days);
    }
    setExpiredTime(timestamp2string(Math.ceil(now.getTime() / 1000)));
  };

  const loadAllOptions = async () => {
    setFetchingData(true);
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

      rawUsers.forEach((u) => {
        const deptId = u.department_id || 0;
        if (deptId > 0) {
          if (!usersByDept[deptId]) usersByDept[deptId] = [];
          usersByDept[deptId].push(u);
        } else {
          unassignedUsers.push(u);
        }
      });

      // Build recursive tree with depts as branch nodes and users as leaf nodes
      const buildOrgTree = (deptList) => {
        if (!deptList || deptList.length === 0) return [];
        return deptList.map((d) => {
          const deptUsers = usersByDept[d.id] || [];
          const userChildren = deptUsers.map((u) => ({
            label: `${u.display_name || u.username} (@${u.username})`,
            value: `user_${u.id}`,
            key: `user_${u.id}`,
            isUser: true,
            raw: u,
          }));

          const subDeptChildren = buildOrgTree(d.children);
          const allChildren = [...subDeptChildren, ...userChildren];

          return {
            label: `${d.name} (${deptUsers.length} 人)`,
            value: `dept_${d.id}`,
            key: `dept_${d.id}`,
            isDept: true,
            raw: d,
            children: allChildren.length > 0 ? allChildren : undefined,
          };
        });
      };

      const tree = buildOrgTree(rawDepts);

      if (unassignedUsers.length > 0) {
        tree.push({
          label: `${t('未分配部门')} (${unassignedUsers.length} 人)`,
          value: 'dept_unassigned',
          key: 'dept_unassigned',
          disabled: true,
          children: unassignedUsers.map((u) => ({
            label: `${u.display_name || u.username} (@${u.username})`,
            value: `user_${u.id}`,
            key: `user_${u.id}`,
            isUser: true,
            raw: u,
          })),
        });
      }

      setDeptTreeData(tree);

      // 2. Load UserGroups
      try {
        const resGroup = await API.get('/api/user-group?page=1&page_size=300');
        if (resGroup.data?.success) {
          setGroupOptions(
            (resGroup.data.data.items || []).map((g) => ({
              label: `${g.name} (${g.member_count || 0} 成员)`,
              value: g.id,
            }))
          );
        }
      } catch (e) {}

      // 3. Load ModelSets
      try {
        const resSets = await API.get('/api/model-set?page=1&page_size=300');
        if (resSets.data?.success) {
          setModelSets(resSets.data.data.items || []);
        }
      } catch (e) {}

      // 4. Load Available Models
      try {
        const modelNameSet = new Set();
        const resEnabled = await API.get('/api/channel/models_enabled');
        if (resEnabled.data?.success && Array.isArray(resEnabled.data.data)) {
          resEnabled.data.data.forEach((m) => {
            if (typeof m === 'string' && m) modelNameSet.add(m);
          });
        }
        const resPricing = await API.get('/api/pricing');
        if (resPricing.data?.success && Array.isArray(resPricing.data?.data)) {
          resPricing.data.data.forEach((m) => {
            const name = typeof m === 'string' ? m : m.model_name || m.id || m.name;
            if (name) modelNameSet.add(name);
          });
        }
        setAvailableModels(
          Array.from(modelNameSet).map((m) => ({
            label: m,
            value: m,
          }))
        );
      } catch (e) {}
    } finally {
      setFetchingData(false);
    }
  };

  const { parsedDeptIds, parsedUserIds } = useMemo(() => {
    const deptIds = [];
    const userIds = [];
    (selectedOrgKeys || []).forEach((key) => {
      if (typeof key === 'string') {
        if (key.startsWith('dept_') && key !== 'dept_unassigned') {
          const id = parseInt(key.replace('dept_', ''), 10);
          if (id > 0) deptIds.push(id);
        } else if (key.startsWith('user_')) {
          const id = parseInt(key.replace('user_', ''), 10);
          if (id > 0) userIds.push(id);
        }
      }
    });
    return { parsedDeptIds: deptIds, parsedUserIds: userIds };
  }, [selectedOrgKeys]);

  const totalSubjectCount =
    parsedDeptIds.length + parsedUserIds.length + selectedGroupIds.length;
  const totalResourceCount =
    selectedModelSetIds.length + selectedModelNames.length;

  const handleSubmit = async () => {
    if (totalSubjectCount === 0) {
      showError(t('请选择至少一个授权主体（从组织架构树选择部门/用户，或选择用户组）'));
      return;
    }
    if (totalResourceCount === 0) {
      showError(t('请选择至少一个模型集或具体模型'));
      return;
    }

    let expiredAt = 0;
    if (expiredTime !== -1 && expiredTime) {
      const parsed = Date.parse(expiredTime);
      if (isNaN(parsed)) {
        showError(t('过期时间格式错误'));
        return;
      }
      if (parsed <= Date.now()) {
        showError(t('过期时间不能早于当前时间'));
        return;
      }
      expiredAt = Math.ceil(parsed / 1000);
    }

    setLoading(true);
    try {
      const res = await API.post('/api/model-grant', {
        department_ids: parsedDeptIds,
        group_ids: selectedGroupIds,
        user_ids: parsedUserIds,
        model_set_ids: selectedModelSetIds,
        model_names: selectedModelNames,
        custom_set_name: customSetName,
        expired_at: expiredAt,
      });

      if (res.data?.success) {
        showSuccess(t('模型授权创建成功'));
        onSuccess && onSuccess();
        onClose();
      } else {
        showError(res.data?.message || '授权失败');
      }
    } catch (e) {
      showError('授权失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideSheet
      placement='right'
      title={
        <Space>
          <Tag color='green' shape='circle'>
            {t('新建')}
          </Tag>
          <Title heading={4} className='m-0'>
            {t('新建模型权限授权')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={visible}
      width={isMobile ? '100%' : 640}
      footer={
        <div className='flex justify-between items-center bg-white p-3'>
          <Text type='secondary' className='text-xs'>
            {totalSubjectCount > 0
              ? t('已选 {{count}} 个主体 · {{res}} 项资源', {
                  count: totalSubjectCount,
                  res: totalResourceCount,
                })
              : t('请选择主体与模型资源')}
          </Text>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={handleSubmit}
              icon={<IconSave />}
              loading={loading}
            >
              {t('确认授权')}
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
      <Spin spinning={fetchingData}>
        <div className='p-2 space-y-3'>
          {/* 1. 授权主体卡片 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-3'>
              <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                <IconUserGroup size={16} />
              </Avatar>
              <div>
                <Text className='text-lg font-medium'>{t('授权主体')}</Text>
                <div className='text-xs text-gray-600'>
                  {t('从组织架构树选择部门或成员，并可组合用户组并集授权')}
                </div>
              </div>
            </div>

            <Row gutter={12}>
              <Col span={24}>
                <div className='flex flex-col gap-1.5 mb-3'>
                  <Text strong>{t('组织架构树')}</Text>
                  <TreeSelect
                    multiple
                    maxTagCount={4}
                    filterTreeNode
                    placeholder={t('搜索并勾选部门或部门成员...')}
                    treeData={deptTreeData}
                    value={selectedOrgKeys}
                    onChange={(v) => setSelectedOrgKeys(v)}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                    dropdownStyle={{ maxHeight: 360 }}
                  />
                  <Text type='secondary' className='text-xs'>
                    {t('直接勾选部门可自动继承全部门，展开部门可单选个人成员')}
                  </Text>
                </div>
              </Col>

              <Col span={24}>
                <div className='flex flex-col gap-1.5'>
                  <Text strong>{t('用户组')}</Text>
                  <Select
                    multiple
                    maxTagCount={4}
                    filter
                    placeholder={t('选择用户组 (可选)...')}
                    value={selectedGroupIds}
                    onChange={(v) => setSelectedGroupIds(v)}
                    optionList={groupOptions}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                    showClear
                  />
                  <Text type='secondary' className='text-xs'>
                    {t('适用于跨部门的项目组或业务角色组')}
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>

          {/* 2. 授权模型资源卡片 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-3'>
              <Avatar size='small' color='purple' className='mr-2 shadow-md'>
                <IconLayers size={16} />
              </Avatar>
              <div>
                <Text className='text-lg font-medium'>{t('授权模型资源')}</Text>
                <div className='text-xs text-gray-600'>
                  {t('选择已有模型集或勾选具体模型')}
                </div>
              </div>
            </div>

            <Row gutter={12}>
              <Col span={24}>
                <div className='flex flex-col gap-1.5 mb-3'>
                  <Text strong>{t('选择已有模型集')}</Text>
                  <Select
                    multiple
                    maxTagCount={4}
                    filter
                    placeholder={t('选择模型集 (支持多选)...')}
                    value={selectedModelSetIds}
                    onChange={(v) => setSelectedModelSetIds(v)}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                    showClear
                  >
                    {modelSets.map((s) => (
                      <Select.Option key={s.id} value={s.id}>
                        <div className='flex justify-between items-center w-full'>
                          <span>{s.name}</span>
                          <Tag size='small' color='blue'>
                            {s.models?.length || s.model_count || 0} {t('模型')}
                          </Tag>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              </Col>

              <Col span={24}>
                <div className='flex flex-col gap-1.5 mb-3'>
                  <Text strong>{t('直接勾选具体模型')}</Text>
                  <Select
                    multiple
                    maxTagCount={4}
                    filter
                    placeholder={t('搜索并勾选具体模型 (如 gpt-4o, claude-3-5-sonnet)...')}
                    value={selectedModelNames}
                    onChange={(v) => setSelectedModelNames(v)}
                    optionList={availableModels}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                    showClear
                  />
                </div>
              </Col>

              {selectedModelNames.length > 0 && (
                <Col span={24}>
                  <div className='flex flex-col gap-1.5'>
                    <Text strong>{t('直接勾选模型的归集名称 (选填)')}</Text>
                    <Input
                      placeholder={t('例如：临时高阶模型授权 (留空则系统自动命名)')}
                      value={customSetName}
                      onChange={(v) => setCustomSetName(v)}
                      className='!rounded-lg'
                      showClear
                    />
                  </div>
                </Col>
              )}
            </Row>
          </Card>

          {/* 3. 过期时间卡片 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-3'>
              <Avatar size='small' color='green' className='mr-2 shadow-md'>
                <IconClock size={16} />
              </Avatar>
              <div>
                <Text className='text-lg font-medium'>{t('有效期设置')}</Text>
                <div className='text-xs text-gray-600'>
                  {t('设定授权的过期时间，到期自动失效')}
                </div>
              </div>
            </div>

            <Row gutter={12} align='middle'>
              <Col xs={24} sm={24} md={10} lg={10}>
                <div className='flex flex-col gap-1.5'>
                  <Text strong>{t('过期时间')}</Text>
                  <DatePicker
                    type='dateTime'
                    placeholder={t('请选择过期时间')}
                    value={expiredTime === -1 ? '' : expiredTime}
                    onChange={(date, dateString) => {
                      setExpiredTime(dateString || -1);
                    }}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                  />
                </div>
              </Col>

              <Col xs={24} sm={24} md={14} lg={14}>
                <div className='flex flex-col gap-1.5'>
                  <Text strong>{t('快捷时效设置')}</Text>
                  <Space wrap>
                    <Button
                      theme={expiredTime === -1 ? 'solid' : 'light'}
                      type={expiredTime === -1 ? 'primary' : 'tertiary'}
                      size='small'
                      className='!rounded-lg'
                      onClick={() => handleQuickExpire(0, 0, 0)}
                    >
                      {t('永不过期')}
                    </Button>
                    <Button
                      theme='light'
                      type='tertiary'
                      size='small'
                      className='!rounded-lg'
                      onClick={() => handleQuickExpire(1, 0, 0)}
                    >
                      {t('一天')}
                    </Button>
                    <Button
                      theme='light'
                      type='tertiary'
                      size='small'
                      className='!rounded-lg'
                      onClick={() => handleQuickExpire(7, 0, 0)}
                    >
                      {t('一周')}
                    </Button>
                    <Button
                      theme='light'
                      type='tertiary'
                      size='small'
                      className='!rounded-lg'
                      onClick={() => handleQuickExpire(0, 1, 0)}
                    >
                      {t('一个月')}
                    </Button>
                    <Button
                      theme='light'
                      type='tertiary'
                      size='small'
                      className='!rounded-lg'
                      onClick={() => handleQuickExpire(0, 0, 1)}
                    >
                      {t('一年')}
                    </Button>
                  </Space>
                </div>
              </Col>

              <Col span={24} className='mt-2'>
                <Text type='secondary' className='text-xs'>
                  {expiredTime === -1 || !expiredTime
                    ? t('此授权将永久有效，直到管理员手动撤销')
                    : t('此授权将于 {{time}} 到期并自动失效', { time: expiredTime })}
                </Text>
              </Col>
            </Row>
          </Card>
        </div>
      </Spin>
    </SideSheet>
  );
};

export default CreateGrantModal;
