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

import React, { useState, useMemo } from 'react';
import { Modal, Button, Checkbox } from '@douyinfe/semi-ui';
import { IconHandle, IconArrowUp, IconArrowDown } from '@douyinfe/semi-icons';

const ColumnSelectorModal = ({
  visible,
  showColumnSelector,
  onCancel,
  setShowColumnSelector,
  allColumns = [],
  visibleColumns = {},
  columnOrder = [],
  onVisibleColumnsChange,
  handleColumnVisibilityChange,
  onColumnOrderChange,
  handleColumnOrderChange,
  handleSelectAll,
  onReset,
  initDefaultColumns,
  t,
}) => {
  const isVisible = visible !== undefined ? visible : showColumnSelector;
  const handleClose = () => {
    if (onCancel) onCancel();
    if (setShowColumnSelector) setShowColumnSelector(false);
  };

  const handleOrderChange = (newOrder) => {
    if (onColumnOrderChange) onColumnOrderChange(newOrder);
    if (handleColumnOrderChange) handleColumnOrderChange(newOrder);
  };

  const handleVisibilityChange = (key, checked) => {
    if (handleColumnVisibilityChange) {
      handleColumnVisibilityChange(key, checked);
    } else if (onVisibleColumnsChange) {
      onVisibleColumnsChange({
        ...visibleColumns,
        [key]: checked,
      });
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else if (initDefaultColumns) {
      initDefaultColumns();
    }
  };

  // Filter out operate / action column or columns without title for reordering & visibility
  const configurableColumns = useMemo(() => {
    return allColumns.filter((col) => {
      const key = col.key || col.dataIndex;
      if (!col.title || key === 'operate' || key === 'actions') {
        return false;
      }
      return true;
    });
  }, [allColumns]);

  // Sort configurable columns according to columnOrder
  const orderedList = useMemo(() => {
    const colMap = new Map();
    configurableColumns.forEach((col) => {
      const key = col.key || col.dataIndex;
      colMap.set(key, col);
    });

    const result = [];
    // First add columns that are in columnOrder
    if (Array.isArray(columnOrder)) {
      columnOrder.forEach((key) => {
        if (colMap.has(key)) {
          result.push(colMap.get(key));
          colMap.delete(key);
        }
      });
    }
    // Then add any remaining columns not yet in columnOrder
    colMap.forEach((col) => {
      result.push(col);
    });

    return result;
  }, [configurableColumns, columnOrder]);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const currentKeys = orderedList.map((col) => col.key || col.dataIndex);
    const newOrder = [...currentKeys];
    const [movedKey] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, movedKey);

    handleOrderChange(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= orderedList.length) return;
    const currentKeys = orderedList.map((col) => col.key || col.dataIndex);
    const newOrder = [...currentKeys];
    const [movedKey] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedKey);
    handleOrderChange(newOrder);
  };

  // Select all state
  const visibleConfigurableCount = configurableColumns.filter(
    (col) => !!visibleColumns[col.key || col.dataIndex],
  ).length;

  const allSelected =
    configurableColumns.length > 0 &&
    visibleConfigurableCount === configurableColumns.length;
  const indeterminate =
    visibleConfigurableCount > 0 &&
    visibleConfigurableCount < configurableColumns.length;

  const onSelectAllToggle = (checked) => {
    if (handleSelectAll) {
      handleSelectAll(checked);
    } else if (onVisibleColumnsChange) {
      const updated = { ...visibleColumns };
      configurableColumns.forEach((col) => {
        const key = col.key || col.dataIndex;
        updated[key] = checked;
      });
      onVisibleColumnsChange(updated);
    }
  };

  return (
    <Modal
      title={t ? t('列设置') : '列设置'}
      visible={isVisible}
      onCancel={handleClose}
      footer={
        <div className='flex justify-end gap-2'>
          <Button onClick={handleReset}>{t ? t('重置') : '重置'}</Button>
          <Button onClick={handleClose}>{t ? t('取消') : '取消'}</Button>
          <Button type='primary' onClick={handleClose}>
            {t ? t('确定') : '确定'}
          </Button>
        </div>
      }
    >
      <div className='flex justify-between items-center mb-3 px-1'>
        <Checkbox
          checked={allSelected}
          indeterminate={indeterminate}
          onChange={(e) => onSelectAllToggle(e.target.checked)}
        >
          {t ? t('全选') : '全选'}
        </Checkbox>
        <span className='text-xs text-[var(--semi-color-text-2)] flex items-center gap-1'>
          <IconHandle style={{ fontSize: 13 }} />
          {t ? t('拖拽或点击箭头调整顺序') : '拖拽或点击箭头调整顺序'}
        </span>
      </div>
      <div
        className='flex flex-col gap-1.5 max-h-[380px] overflow-y-auto rounded-lg p-2'
        style={{ border: '1px solid var(--semi-color-border)' }}
      >
        {orderedList.map((col, index) => {
          const key = col.key || col.dataIndex;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between px-3 py-1.5 rounded-md transition-all select-none ${
                isDragging
                  ? 'opacity-40 bg-[var(--semi-color-fill-0)]'
                  : isDragOver
                  ? 'bg-[var(--semi-color-primary-light-default)] border-t-2 border-[var(--semi-color-primary)]'
                  : 'hover:bg-[var(--semi-color-fill-0)]'
              }`}
              style={{
                border: isDragOver
                  ? '1px dashed var(--semi-color-primary)'
                  : '1px solid var(--semi-color-border)',
              }}
            >
              <div className='flex items-center gap-2.5 min-w-0'>
                <IconHandle className='cursor-grab active:cursor-grabbing text-[var(--semi-color-text-2)] hover:text-[var(--semi-color-text-0)] flex-shrink-0' />
                <Checkbox
                  checked={!!visibleColumns[key]}
                  disabled={col.required}
                  onChange={(e) => handleVisibilityChange(key, e.target.checked)}
                >
                  <span className='truncate'>{col.title}</span>
                </Checkbox>
              </div>
              <div className='flex items-center gap-1 flex-shrink-0'>
                <Button
                  icon={<IconArrowUp />}
                  size='small'
                  type='tertiary'
                  theme='borderless'
                  disabled={index === 0}
                  onClick={() => moveItem(index, index - 1)}
                  style={{ padding: '4px' }}
                />
                <Button
                  icon={<IconArrowDown />}
                  size='small'
                  type='tertiary'
                  theme='borderless'
                  disabled={index === orderedList.length - 1}
                  onClick={() => moveItem(index, index + 1)}
                  style={{ padding: '4px' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default ColumnSelectorModal;
