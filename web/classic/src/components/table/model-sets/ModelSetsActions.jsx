/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Button } from '@douyinfe/semi-ui';

const ModelSetsActions = ({ onAdd, onOpenRequests, t }) => {
  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
      <Button
        size='small'
        theme='light'
        type='primary'
        className='w-full md:w-auto'
        onClick={onAdd}
      >
        {t('新建模型集')}
      </Button>

      <Button
        size='small'
        type='warning'
        theme='light'
        className='w-full md:w-auto'
        onClick={onOpenRequests}
      >
        {t('权限申请审批')}
      </Button>
    </div>
  );
};

export default ModelSetsActions;
