/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useRef } from 'react';
import { Form, Button } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const UsersFilters = ({
  formInitValues,
  setFormApi,
  searchUsers,
  loadUsers,
  activePage,
  pageSize,
  groupOptions,
  userGroupOptions = [],
  loading,
  searching,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      loadUsers(1, pageSize);
    }, 100);
  };

  const userGroupSelectOptions = userGroupOptions.map((g) => ({
    label: g.name,
    value: g.id,
  }));

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={() => {
        searchUsers(1, pageSize);
      }}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='relative w-full md:w-64'>
          <Form.Input
            field='searchKeyword'
            prefix={<IconSearch />}
            placeholder={t('搜索 ID、用户名、工号、姓名、邮箱')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-40'>
          <Form.Select
            field='searchUserGroupId'
            placeholder={t('用户组筛选')}
            optionList={userGroupSelectOptions}
            onChange={() => {
              setTimeout(() => {
                searchUsers(1, pageSize);
              }, 100);
            }}
            className='w-full'
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-36'>
          <Form.Select
            field='searchGroup'
            placeholder={t('渠道分组')}
            optionList={groupOptions}
            onChange={() => {
              setTimeout(() => {
                searchUsers(1, pageSize);
              }, 100);
            }}
            className='w-full'
            showClear
            pure
            size='small'
          />
        </div>
        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            onClick={handleReset}
            disabled={loading || searching}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default UsersFilters;
