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

import React, { useRef } from 'react';
import { Form, Button } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const UserGroupsFilters = ({ onSearch, loading, t }) => {
  const formApiRef = useRef(null);

  const handleSubmit = () => {
    if (!formApiRef.current) return;
    const values = formApiRef.current.getValues();
    onSearch(values.keyword || '');
  };

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    onSearch('');
  };

  return (
    <Form
      getFormApi={(api) => (formApiRef.current = api)}
      onSubmit={handleSubmit}
      layout='horizontal'
      className='flex items-center gap-2'
    >
      <Form.Input
        field='keyword'
        prefix={<IconSearch />}
        placeholder={t('搜索用户组名称或说明')}
        showClear
        pure
        size='small'
        style={{ width: 240 }}
      />
      <Button type='tertiary' htmlType='submit' loading={loading} size='small'>
        {t('查询')}
      </Button>
      <Button type='tertiary' onClick={handleReset} size='small'>
        {t('重置')}
      </Button>
    </Form>
  );
};

export default UserGroupsFilters;
