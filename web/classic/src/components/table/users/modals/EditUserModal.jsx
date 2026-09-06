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

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  API,
  showError,
  showSuccess,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Form,
  Avatar,
  Row,
  Col,
  Banner,
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconSave,
  IconClose,
  IconLink,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import UserBindingManagementModal from './UserBindingManagementModal';

const { Text, Title } = Typography;

const EditUserModal = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userId = props.editingUser?.id;
  const isEdit = Boolean(userId);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const [deptTreeData, setDeptTreeData] = useState([]);
  const [bindingModalVisible, setBindingModalVisible] = useState(false);
  const formApiRef = useRef(null);
  const [inputs, setInputs] = useState(null);

  const loadDeptTree = async () => {
    try {
      const res = await API.get('/api/department/tree');
      if (res.data?.success) {
        const formatNodes = (nodes) => {
          if (!nodes || nodes.length === 0) return [];
          return nodes.map((n) => ({
            label: n.name,
            value: n.id,
            key: String(n.id),
            children: formatNodes(n.children),
          }));
        };
        setDeptTreeData(formatNodes(res.data.data));
      }
    } catch {
      // ignore
    }
  };

  const getInitValues = () => ({
    username: '',
    display_name: '',
    password: '',
    github_id: '',
    oidc_id: '',
    discord_id: '',
    wechat_id: '',
    telegram_id: '',
    linux_do_id: '',
    email: '',
    quota: 0,
    quota_amount: 0,
    group: 'default',
    department_id:
      props.defaultDeptId && Number(props.defaultDeptId) > 0
        ? Number(props.defaultDeptId)
        : undefined,
    employee_id: '',
    remark: '',
  });

  const handleCancel = () => props.handleClose();

  const loadUser = async () => {
    if (!userId) {
      setInputs(getInitValues());
      setLoading(false);
      return;
    }
    setLoading(true);
    const url = `/api/user/${userId}`;
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      data.password = '';
      if (data.department_id === 0) {
        data.department_id = undefined;
      }
      setInputs({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (inputs && formApiRef.current) {
      formApiRef.current.setValues(inputs);
    }
  }, [inputs]);

  useEffect(() => {
    loadDeptTree();
    loadUser();
    setBindingModalVisible(false);
  }, [props.editingUser?.id, props.visible]);

  const openBindingModal = () => {
    setBindingModalVisible(true);
  };

  const closeBindingModal = () => {
    setBindingModalVisible(false);
  };

  /* ----------------------- submit ----------------------- */
  const submit = async (values) => {
    setLoading(true);
    let payload = { ...values };
    delete payload.quota;
    delete payload.quota_amount;
    payload.group = payload.group || 'default';
    payload.department_id = payload.department_id ? Number(payload.department_id) : 0;
    try {
      if (isEdit) {
        payload.id = parseInt(userId);
        const res = await API.put('/api/user/', payload);
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('用户信息更新成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(message);
        }
      } else {
        const res = await API.post('/api/user/', payload);
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('用户账户创建成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(message);
        }
      }
    } catch (e) {
      showError(e.message || t('操作失败'));
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------- UI --------------------------- */
  return (
    <>
      <SideSheet
        placement='right'
        title={
          <Space>
            <Tag color={isEdit ? 'blue' : 'green'} shape='circle'>
              {t(isEdit ? '编辑' : '新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('编辑用户') : t('添加用户')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: 0 }}
        visible={props.visible}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white dark:bg-gray-900 p-3'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={handleCancel}
      >
        <Spin spinning={loading}>
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2 space-y-3'>
                <Banner
                  type='info'
                  bordered
                  className='!rounded-xl'
                  description={
                    <div>
                      <div className='font-semibold mb-0.5'>
                        {t('企业授权提示')}
                      </div>
                      <div className='text-xs text-gray-600 dark:text-gray-400'>
                        {t(
                          '企业组织成员的模型访问、渠道资源池路由与预算额度已统一在【授权管理】中按部门/人员配置，新用户默认具备零权限基线，无需在此处额外充值或单独配置复杂渠道。'
                        )}
                      </div>
                    </div>
                  }
                />

                {/* 基本信息 */}
                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconUser size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('基本信息')}
                      </Text>
                      <div className='text-xs text-gray-600 dark:text-gray-400'>
                        {isEdit ? t('编辑用户的基本账户信息') : t('创建新用户账户并分配归属组织')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='username'
                        label={t('用户名')}
                        placeholder={t('请输入用户名')}
                        rules={[{ required: true, message: t('请输入用户名') }]}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='password'
                        label={t('密码')}
                        placeholder={
                          isEdit
                            ? t('留空表示不修改密码')
                            : t('请输入密码')
                        }
                        mode='password'
                        rules={
                          isEdit
                            ? []
                            : [{ required: true, message: t('请输入密码') }]
                        }
                        showClear
                      />
                    </Col>

                    <Col span={12}>
                      <Form.Input
                        field='display_name'
                        label={t('显示名称')}
                        placeholder={t('请输入显示名称')}
                        showClear
                      />
                    </Col>

                    <Col span={12}>
                      <Form.Input
                        field='employee_id'
                        label={t('工号')}
                        placeholder={t('请输入员工工号')}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.TreeSelect
                        field='department_id'
                        label={t('所属组织架构 (部门)')}
                        placeholder={t('请选择所属组织部门（不选则属于全组织）')}
                        treeData={deptTreeData}
                        showClear
                        filterTreeNode
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='email'
                        label={t('邮箱地址')}
                        placeholder={t('请输入邮箱地址')}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='remark'
                        label={t('备注')}
                        placeholder={t('请输入备注（仅管理员可见）')}
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 权限与配额设置 - 统一引导至授权管理 */}
                {isEdit && userId && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center justify-between gap-3'>
                      <div className='flex items-center min-w-0'>
                        <Avatar
                          size='small'
                          color='green'
                          className='mr-2 shadow-md'
                        >
                          <IconUserGroup size={16} />
                        </Avatar>
                        <div className='min-w-0'>
                          <Text className='text-lg font-medium'>
                            {t('模型权限与渠道配额')}
                          </Text>
                          <div className='text-xs text-gray-600 dark:text-gray-400'>
                            {t('该用户的模型访问权限、上游物理渠道池及预算配额统一在【授权管理】中按部门或人员配置。')}
                          </div>
                        </div>
                      </div>
                      <Button
                        theme='light'
                        type='primary'
                        onClick={() => {
                          handleCancel();
                          navigate('/console/model-grant');
                        }}
                      >
                        {t('前往授权管理')}
                      </Button>
                    </div>
                  </Card>
                )}

                {/* 绑定信息入口 */}
                {userId && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center justify-between gap-3'>
                      <div className='flex items-center min-w-0'>
                        <Avatar
                          size='small'
                          color='purple'
                          className='mr-2 shadow-md'
                        >
                          <IconLink size={16} />
                        </Avatar>
                        <div className='min-w-0'>
                          <Text className='text-lg font-medium'>
                            {t('绑定信息')}
                          </Text>
                          <div className='text-xs text-gray-600'>
                            {t('管理用户已绑定的第三方账户，支持筛选与解绑')}
                          </div>
                        </div>
                      </div>
                      <Button
                        type='primary'
                        theme='outline'
                        onClick={openBindingModal}
                      >
                        {t('管理绑定')}
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>

      <UserBindingManagementModal
        visible={bindingModalVisible}
        onCancel={closeBindingModal}
        userId={userId}
        isMobile={isMobile}
        formApiRef={formApiRef}
      />
    </>
  );
};

export default EditUserModal;
