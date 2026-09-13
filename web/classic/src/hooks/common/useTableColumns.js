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

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom Hook to manage table column visibility, ordering, and localStorage persistence.
 *
 * @param {string} tableKey - Unique key for the table (e.g. 'channels', 'models', 'users')
 * @param {Object} defaultVisibility - Default visibility mapping { [key]: boolean }
 * @param {string[]} defaultOrder - Default array of column keys in order
 */
export function useTableColumns({
  tableKey,
  defaultVisibility = {},
  defaultOrder = [],
}) {
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Initialize visibility from localStorage or defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`${tableKey}-table-columns`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultVisibility, ...parsed };
      }
    } catch (e) {
      console.error(`Failed to parse saved columns for ${tableKey}`, e);
    }
    return { ...defaultVisibility };
  });

  // Initialize column order from localStorage or defaults
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(`${tableKey}-table-column-order`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validKeys = parsed.filter((k) => defaultOrder.includes(k));
          const missingKeys = defaultOrder.filter((k) => !validKeys.includes(k));
          return [...validKeys, ...missingKeys];
        }
      }
    } catch (e) {
      console.error(`Failed to parse saved column order for ${tableKey}`, e);
    }
    return [...defaultOrder];
  });

  // Save visibility to localStorage
  useEffect(() => {
    if (visibleColumns && Object.keys(visibleColumns).length > 0) {
      try {
        localStorage.setItem(
          `${tableKey}-table-columns`,
          JSON.stringify(visibleColumns),
        );
      } catch (e) {}
    }
  }, [tableKey, visibleColumns]);

  // Save column order to localStorage
  useEffect(() => {
    if (columnOrder && columnOrder.length > 0) {
      try {
        localStorage.setItem(
          `${tableKey}-table-column-order`,
          JSON.stringify(columnOrder),
        );
      } catch (e) {}
    }
  }, [tableKey, columnOrder]);

  const handleColumnVisibilityChange = useCallback((columnKey, checked) => {
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked }));
  }, []);

  const handleSelectAll = useCallback(
    (checked) => {
      setVisibleColumns((prev) => {
        const updated = {};
        Object.keys(defaultVisibility).forEach((key) => {
          updated[key] = checked;
        });
        return updated;
      });
    },
    [defaultVisibility],
  );

  const handleColumnOrderChange = useCallback((newOrder) => {
    setColumnOrder(newOrder);
  }, []);

  const initDefaultColumns = useCallback(() => {
    setVisibleColumns({ ...defaultVisibility });
    setColumnOrder([...defaultOrder]);
    try {
      localStorage.removeItem(`${tableKey}-table-columns`);
      localStorage.removeItem(`${tableKey}-table-column-order`);
    } catch (e) {}
  }, [tableKey, defaultVisibility, defaultOrder]);

  /**
   * Filter visible columns and sort by columnOrder.
   * Action/operate columns are pinned to the end.
   */
  const filterAndSortColumns = useCallback(
    (allColumns = []) => {
      const isOperateCol = (col) => {
        const key = col.key || col.dataIndex;
        return (
          key === 'operate' ||
          key === 'actions' ||
          col.fixed === 'right' ||
          !col.title
        );
      };

      const filtered = allColumns.filter((col) => {
        const key = col.key || col.dataIndex;
        if (isOperateCol(col)) {
          return visibleColumns[key] !== false;
        }
        return !!visibleColumns[key];
      });

      return filtered.sort((a, b) => {
        const keyA = a.key || a.dataIndex;
        const keyB = b.key || b.dataIndex;
        const aIsOperate = isOperateCol(a);
        const bIsOperate = isOperateCol(b);

        if (aIsOperate && !bIsOperate) return 1;
        if (!aIsOperate && bIsOperate) return -1;
        if (aIsOperate && bIsOperate) return 0;

        const idxA = columnOrder.indexOf(keyA);
        const idxB = columnOrder.indexOf(keyB);

        const orderA = idxA === -1 ? 999 : idxA;
        const orderB = idxB === -1 ? 999 : idxB;

        return orderA - orderB;
      });
    },
    [visibleColumns, columnOrder],
  );

  return {
    showColumnSelector,
    setShowColumnSelector,
    visibleColumns,
    setVisibleColumns,
    columnOrder,
    setColumnOrder,
    handleColumnVisibilityChange,
    handleSelectAll,
    handleColumnOrderChange,
    initDefaultColumns,
    filterAndSortColumns,
  };
}
