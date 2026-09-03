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
import { useTranslation } from 'react-i18next';
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
import { showError, showSuccess, timestamp2string } from '../../../../helpers';
import {
  loadGrantOptions,
  createGrantBatch,
  getGrantBatchDetail,
  updateGrantBatch,
} from '../../../../services/modelGrants';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

const CreateGrantModal = ({ visible, batchItem, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isEdit = Boolean(batchItem);

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
  const [optionsReady, setOptionsReady] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const init = async () => {
      resetForm();
      const options = await loadAllOptions(controller.signal);
      if (isEdit && batchItem) {
        try {
          const targetId =
            batchItem.batch_id ||
            batchItem.batchId ||
            batchItem.legacy_id ||
            batchItem.id;
          const isLegacy = !batchItem.batch_id || batchItem.batch_id === 0;
          const queryId = isLegacy ? `grant_${targetId}?type=legacy` : targetId;
          const detail = await getGrantBatchDetail(queryId, controller.signal);
          if (controller.signal.aborted || !detail) return;

          const orgKeys = [];
          const groupIds = [];
          (detail.subjects || []).forEach((s) => {
            if (s.type === 1) orgKeys.push(`dept_${s.id}`);
            else if (s.type === 3) orgKeys.push(`user_${s.id}`);
            else if (s.type === 2) groupIds.push(s.id);
          });
          setSelectedOrgKeys(orgKeys);
          setSelectedGroupIds(groupIds);

          const setIds = (detail.model_sets || [])
            .filter((ms) => !ms.direct_models)
            .map((ms) => ms.id);
          setSelectedModelSetIds(setIds);

          const businessModels = new Set(
            (options?.sets || [])
              .filter((s) => setIds.includes(s.id))
              .flatMap((s) => s.models || [])
          );
          const directModels = (detail.models || []).filter(
            (m) => !businessModels.has(m)
          );
          setSelectedModelNames(directModels.length > 0 ? directModels : detail.models || []);

          if (detail.expired_at && detail.expired_at > 0) {
            setExpiredTime(timestamp2string(detail.expired_at));
          } else {
            setExpiredTime(-1);
          }
        } catch {
          // ignore
        }
      }
    };
    init();
    return () => controller.abort();
  }, [visible, batchItem]);

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

  const loadAllOptions = async (signal) => {
    setFetchingData(true);
    setOptionsReady(false);
    try {
      const {
        depts: rawDepts,
        users: rawUsers,
        groups,
        sets,
        models,
      } = await loadGrantOptions(signal);
      if (signal.aborted) return;
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
        if (!deptList || deptList.length === 0) return { nodes: [], count: 0 };
        let totalCount = 0;
        const nodes = deptList.map((d) => {
          const deptUsers = usersByDept[d.id] || [];
          const userChildren = deptUsers.map((u) => ({
            label: `${u.display_name || u.username} (@${u.username})`,
            value: `user_${u.id}`,
            key: `user_${u.id}`,
            isUser: true,
            raw: u,
          }));

          const { nodes: subDeptChildren, count: subCount } = buildOrgTree(d.children);
          const allChildren = [...subDeptChildren, ...userChildren];
          const deptTotalCount = deptUsers.length + subCount;
          totalCount += deptTotalCount;

          return {
            label: `${d.name} (${t('{{count}} members', { count: deptTotalCount })})`,
            value: `dept_${d.id}`,
            key: `dept_${d.id}`,
            isDept: true,
            raw: d,
            children: allChildren.length > 0 ? allChildren : undefined,
          };
        });
        return { nodes, count: totalCount };
      };

      const { nodes: tree } = buildOrgTree(rawDepts);

      if (unassignedUsers.length > 0) {
        tree.push({
          label:
            t('No department') +
            ' (' +
            t('{{count}} members', { count: unassignedUsers.length }) +
            ')',
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

      setGroupOptions(groups.map((g) => ({ label: g.name, value: g.id })));
      setModelSets(sets);
      setAvailableModels(models.map((name) => ({ label: name, value: name })));
      setOptionsReady(true);
    } catch (error) {
      if (!signal.aborted)
        showError(error.message || t('Unable to load authorization data'));
    } finally {
      if (!signal.aborted) setFetchingData(false);
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
    if (!optionsReady || loading) return;
    if (totalSubjectCount === 0) {
      showError(t('Select at least one department, group or user.'));
      return;
    }
    if (totalResourceCount === 0) {
      showError(t('Select at least one model set or model.'));
      return;
    }

    let expiredAt = 0;
    if (expiredTime !== -1 && expiredTime) {
      const parsed = Date.parse(expiredTime);
      if (isNaN(parsed)) {
        showError(t('Invalid expiration time'));
        return;
      }
      if (parsed <= Date.now()) {
        showError(t('Expiration must be in the future'));
        return;
      }
      expiredAt = Math.ceil(parsed / 1000);
    }

    setLoading(true);
    const request = {
      department_ids: parsedDeptIds,
      group_ids: selectedGroupIds,
      user_ids: parsedUserIds,
      model_set_ids: selectedModelSetIds,
      model_names: selectedModelNames,
      custom_set_name: customSetName,
      expired_at: expiredAt,
    };

    try {
      if (isEdit) {
        await updateGrantBatch(batchItem, request);
        showSuccess(t('授权配置更新成功！'));
      } else {
        await createGrantBatch(request);
        showSuccess(t('授权创建成功！'));
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      showError(error.message || t(isEdit ? '更新授权失败' : '授权创建失败'));
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
            {t(isEdit ? 'Edit' : 'New')}
          </Tag>
          <Title heading={4} className='m-0'>
            {isEdit ? t('Edit model authorization') : t('Create model authorization')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={visible}
      width={isMobile ? '100%' : 640}
      footer={
        <div className='flex justify-between items-center bg-white dark:bg-gray-900 p-3 border-t border-gray-100 dark:border-gray-800'>
          <Text type='secondary' className='text-xs'>
            {totalSubjectCount > 0
              ? t('{{count}} subjects · {{res}} resources selected', {
                  count: totalSubjectCount,
                  res: totalResourceCount,
                })
              : t('Select subjects and model resources')}
          </Text>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={handleSubmit}
              icon={<IconSave />}
              loading={loading}
              disabled={!optionsReady}
            >
              {isEdit ? t('Save changes') : t('Grant access')}
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
                <Text className='text-lg font-medium'>{t('Subjects')}</Text>
                <div className='text-xs text-gray-600'>
                  {t(
                    'Select departments or users from the organization tree and optionally add user groups.'
                  )}
                </div>
              </div>
            </div>

            <Row gutter={12}>
              <Col span={24}>
                <div className='flex flex-col gap-1.5 mb-3'>
                  <Text strong>{t('Organization tree')}</Text>
                  <TreeSelect
                    multiple
                    checkRelation='unRelated'
                    autoMergeValue={false}
                    maxTagCount={4}
                    filterTreeNode
                    placeholder={t('Search departments or members...')}
                    treeData={deptTreeData}
                    value={selectedOrgKeys}
                    onChange={(v) => setSelectedOrgKeys(v)}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                    dropdownStyle={{ maxHeight: 360 }}
                  />
                  <Text type='secondary' className='text-xs'>
                    {t(
                      'Departments and users are selected independently. Department grants include current and future members of that department and its subdepartments.'
                    )}
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
                    placeholder={t('Select user groups (optional)...')}
                    value={selectedGroupIds}
                    onChange={(v) => setSelectedGroupIds(v)}
                    optionList={groupOptions}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                    showClear
                  />
                  <Text type='secondary' className='text-xs'>
                    {t('For project teams or roles spanning departments')}
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
                <Text className='text-lg font-medium'>
                  {t('Model resources')}
                </Text>
                <div className='text-xs text-gray-600'>
                  {t('Choose existing model sets or individual models')}
                </div>
              </div>
            </div>

            <Row gutter={12}>
              <Col span={24}>
                <div className='flex flex-col gap-1.5 mb-3'>
                  <Text strong>{t('Existing model sets')}</Text>
                  <Select
                    multiple
                    maxTagCount={4}
                    filter
                    placeholder={t('Select model sets...')}
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
                  <Text strong>{t('Individual models')}</Text>
                  <Select
                    multiple
                    maxTagCount={4}
                    filter
                    placeholder={t('Search and select models...')}
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
                    <Text strong>
                      {t('Name for selected models (optional)')}
                    </Text>
                    <Input
                      placeholder={t(
                        'For example: temporary access (leave empty for an automatic name)'
                      )}
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
                  {t('Access expires automatically at the selected time')}
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
                    onChange={(value) => {
                      setExpiredTime(value || -1);
                    }}
                    className='!rounded-lg'
                    style={{ width: '100%' }}
                  />
                </div>
              </Col>

              <Col xs={24} sm={24} md={14} lg={14}>
                <div className='flex flex-col gap-1.5'>
                  <Text strong>{t('Quick expiration')}</Text>
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
                      {t('One week')}
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
                      {t('One year')}
                    </Button>
                  </Space>
                </div>
              </Col>

              <Col span={24} className='mt-2'>
                <Text type='secondary' className='text-xs'>
                  {expiredTime === -1 || !expiredTime
                    ? t(
                        'This authorization remains valid until an administrator revokes it'
                      )
                    : t('This authorization expires at {{time}}', {
                        time: expiredTime,
                      })}
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
