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
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        icon={<IconPlus />}
        type='primary'
        onClick={onAdd}
        size='small'
      >
        {t('新建模型集')}
      </Button>

      <Button
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
