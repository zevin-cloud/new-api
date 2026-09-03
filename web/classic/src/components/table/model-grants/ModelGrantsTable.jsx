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

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Tag, Button, Popconfirm, Popover } from '@douyinfe/semi-ui';
import { IconEdit } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../helpers';

function GrantTags({ values, color = 'blue', maxWidth = 210 }) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  if (list.length === 0) return <span className='text-gray-400'>-</span>;
  return (
    <div className='flex flex-wrap gap-1 min-w-0' style={{ maxWidth }}>
      {list.map((value, index) => (
        <Tag
          key={index + ':' + value}
          color={color}
          style={{ maxWidth: '100%' }}
        >
          <span
            title={value}
            style={{
              display: 'block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
        </Tag>
      ))}
    </div>
  );
}

const ModelGrantsTable = ({
  grants = [],
  loading = false,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onRevoke,
  onEdit,
  onViewDetail,
  enableBatchDelete = false,
  selectedRowKeys = [],
  onSelectedChange,
}) => {
  const { t } = useTranslation();

  const subjectTypeMeta = {
    1: { text: t('部门'), color: 'blue' },
    2: { text: t('用户组'), color: 'violet' },
    3: { text: t('个人用户'), color: 'cyan' },
  };

  const setName = (grant) =>
    grant?.direct_models ? t('指定模型') : grant?.model_set_name || '-';

  const expiry = (value) => {
    if (!value || value === 0) {
      return <Tag color='green'>{t('永不过期')}</Tag>;
    }
    const isExpired = value <= Date.now() / 1000;
    return (
      <Tag color={isExpired ? 'red' : 'orange'}>
        {timestamp2string(value)} {isExpired ? `(${t('已过期')})` : ''}
      </Tag>
    );
  };

  // 聚合批次视图数据：确保一次授权操作只生成一条独立的主表格记录
  const batchData = useMemo(() => {
    if (!Array.isArray(grants)) return [];
    return grants.map((item) => {
      const grantList = Array.isArray(item?.grants) ? item.grants : [item];

      // 提取主体列表（去重）
      const subjectMap = new Map();
      grantList.forEach((g) => {
        const key = `${g.subject_type}:${g.subject_id}`;
        if (!subjectMap.has(key)) {
          const typeName = subjectTypeMeta[g.subject_type]?.text || '';
          subjectMap.set(
            key,
            `${typeName ? typeName + ': ' : ''}${g.subject_name || '-'}`
          );
        }
      });
      const subjects = [...subjectMap.values()];

      // 提取模型集与模型（去重）
      const modelSets = [...new Set(grantList.map(setName))];
      const models = [
        ...new Set(grantList.flatMap((g) => g?.models || [])),
      ];

      // 提取有效期
      const expTimes = [
        ...new Set(grantList.map((g) => g?.expired_at || 0)),
      ];

      const rawBatchId =
        item.batch_id ||
        (item.id && typeof item.id === 'string' && item.id.startsWith('batch_')
          ? parseInt(item.id.replace('batch_', ''), 10)
          : 0) ||
        grantList[0]?.batch_id ||
        0;
      const legacyId =
        grantList[0]?.id ||
        (item.id && typeof item.id === 'string' && item.id.startsWith('grant_')
          ? parseInt(item.id.replace('grant_', ''), 10)
          : item.id);
      const displayId = rawBatchId > 0 ? `#${rawBatchId}` : `#${legacyId}`;

      return {
        ...item,
        rowKey: item.id || `batch_${rawBatchId}_${legacyId}`,
        displayId,
        batch_id: rawBatchId,
        batchId: rawBatchId,
        legacy_id: legacyId,
        legacyId,
        grants: grantList,
        subjects,
        modelSets,
        models,
        expiredAt: expTimes.length === 1 ? expTimes[0] : null,
        expTimes,
        createdAt: item.created_at || grantList[0]?.created_at,
      };
    });
  }, [grants, t]);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'displayId',
      width: 90,
      render: (text) => (
        <span className='font-mono font-semibold text-gray-700 dark:text-gray-300'>
          {text}
        </span>
      ),
    },
    {
      title: t('授权主体'),
      width: 240,
      render: (_, record) => {
        const list = record.subjects || [];
        return (
          <div className='min-w-0'>
            <GrantTags values={list.slice(0, 2)} maxWidth={190} />
            {list.length > 2 && (
              <Popover
                content={
                  <div className='p-2 max-w-sm'>
                    <GrantTags values={list} maxWidth={320} />
                  </div>
                }
              >
                <Button size='small' theme='borderless' className='!px-1'>
                  +{list.length - 2}
                </Button>
              </Popover>
            )}
          </div>
        );
      },
    },
    {
      title: t('授权模型资源'),
      width: 260,
      render: (_, record) => {
        const sets = record.modelSets || [];
        const models = record.models || [];
        return (
          <div className='flex flex-col gap-1 min-w-0'>
            <div className='flex items-center gap-1'>
              <GrantTags values={sets.slice(0, 1)} color='cyan' maxWidth={180} />
              {sets.length > 1 && (
                <Tag size='small' color='grey'>
                  +{sets.length - 1}
                </Tag>
              )}
            </div>
            {models.length > 0 && (
              <div className='flex items-center gap-1'>
                <GrantTags values={models.slice(0, 2)} color='grey' maxWidth={170} />
                {models.length > 2 && (
                  <Popover
                    content={
                      <div className='p-2 max-w-sm'>
                        <GrantTags values={models} color='grey' maxWidth={320} />
                      </div>
                    }
                  >
                    <Button size='small' theme='borderless' className='!px-1 text-xs'>
                      +{models.length - 2}
                    </Button>
                  </Popover>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t('有效期'),
      width: 170,
      render: (_, record) =>
        record.expiredAt !== null ? (
          expiry(record.expiredAt)
        ) : (
          <Tag color='orange'>{t('多时效设置')}</Tag>
        ),
    },
    {
      title: t('授权时间'),
      dataIndex: 'createdAt',
      width: 160,
      render: (value) => (value ? timestamp2string(value) : '-'),
    },
    {
      title: t('操作'),
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <div className='flex items-center gap-1'>
          <Button
            size='small'
            theme='light'
            type='tertiary'
            onClick={() => onViewDetail?.(record)}
          >
            {t('详情')}
          </Button>

          <Button
            size='small'
            theme='light'
            type='primary'
            icon={<IconEdit />}
            onClick={() => onEdit?.(record)}
          >
            {t('编辑')}
          </Button>

          <Popconfirm
            title={t('确认撤销')}
            content={
              <div className='max-w-xs break-words'>
                {t('确定撤销此次授权吗？将收回该授权包含的全部权限。')}
              </div>
            }
            onConfirm={() => onRevoke?.(record)}
          >
            <Button size='small' type='danger' theme='borderless'>
              {t('撤销')}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const rowSelection = enableBatchDelete
    ? {
        selectedRowKeys,
        onChange: (keys) => onSelectedChange?.(keys),
      }
    : undefined;

  return (
    <Table
      columns={columns}
      dataSource={batchData}
      loading={loading}
      rowKey='rowKey'
      size='small'
      scroll={{ x: 1050 }}
      rowSelection={rowSelection}
      pagination={{
        currentPage: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        onPageChange: (nextPage) => onPageChange?.(nextPage, pageSize),
        onPageSizeChange: (size) => onPageChange?.(1, size),
      }}
    />
  );
};

export default ModelGrantsTable;
