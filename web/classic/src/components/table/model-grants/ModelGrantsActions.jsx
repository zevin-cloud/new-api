/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Button, Space } from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons';

const ModelGrantsActions = ({ onRefresh, onOpenCreate, onOpenInspect, t }) => {
  return (
    <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1 items-center'>
      <Button
        type='primary'
        size='small'
        icon={<IconPlus />}
        onClick={onOpenCreate}
      >
        {t('新建授权')}
      </Button>

      <Button
        type='tertiary'
        size='small'
        icon={<IconSearch />}
        onClick={onOpenInspect}
      >
        {t('权限诊断')}
      </Button>

      <Button
        type='tertiary'
        size='small'
        icon={<IconRefresh />}
        onClick={onRefresh}
      >
        {t('刷新')}
      </Button>
    </div>
  );
};

export default ModelGrantsActions;
