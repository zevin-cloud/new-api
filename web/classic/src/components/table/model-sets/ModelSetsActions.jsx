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

const ModelSetsActions = ({ onAdd, onOpenRequests, t }) => {
  return (
    <div className='flex gap-2'>
      <Button
        icon={<IconPlus />}
        theme='solid'
        type='primary'
        onClick={onAdd}
        size='small'
      >
        {t('新建模型集')}
      </Button>

      <Button
        theme='light'
        type='warning'
        onClick={onOpenRequests}
        size='small'
      >
        {t('权限申请审批')}
      </Button>
    </div>
  );
};

export default ModelSetsActions;
