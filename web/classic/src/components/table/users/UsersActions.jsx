/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Button, Space } from '@douyinfe/semi-ui';
import { IconPlus, IconUpload, IconUserGroup } from '@douyinfe/semi-icons';

const UsersActions = ({
  setShowAddUser,
  setShowImportModal,
  setShowBatchGroupModal,
  selectedRowKeys = [],
  t,
}) => {
  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        icon={<IconPlus />}
        theme='solid'
        type='primary'
        onClick={() => setShowAddUser(true)}
        size='small'
      >
        {t('添加用户')}
      </Button>

      <Button
        icon={<IconUpload />}
        theme='light'
        type='primary'
        onClick={() => setShowImportModal(true)}
        size='small'
      >
        {t('批量导入')}
      </Button>

      {selectedRowKeys.length > 0 && (
        <Button
          icon={<IconUserGroup />}
          theme='light'
          type='warning'
          onClick={() => setShowBatchGroupModal(true)}
          size='small'
        >
          {t('批量操作用户组 ({{count}})', { count: selectedRowKeys.length })}
        </Button>
      )}
    </div>
  );
};

export default UsersActions;
