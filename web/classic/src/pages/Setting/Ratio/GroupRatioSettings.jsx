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

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  Col,
  Collapsible,
  Form,
  Radio,
  RadioGroup,
  Row,
  SideSheet,
  Spin,
  Switch,
  Tabs,
  Typography,
} from '@douyinfe/semi-ui';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import GroupTable from './components/GroupTable';
import AutoGroupList from './components/AutoGroupList';
import GroupGroupRatioRules from './components/GroupGroupRatioRules';
import GroupSpecialUsableRules from './components/GroupSpecialUsableRules';

const { Text, Title, Paragraph } = Typography;

const OPTION_KEYS = [
  'GroupRatio',
  'UserUsableGroups',
  'GroupGroupRatio',
  'group_ratio_setting.group_special_usable_group',
  'AutoGroups',
  'DefaultUseAutoGroup',
];

function parseJSONSafe(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default function GroupRatioSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState('visual');
  const [showGuide, setShowGuide] = useState(false);

  const [inputs, setInputs] = useState({
    GroupRatio: '',
    UserUsableGroups: '',
    GroupGroupRatio: '',
    'group_ratio_setting.group_special_usable_group': '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const dataVersionRef = useRef(0);

  const groupNames = useMemo(() => {
    const ratioMap = parseJSONSafe(inputs.GroupRatio, {});
    return Object.keys(ratioMap);
  }, [inputs.GroupRatio]);

  async function onSubmit() {
    if (editMode === 'manual') {
      try {
        await refForm.current.validate();
      } catch {
        showError(t('请检查输入'));
        return;
      }
    }

    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) {
      return showWarning(t('你似乎并没有修改什么'));
    }

    const requestQueue = updateArray.map((item) => {
      const value =
        typeof inputs[item.key] === 'boolean'
          ? String(inputs[item.key])
          : inputs[item.key];
      return API.put('/api/option/', { key: item.key, value });
    });

    setLoading(true);
    try {
      const res = await Promise.all(requestQueue);
      if (res.includes(undefined)) {
        return showError(
          requestQueue.length > 1
            ? t('部分保存失败，请重试')
            : t('保存失败'),
        );
      }
      for (let i = 0; i < res.length; i++) {
        if (!res[i].data.success) {
          return showError(res[i].data.message);
        }
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch (error) {
      console.error('Unexpected error:', error);
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (OPTION_KEYS.includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    dataVersionRef.current += 1;
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleGroupTableChange = useCallback(
    ({ GroupRatio, UserUsableGroups }) => {
      setInputs((prev) => ({ ...prev, GroupRatio, UserUsableGroups }));
    },
    [],
  );

  const handleAutoGroupsChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, AutoGroups: value }));
  }, []);

  const handleGroupGroupRatioChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, GroupGroupRatio: value }));
  }, []);

  const handleSpecialUsableChange = useCallback((value) => {
    setInputs((prev) => ({
      ...prev,
      'group_ratio_setting.group_special_usable_group': value,
    }));
  }, []);

  const dv = dataVersionRef.current;

  const renderVisualMode = () => (
    <Form key='form-visual' values={inputs} style={{ marginBottom: 15 }}>
      <Form.Section text={t('渠道资源池管理')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('配置上游渠道资源池及其基础结算倍率。勾选「参与服务调度」的分组将作为生产池参与模型调度服务，未启用的池（如测试、隔离池）不参与自动调度。')}
        </Text>
        <GroupTable
          key={`gt_${dv}`}
          groupRatio={inputs.GroupRatio}
          userUsableGroups={inputs.UserUsableGroups}
          onChange={handleGroupTableChange}
        />
      </Form.Section>

      <Form.Section text={t('渠道池调度优先级')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('当已授权模型跨多个可用渠道池提供时，系统按以下顺序在靠前的渠道池中优先调度可用渠道。')}
        </Text>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Form.Slot label={t('启用全局跨池自动调度')}>
              <div className='flex items-center gap-2'>
                <Switch
                  checked={!!inputs.DefaultUseAutoGroup}
                  size='default'
                  checkedText='｜'
                  uncheckedText='〇'
                  onChange={(value) =>
                    setInputs((prev) => ({
                      ...prev,
                      DefaultUseAutoGroup: value,
                    }))
                  }
                />
              </div>
              <Text type='tertiary' size='small' style={{ marginTop: 4 }}>
                {t('开启后，跨池部署的模型将自动按此优先级顺序在各渠道池中调度可用上游渠道')}
              </Text>
            </Form.Slot>
          </Col>
        </Row>
        <AutoGroupList
          key={`ag_${dv}`}
          value={inputs.AutoGroups}
          groupNames={groupNames}
          onChange={handleAutoGroupsChange}
        />
      </Form.Section>

      <Form.Section text={t('用户组特殊核算倍率')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('当指定组织用户组（如研发组、项目组）调用特定渠道池时，可设置专用核算倍率覆盖基础倍率。例如：研发组用户调用 vip 渠道池时倍率为 0.5。')}
        </Text>
        <GroupGroupRatioRules
          key={`ggr_${dv}`}
          value={inputs.GroupGroupRatio}
          groupNames={groupNames}
          onChange={handleGroupGroupRatioChange}
        />
      </Form.Section>

      <Form.Section text={t('用户组专属渠道池规则')}>
        <Text type='tertiary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('为特定组织用户组配置渠道池访问规则。「添加」开放专属渠道池，「移除」排除默认渠道池，「追加」直接追加可用渠道池。')}
        </Text>
        <GroupSpecialUsableRules
          key={`gsu_${dv}`}
          value={inputs['group_ratio_setting.group_special_usable_group']}
          groupNames={groupNames}
          onChange={handleSpecialUsableChange}
        />
      </Form.Section>
    </Form>
  );

  useEffect(() => {
    if (editMode === 'manual' && refForm.current) {
      refForm.current.setValues(inputs);
    }
  }, [editMode]);

  const renderManualMode = () => (
    <Form
      key='form-manual'
      initValues={inputs}
      getFormApi={(formAPI) => (refForm.current = formAPI)}
      style={{ marginBottom: 15 }}
    >
      <Form.Section text={t('渠道资源池与调度JSON设置')}>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('渠道资源池倍率')}
              placeholder={t('为一个 JSON 文本，键为渠道池名称，值为倍率')}
              extraText={t(
                '渠道池倍率设置，格式为 JSON 字符串，例如：{"default": 1, "vip": 0.5, "test": 1}，表示 vip 渠道池的结算倍率为 0.5',
              )}
              field={'GroupRatio'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, GroupRatio: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('参与调度渠道池')}
              placeholder={t(
                '为一个 JSON 文本，键为渠道池名称，值为渠道池描述',
              )}
              extraText={t(
                '参与生产模型调度的渠道资源池，未列出的渠道池不参与自动调度。格式为 JSON 字符串，例如：{"default": "默认生产池", "vip": "高可用专享池"}',
              )}
              field={'UserUsableGroups'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, UserUsableGroups: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('用户组特殊核算倍率')}
              placeholder={t('为一个 JSON 文本')}
              extraText={t(
                '键为用户组名称，值为映射对象，键为渠道池名称，值为核算倍率。例如：{"vip": {"default": 0.5, "test": 1}}，表示 vip 用户组在调用 default 渠道池时倍率为 0.5',
              )}
              field={'GroupGroupRatio'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, GroupGroupRatio: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('用户组专属渠道池规则')}
              placeholder={t('为一个 JSON 文本')}
              extraText={t(
                '键为用户组名称，值为操作映射对象。内层键以"+:"开头表示为该用户组开放专属渠道池，以"-:"开头表示排除默认渠道池，无前缀表示直接追加。例如：{"vip": {"+:premium": "高级渠道池", "-:default": "排除默认池"}}',
              )}
              field={'group_ratio_setting.group_special_usable_group'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => verifyJSON(value),
                  message: t('不是合法的 JSON 字符串'),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({
                  ...prev,
                  'group_ratio_setting.group_special_usable_group': value,
                }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={16}>
            <Form.TextArea
              label={t('自动分组auto，从第一个开始选择')}
              placeholder={t('为一个 JSON 文本')}
              field={'AutoGroups'}
              autosize={{ minRows: 6, maxRows: 12 }}
              trigger='blur'
              stopValidateWithError
              rules={[
                {
                  validator: (rule, value) => {
                    if (!value || value.trim() === '') return true;
                    try {
                      const parsed = JSON.parse(value);
                      if (!Array.isArray(parsed)) return false;
                      return parsed.every((item) => typeof item === 'string');
                    } catch {
                      return false;
                    }
                  },
                  message: t(
                    '必须是有效的 JSON 字符串数组，例如：["g1","g2"]',
                  ),
                },
              ]}
              onChange={(value) =>
                setInputs((prev) => ({ ...prev, AutoGroups: value }))
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Switch
              label={t(
                '创建令牌默认选择auto分组，初始令牌也将设为auto（否则留空，为用户默认分组）',
              )}
              field={'DefaultUseAutoGroup'}
              onChange={(value) =>
                setInputs((prev) => ({
                  ...prev,
                  DefaultUseAutoGroup: value,
                }))
              }
            />
          </Col>
        </Row>
      </Form.Section>
    </Form>
  );

  const GuideSection = ({ title, children }) => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ marginTop: 16 }}>
        <Button
          theme='borderless'
          size='small'
          icon={open ? <IconChevronUp /> : <IconChevronDown />}
          onClick={() => setOpen(!open)}
          style={{ padding: '4px 0', color: 'var(--semi-color-primary)' }}
        >
          {title}
        </Button>
        <Collapsible isOpen={open} keepDOM>
          <div
            style={{
              background: 'var(--semi-color-fill-0)',
              padding: '12px 16px',
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            {children}
          </div>
        </Collapsible>
      </div>
    );
  };

  const CodeBlock = ({ children }) => (
    <pre
      style={{
        background: 'var(--semi-color-bg-2)',
        border: '1px solid var(--semi-color-border)',
        padding: '10px 14px',
        borderRadius: 6,
        fontFamily: 'monospace',
        fontSize: 13,
        margin: '8px 0',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
        overflowX: 'auto',
      }}
    >
      {children}
    </pre>
  );

  const renderGuide = () => (
    <SideSheet
      title={t('渠道资源池与调度设置说明')}
      visible={showGuide}
      onCancel={() => setShowGuide(false)}
      width={560}
      bodyStyle={{ overflow: 'auto', padding: '0 24px 24px' }}
    >
      <Tabs type='line' size='small'>
        <Tabs.TabPane tab={t('概览')} itemKey='overview'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('什么是渠道资源池与调度？')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t(
                '渠道资源池是上游物理渠道的分组与归集，用于实现生产池、专享算力池和测试隔离池的物理分类。组织用户组（如研发组、项目组）是企业人员主体，两者彻底解耦。',
              )}
            </Paragraph>
            <Paragraph style={{ marginTop: 8, lineHeight: 1.8 }}>
              {t(
                '通过渠道池与调度设置，可以管理哪些渠道池作为生产可用池参与模型服务调度，以及配置跨池调度的优先级序列。',
              )}
            </Paragraph>

            <GuideSection title={t('核心概念')}>
              <Paragraph style={{ lineHeight: 1.8 }}>
                <Text strong>{t('渠道资源池')}</Text>{' — '}
                {t('后台物理渠道的分组（如 default、vip、test），用于上游连接与调度管理。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('调度倍率')}</Text>{' — '}
                {t('该渠道池的算力结算系数，用于按资源池成本核算消耗。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('参与服务调度')}</Text>{' — '}
                {t('勾选后作为生产资源池参与模型调度；未勾选的分组（如测试隔离池、备用池）不参与自动调度。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('调度优先级')}</Text>{' — '}
                {t('当模型由多个渠道池同时提供时，系统按此列表顺序择优调度。')}
              </Paragraph>
              <Paragraph style={{ lineHeight: 1.8, marginTop: 4 }}>
                <Text strong>{t('组织用户组')}</Text>{' — '}
                {t('企业内的人员组织主体，用户通过授权单获得模型权限，不受渠道池限制。')}
              </Paragraph>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('渠道池管理')} itemKey='groups'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('配置渠道资源池')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('每个渠道池代表一组特定上游渠道。管理员可以指定哪些渠道池作为生产池供模型服务调度。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 8 }}>
                {t('场景：系统配置生产默认池和专享算力池参与调度，测试池不参与调度')}
              </Paragraph>
              <CodeBlock>
                {`${t('分组名')}      ${t('倍率')}    ${t('参与服务调度')}    ${t('说明')}\n──────────────────────────────────────\ndefault   1.0     ${t('是')}            ${t('生产默认算力池')}\nvip       1.0     ${t('是')}            ${t('高可用专享算力池')}\ntest      1.0     ${t('否')}            ${t('测试隔离池，不参与调度')}`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('default 和 vip 均勾选了「参与服务调度」，当用户调用已授权模型时，系统自动在 default 和 vip 的可用渠道中按优先级调度。')}
              </Paragraph>
              <Paragraph size='small' style={{ marginTop: 10, lineHeight: 1.8 }}>
                {t('test 未勾选「参与服务调度」，其渠道仅供后台管理员测试验证，正常请求不会被分发到该池。')}
              </Paragraph>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>GroupRatio</Text>{' — '}{t('渠道池名称到倍率的映射')}
              </Paragraph>
              <CodeBlock>{`{"default": 1, "vip": 1, "test": 1}`}</CodeBlock>
              <Paragraph size='small' style={{ marginBottom: 4, marginTop: 8 }}>
                <Text strong code>UserUsableGroups</Text>{' — '}{t('参与服务调度的渠道池名称和描述')}
              </Paragraph>
              <CodeBlock>{`{"default": "${t('默认算力池')}", "vip": "${t('高可用专享池')}"}`}</CodeBlock>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('调度优先级')} itemKey='auto'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('渠道池调度优先级')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('当某个模型同时存在于多个渠道池中时，系统按列表顺序从上到下优先调度。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 6 }}>
                {t('场景：设置调度优先级顺序')}
              </Paragraph>
              <CodeBlock>
                {`1. default    ${t('最高优先级')}\n2. vip`}
              </CodeBlock>
              <Paragraph size='small' style={{ marginTop: 6, lineHeight: 1.6 }}>
                {t('当模型在 default 池中有健康可用渠道时优先走 default；若 default 渠道故障或限流，自动故障转移到 vip 池。')}
              </Paragraph>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>AutoGroups</Text>{' — '}{t('有序字符串数组')}
              </Paragraph>
              <CodeBlock>{`["default", "vip"]`}</CodeBlock>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('特殊倍率')} itemKey='ratios'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('用户组特殊核算倍率')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('当指定组织用户组调用特定渠道池时，可设置专用的核算倍率覆盖该池的基础倍率。')}
            </Paragraph>

            <GuideSection title={t('查看示例')}>
              <Paragraph size='small' type='tertiary' style={{ marginBottom: 8 }}>
                {t('场景：研发团队（用户组 dev）在调用 vip 渠道池时享受优惠核算系数 0.5')}
              </Paragraph>
              <CodeBlock>
                {`${t('用户组')}     ${t('渠道池')}    ${t('倍率')}\n────────────────────────────\ndev        vip       0.5`}
              </CodeBlock>
            </GuideSection>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>GroupGroupRatio</Text>{' — '}{t('嵌套映射：用户组 → 渠道池 → 倍率')}
              </Paragraph>
              <CodeBlock>{`{\n  "dev": {\n    "vip": 0.5\n  }\n}`}</CodeBlock>
            </GuideSection>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('专属渠道池')} itemKey='usable'>
          <div style={{ paddingTop: 20 }}>
            <Title heading={5}>{t('用户组专属渠道池规则')}</Title>
            <Paragraph style={{ marginTop: 12, lineHeight: 1.8 }}>
              {t('为特定组织用户组配置专属的渠道池访问规则，支持新增专属池或排除特定生产池。')}
            </Paragraph>

            <GuideSection title={t('JSON 格式参考')}>
              <Paragraph size='small' style={{ marginBottom: 4 }}>
                <Text strong code>group_special_usable_group</Text>
              </Paragraph>
              <CodeBlock>{`{\n  "dev": {\n    "+:internal_gpu": "${t('内部GPU专享池')}",\n    "-:default": "remove"\n  }\n}`}</CodeBlock>
              <Paragraph size='small' type='tertiary' style={{ marginTop: 6, lineHeight: 1.6 }}>
                {t('键的前缀 +: 表示为该用户组新增可用池，-: 表示排除，无前缀表示直接追加。')}
              </Paragraph>
            </GuideSection>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </SideSheet>
  );

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 15 }}>
        <div className='flex items-center gap-3' style={{ marginTop: 12, marginBottom: 16 }}>
          <RadioGroup
            type='button'
            size='small'
            value={editMode}
            onChange={(e) => setEditMode(e.target.value)}
          >
            <Radio value='visual'>{t('可视化编辑')}</Radio>
            <Radio value='manual'>{t('手动编辑')}</Radio>
          </RadioGroup>
          <Button
            icon={<IconHelpCircle />}
            theme='borderless'
            type='tertiary'
            size='small'
            onClick={() => setShowGuide(true)}
          >
            {t('使用说明')}
          </Button>
        </div>
        {editMode === 'visual' ? renderVisualMode() : renderManualMode()}
      </div>
      <Button size='default' onClick={onSubmit}>
        {t('保存渠道池与调度设置')}
      </Button>
      {renderGuide()}
    </Spin>
  );
}
