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

import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const UsersActions = ({
  onAddUser,
  setShowAddUser,
  setShowImportModal,
  setShowBatchGroupModal,
  setShowColumnSelector,
  selectedRowKeys = [],
  t,
}) => {
  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        size='small'
        theme='light'
        type='primary'
        className='w-full md:w-auto'
        onClick={() => (onAddUser ? onAddUser() : setShowAddUser(true))}
      >
        {t('添加用户')}
      </Button>

      <Button
        size='small'
        type='tertiary'
        className='w-full md:w-auto'
        onClick={() => setShowImportModal(true)}
      >
        {t('批量导入')}
      </Button>

      {setShowColumnSelector && (
        <Button
          size='small'
          type='tertiary'
          className='w-full md:w-auto'
          onClick={() => setShowColumnSelector(true)}
        >
          {t('列设置')}
        </Button>
      )}

      {selectedRowKeys.length > 0 && (
        <Button
          size='small'
          theme='light'
          type='warning'
          className='w-full md:w-auto'
          onClick={() => setShowBatchGroupModal(true)}
        >
          {t('批量操作用户组 ({{count}})', { count: selectedRowKeys.length })}
        </Button>
      )}
    </div>
  );
};

export default UsersActions;
