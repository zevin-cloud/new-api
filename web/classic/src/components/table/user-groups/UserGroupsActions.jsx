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
    <Button
      icon={<IconPlus />}
      theme='solid'
      type='primary'
      onClick={onAdd}
      size='small'
    >
      {t('新建用户组')}
    </Button>
  );
};

export default UserGroupsActions;
