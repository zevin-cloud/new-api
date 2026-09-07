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
  RadioGroup,
  Radio,
  InputNumber,
  Checkbox,
  Collapse,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconUserGroup,
  IconLayers,
  IconClock,
  IconServer,
  IconEdit,
  IconSetting,
  IconChevronDown,
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

  // 0. Grant basic info
  const [name, setName] = useState('');

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

  // 4. QoS and multi-metric quotas
  const [quotaType, setQuotaType] = useState(0);
  const [quotaScope, setQuotaScope] = useState(0);
  const [enableQuota, setEnableQuota] = useState(true);
  const [grantQuota, setGrantQuota] = useState(500000);
  const [enableTokens, setEnableTokens] = useState(false);
  const [grantTokens, setGrantTokens] = useState(0);
  const [enableCalls, setEnableCalls] = useState(false);
  const [grantCalls, setGrantCalls] = useState(0);
  const [periodType, setPeriodType] = useState(0);
  const [periodInterval, setPeriodInterval] = useState(1);
  const [periodUnit, setPeriodUnit] = useState('day');
  const [maxConcurrency, setMaxConcurrency] = useState(0);

  // Advanced settings drawer toggle
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  // 5. Expiration time (DateTime string or -1 for never)
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
              .flatMap((s) => s.models || []),
          );
          const directModels = (detail.models || []).filter(
            (m) => !businessModels.has(m),
          );
          setSelectedModelNames(
            directModels.length > 0 ? directModels : detail.models || [],
          );

          if (detail.expired_at && detail.expired_at > 0) {
            setExpiredTime(timestamp2string(detail.expired_at));
          } else {
            setExpiredTime(-1);
          }

          setName(detail.name || batchItem?.name || '');
          setQuotaType(detail.quota_type ?? 0);
          setQuotaScope(detail.quota_scope ?? 0);
          const quota = detail.grant_quota ?? 0;
          const tokens = detail.grant_tokens ?? 0;
          const calls = detail.grant_calls ?? 0;
          setGrantQuota(quota > 0 ? quota : 500000);
          setEnableQuota(
            quota > 0 ||
              (detail.quota_type === 1 && tokens === 0 && calls === 0),
          );
          setGrantTokens(tokens);
          setEnableTokens(tokens > 0);
          setGrantCalls(calls);
          setEnableCalls(calls > 0);
          setPeriodType(detail.period_type ?? 0);
          setPeriodInterval(detail.period_interval || 1);
          setPeriodUnit(detail.period_unit || 'day');
          setMaxConcurrency(detail.max_concurrency ?? 0);
        } catch {
          // ignore
        }
      }
    };
    init();
    return () => controller.abort();
  }, [visible, batchItem]);

  const resetForm = () => {
    setName('');
    setSelectedOrgKeys([]);
    setSelectedGroupIds([]);
    setSelectedModelSetIds([]);
    setSelectedModelNames([]);
    setCustomSetName('');
    setExpiredTime(-1);
    setQuotaType(0);
    setQuotaScope(0);
    setEnableQuota(true);
    setGrantQuota(500000);
    setEnableTokens(false);
    setGrantTokens(0);
    setEnableCalls(false);
    setGrantCalls(0);
    setPeriodType(0);
    setPeriodInterval(1);
    setPeriodUnit('day');
    setMaxConcurrency(0);
    setAdvancedSettingsOpen(false);
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
        channelGroups,
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

          const { nodes: subDeptChildren, count: subCount } = buildOrgTree(
            d.children,
          );
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

    if (quotaType === 1 && !enableQuota && !enableTokens && !enableCalls) {
      showError(
        t(
          '启用配额限制时，请至少选择一个限制维度（价值金额、Token 数量或调用次数）',
        ),
      );
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
      name: name.trim(),
      department_ids: parsedDeptIds,
      group_ids: selectedGroupIds,
      user_ids: parsedUserIds,
      model_set_ids: selectedModelSetIds,
      model_names: selectedModelNames,
      custom_set_name: customSetName,
      expired_at: expiredAt,
      quota_type: quotaType,
      quota_scope: quotaType === 1 ? quotaScope : 0,
      grant_quota: quotaType === 1 && enableQuota ? Number(grantQuota) || 0 : 0,
      grant_tokens:
        quotaType === 1 && enableTokens ? Number(grantTokens) || 0 : 0,
      grant_calls: quotaType === 1 && enableCalls ? Number(grantCalls) || 0 : 0,
      period_type: periodType,
      period_interval:
        periodType === 3
          ? Number(periodInterval) || 1
          : periodType === 1 || periodType === 2
            ? 1
            : 0,
      period_unit:
        periodType === 3
          ? periodUnit
          : periodType === 1
            ? 'day'
            : periodType === 2
              ? 'month'
              : '',
      max_concurrency: Number(maxConcurrency) || 0,
    };

    try {
      if (isEdit) {
        await updateGrantBatch(batchItem, request);
        showSuccess(t('授权配置更新成功！'));
      } else {
        await createGrantBatch(request);
        showSuccess(t('授权创建成功！'));
      }
      setAdvancedSettingsOpen(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      showError(error.message || t(isEdit ? '更新授权失败' : '授权创建失败'));
    } finally {
      setLoading(false);
    }
  };

  const advancedSettingsContent = (
    <div className='space-y-4'>
      {/* 1. 多维配额与额度模式 */}
      <div>
        <Text strong className='block mb-1.5'>
          {t('预算额度模式')}
        </Text>
        <RadioGroup
          value={quotaType}
          onChange={(e) => setQuotaType(e.target.value)}
          type='button'
          className='mb-2'
        >
          <Radio value={0}>{t('免充值不限配额')}</Radio>
          <Radio value={1}>{t('启用多维配额限制')}</Radio>
        </RadioGroup>
        <Text type='secondary' className='text-xs block'>
          {quotaType === 0
            ? t(
                '企业免充值模式：直接放行模型调用，不设配额上限，便于全员公共算力赋能。',
              )
            : t(
                '配额限制模式：可按价值金额、Token数量或调用次数灵活约束，任一指标耗尽即熔断。',
              )}
        </Text>
      </div>

      {quotaType === 1 && (
        <div className='p-3 bg-[var(--semi-color-fill-0)] rounded-xl space-y-3 border border-[var(--semi-color-border)]'>
          <div>
            <div className='flex items-center justify-between mb-1'>
              <Text strong className='text-sm'>
                {t('配额限制维度')}
              </Text>
              <Text type='tertiary' className='text-xs'>
                {t('支持多选组合，任意指标达到上限即暂停调用')}
              </Text>
            </div>
          </div>

          {/* 维度1：价值金额配额 */}
          <div className='p-2.5 bg-[var(--semi-color-bg-0)] rounded-lg border border-[var(--semi-color-border)] space-y-2'>
            <div className='flex items-center justify-between'>
              <Checkbox
                checked={enableQuota}
                onChange={(e) => setEnableQuota(e.target.checked)}
              >
                <span className='font-medium text-sm'>
                  {t('价值金额限制 (Token 点数)')}
                </span>
              </Checkbox>
              {enableQuota && (
                <Tag size='small' color='blue'>
                  {t('折算约 ${{amount}}', {
                    amount: ((grantQuota || 0) / 500000).toFixed(2),
                  })}
                </Tag>
              )}
            </div>
            {enableQuota && (
              <div className='pl-6 space-y-1'>
                <InputNumber
                  value={grantQuota}
                  onChange={(v) => setGrantQuota(v)}
                  min={0}
                  step={100000}
                  className='!rounded-lg'
                  style={{ width: '100%' }}
                  placeholder={t('例如 500000 点 (等值 $1)')}
                />
                <Text type='secondary' className='text-xs block'>
                  {t('标准算力点数。默认 500,000 点基准等值 $1 美元。')}
                </Text>
              </div>
            )}
          </div>

          {/* 维度2：Token 数量限制 */}
          <div className='p-2.5 bg-[var(--semi-color-bg-0)] rounded-lg border border-[var(--semi-color-border)] space-y-2'>
            <div className='flex items-center justify-between'>
              <Checkbox
                checked={enableTokens}
                onChange={(e) => setEnableTokens(e.target.checked)}
              >
                <span className='font-medium text-sm'>
                  {t('Token 数量限制 (Tokens)')}
                </span>
              </Checkbox>
              {enableTokens && grantTokens > 0 && (
                <Tag size='small' color='cyan'>
                  {t('{{count}}k Tokens', {
                    count: (grantTokens / 1000).toFixed(0),
                  })}
                </Tag>
              )}
            </div>
            {enableTokens && (
              <div className='pl-6 space-y-1'>
                <InputNumber
                  value={grantTokens}
                  onChange={(v) => setGrantTokens(v)}
                  min={0}
                  step={10000}
                  className='!rounded-lg'
                  style={{ width: '100%' }}
                  placeholder={t('例如 1000000 Tokens (1M)')}
                />
                <Text type='secondary' className='text-xs block'>
                  {t('按实际 Prompt + Completion 的 Token 消耗总量限制。')}
                </Text>
              </div>
            )}
          </div>

          {/* 维度3：调用次数限制 */}
          <div className='p-2.5 bg-[var(--semi-color-bg-0)] rounded-lg border border-[var(--semi-color-border)] space-y-2'>
            <div className='flex items-center justify-between'>
              <Checkbox
                checked={enableCalls}
                onChange={(e) => setEnableCalls(e.target.checked)}
              >
                <span className='font-medium text-sm'>
                  {t('调用次数限制 (API 请求数)')}
                </span>
              </Checkbox>
              {enableCalls && grantCalls > 0 && (
                <Tag size='small' color='purple'>
                  {t('{{count}} 次', { count: grantCalls })}
                </Tag>
              )}
            </div>
            {enableCalls && (
              <div className='pl-6 space-y-1'>
                <InputNumber
                  value={grantCalls}
                  onChange={(v) => setGrantCalls(v)}
                  min={0}
                  step={100}
                  className='!rounded-lg'
                  style={{ width: '100%' }}
                  placeholder={t('例如 1000 次')}
                />
                <Text type='secondary' className='text-xs block'>
                  {t('限制该授权策略下的 API 调用请求总次数。')}
                </Text>
              </div>
            )}
          </div>

          {/* 额度分配模式 */}
          <div className='pt-1'>
            <Text strong className='block mb-1.5'>
              {t('额度分配模式')}
            </Text>
            <RadioGroup
              value={quotaScope}
              onChange={(e) => setQuotaScope(e.target.value)}
              type='button'
              className='mb-1.5'
            >
              <Radio value={0}>{t('团队共享总额度')}</Radio>
              <Radio value={1}>{t('成员独立额度上限')}</Radio>
            </RadioGroup>
            <Text type='secondary' className='text-xs block'>
              {quotaScope === 0
                ? t(
                    '团队共享：所有选中的主体共用该额度池，适合项目组公共预算。',
                  )
                : t('成员独立：为每个成员分配独立上限，每人享有完整额度。')}
            </Text>
          </div>
        </div>
      )}

      {/* 2. 生效周期与重置策略 */}
      <div className='p-3 bg-[var(--semi-color-fill-0)] rounded-xl space-y-3 border border-[var(--semi-color-border)]'>
        <div>
          <Text strong className='block mb-1'>
            {t('生效周期与重置规则')}
          </Text>
          <Text type='tertiary' className='text-xs block mb-2'>
            {t('周期到达时将自动刷新重置已消耗量，开启新一轮配额')}
          </Text>
          <RadioGroup
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value)}
            type='button'
            className='mb-2'
          >
            <Radio value={0}>{t('一次性 (耗尽即止)')}</Radio>
            <Radio value={1}>{t('每天自动重置')}</Radio>
            <Radio value={2}>{t('每月 1 日重置')}</Radio>
            <Radio value={3}>{t('自定义周期')}</Radio>
          </RadioGroup>
        </div>

        {periodType === 3 && (
          <div className='p-2.5 bg-[var(--semi-color-bg-0)] rounded-lg border border-[var(--semi-color-border)] space-y-2'>
            <Text strong className='text-xs'>
              {t('自定义重置周期步长')}
            </Text>
            <Row gutter={8} align='middle'>
              <Col span={13}>
                <InputNumber
                  value={periodInterval}
                  onChange={(v) => setPeriodInterval(v)}
                  min={1}
                  step={1}
                  prefix={t('每')}
                  className='!rounded-lg'
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={11}>
                <Select
                  value={periodUnit}
                  onChange={(v) => setPeriodUnit(v)}
                  className='!rounded-lg'
                  style={{ width: '100%' }}
                >
                  <Select.Option value='hour'>{t('小时')}</Select.Option>
                  <Select.Option value='day'>{t('天')}</Select.Option>
                  <Select.Option value='week'>{t('周')}</Select.Option>
                  <Select.Option value='month'>{t('月')}</Select.Option>
                </Select>
              </Col>
            </Row>
            <Text type='secondary' className='text-xs block'>
              {t('例如：每 2 周、每 12 小时、每 3 个月自动重置一次已用量。')}
            </Text>
          </div>
        )}

        <Text type='secondary' className='text-xs block'>
          {periodType === 0 &&
            t(
              '单次生效，额度或次数消耗完毕后授权将暂停，直到管理员追加额度或重置。',
            )}
          {periodType === 1 &&
            t('每日 00:00 自动将已消耗金额、Token 及调用次数清零。')}
          {periodType === 2 &&
            t('自然月每月 1 日 00:00 自动将已消耗用量清零。')}
          {periodType === 3 && t('按设定的自定义时间步长循环重置已用量。')}
        </Text>
      </div>

      {/* 3. QoS 并发限制 */}
      <div className='p-3 bg-[var(--semi-color-fill-0)] rounded-xl space-y-2 border border-[var(--semi-color-border)]'>
        <Text strong className='block'>
          {t('最大并发限制')}
        </Text>
        <InputNumber
          value={maxConcurrency}
          onChange={(v) => setMaxConcurrency(v)}
          min={0}
          step={1}
          className='!rounded-lg'
          style={{ width: '100%' }}
          placeholder={t('0 表示无限制')}
        />
        <Text type='secondary' className='text-xs block'>
          {t('限制该授权策略下的同时在飞请求数。设置为 0 表示不单独限制并发。')}
        </Text>
      </div>
    </div>
  );

  const handleClose = () => {
    setAdvancedSettingsOpen(false);
    onClose();
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
            {isEdit
              ? t('Edit model authorization')
              : t('Create model authorization')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={visible}
      width={isMobile ? '100%' : 640}
      footer={
        <div className='flex justify-between items-center bg-[var(--semi-color-bg-0)] p-3 border-t border-[var(--semi-color-border)]'>
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
              onClick={handleClose}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={handleClose}
    >
      <Spin spinning={fetchingData}>
        <div className='p-2 space-y-3'>
          {/* 0. 基本信息卡片 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-3'>
              <Avatar size='small' color='teal' className='mr-2 shadow-md'>
                <IconEdit size={16} />
              </Avatar>
              <div>
                <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                <div className='text-xs text-[var(--semi-color-text-2)]'>
                  {t(
                    '设置本次授权的业务标识名称，方便后续检索、审计与权限对账。',
                  )}
                </div>
              </div>
            </div>

            <Row gutter={12}>
              <Col span={24}>
                <div className='flex flex-col gap-1.5'>
                  <Text strong>{t('授权名称')}</Text>
                  <Input
                    placeholder={t(
                      '请输入授权名称（选填，如：市场部营销文案生成授权）',
                    )}
                    value={name}
                    onChange={(v) => setName(v)}
                    maxLength={128}
                    showClear
                    className='!rounded-lg'
                  />
                </div>
              </Col>
            </Row>
          </Card>

          {/* 1. 授权主体卡片 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-3'>
              <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                <IconUserGroup size={16} />
              </Avatar>
              <div>
                <Text className='text-lg font-medium'>{t('Subjects')}</Text>
                <div className='text-xs text-[var(--semi-color-text-2)]'>
                  {t(
                    'Select departments or users from the organization tree and optionally add user groups.',
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
                    maxTagCount={4}
                    filterTreeNode
                    showClear
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
                      'Departments and users are selected independently. Department grants include current and future members of that department and its subdepartments.',
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
                        'For example: temporary access (leave empty for an automatic name)',
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
                        'This authorization remains valid until an administrator revokes it',
                      )
                    : t('This authorization expires at {{time}}', {
                        time: expiredTime,
                      })}
                </Text>
              </Col>
            </Row>
          </Card>

          {/* 4. 高级设置入口：移动端手风琴折叠，桌面端向左滑出副抽屉 */}
          {isMobile ? (
            <Collapse
              activeKey={advancedSettingsOpen ? ['advanced'] : []}
              onChange={(keys) =>
                setAdvancedSettingsOpen(keys.includes('advanced'))
              }
              className='!border-0 !shadow-sm !rounded-2xl bg-[var(--semi-color-bg-0)] overflow-hidden'
            >
              <Collapse.Panel
                header={
                  <div className='flex items-center gap-2'>
                    <IconSetting size={16} />
                    <Text className='font-medium'>{t('高级设置')}</Text>
                  </div>
                }
                itemKey='advanced'
              >
                {advancedSettingsContent}
              </Collapse.Panel>
            </Collapse>
          ) : (
            <div
              className='flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors hover:bg-[var(--semi-color-fill-1)]'
              style={{
                backgroundColor: advancedSettingsOpen
                  ? 'var(--semi-color-primary-light-default)'
                  : 'var(--semi-color-fill-0)',
                border: '1px solid var(--semi-color-fill-2)',
              }}
              onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)}
            >
              <div className='flex items-center gap-2'>
                <IconSetting size={16} />
                <Text className='font-medium'>{t('高级设置')}</Text>
              </div>
              <div
                className='flex items-center gap-1 text-sm'
                style={{ color: 'var(--semi-color-primary)' }}
              >
                <Text
                  size='small'
                  style={{ color: 'var(--semi-color-primary)' }}
                >
                  {advancedSettingsOpen ? t('收起') : t('向左展开')}
                </Text>
                <IconChevronDown
                  size={14}
                  style={{
                    transform: advancedSettingsOpen
                      ? 'rotate(180deg)'
                      : 'rotate(90deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Spin>

      {/* Desktop: Advanced Settings Side Panel (Side-by-Side Drawer) */}
      {!isMobile && advancedSettingsOpen && (
        <div
          className='fixed top-0 h-full overflow-y-auto z-[999] semi-sidesheet-inner'
          style={{
            width: 600,
            right: 640,
            backgroundColor: 'var(--semi-color-bg-0)',
            borderRight: '1px solid var(--semi-color-border)',
            boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.08)',
            animation: 'slideInLeft 0.3s ease-out',
          }}
        >
          <div className='semi-sidesheet-header'>
            <div className='semi-sidesheet-title'>
              <Space>
                <Tag color='cyan' shape='circle'>
                  {t('高级')}
                </Tag>
                <Title heading={4} className='m-0'>
                  {t('高级设置')}
                </Title>
              </Space>
            </div>
            <Button
              className='semi-sidesheet-close'
              type='tertiary'
              theme='borderless'
              icon={<IconClose />}
              size='small'
              onClick={() => setAdvancedSettingsOpen(false)}
            />
          </div>
          <div className='semi-sidesheet-body' style={{ padding: 0 }}>
            <div className='p-2 space-y-3'>
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-4'>
                  <Avatar
                    size='small'
                    color='orange'
                    className='mr-2 shadow-md'
                  >
                    <IconSetting size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('高级设置')}</Text>
                    <div className='text-xs text-[var(--semi-color-text-2)]'>
                      {t('授权的高级配额、生效周期与流控规则')}
                    </div>
                  </div>
                </div>
                {advancedSettingsContent}
              </Card>
            </div>
          </div>
        </div>
      )}
    </SideSheet>
  );
};

export default CreateGrantModal;
