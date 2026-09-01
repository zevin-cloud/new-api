/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';

const UserGroupsActions = ({ onAdd, t }) => {
  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        icon={<IconPlus />}
        type='primary'
        onClick={onAdd}
        size='small'
      >
        {t('新建用户组')}
      </Button>
    </div>
  );
};

export default UserGroupsActions;
