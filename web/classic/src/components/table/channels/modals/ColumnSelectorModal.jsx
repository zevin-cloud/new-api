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

import React from 'react';
import CommonColumnSelectorModal from '../../../common/table/ColumnSelectorModal';
import { getChannelsColumns } from '../ChannelsColumnDefs';

const ColumnSelectorModal = (props) => {
  const {
    showColumnSelector,
    setShowColumnSelector,
    visibleColumns,
    columnOrder,
    handleColumnVisibilityChange,
    handleColumnOrderChange,
    handleSelectAll,
    initDefaultColumns,
    COLUMN_KEYS,
    t,
    // Props needed for getChannelsColumns
    updateChannelBalance,
    manageChannel,
    manageTag,
    submitTagEdit,
    testChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setEditingChannel,
    setShowEdit,
    setShowEditTag,
    setEditingTag,
    copySelectedChannel,
    refresh,
    activePage,
    channels,
    checkOllamaVersion,
    setShowMultiKeyManageModal,
    setCurrentMultiKeyChannel,
    openUpstreamUpdateModal,
    detectChannelUpstreamUpdates,
    openClientQuotaModal,
  } = props;

  // Get all columns for display in selector
  const allColumns = getChannelsColumns({
    t,
    COLUMN_KEYS,
    updateChannelBalance,
    manageChannel,
    manageTag,
    submitTagEdit,
    testChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setEditingChannel,
    setShowEdit,
    setShowEditTag,
    setEditingTag,
    copySelectedChannel,
    refresh,
    activePage,
    channels,
    checkOllamaVersion,
    setShowMultiKeyManageModal,
    setCurrentMultiKeyChannel,
    openUpstreamUpdateModal,
    detectChannelUpstreamUpdates,
    openClientQuotaModal,
  });

  return (
    <CommonColumnSelectorModal
      showColumnSelector={showColumnSelector}
      setShowColumnSelector={setShowColumnSelector}
      visibleColumns={visibleColumns}
      columnOrder={columnOrder}
      handleColumnVisibilityChange={handleColumnVisibilityChange}
      handleColumnOrderChange={handleColumnOrderChange}
      handleSelectAll={handleSelectAll}
      initDefaultColumns={initDefaultColumns}
      allColumns={allColumns}
      t={t}
    />
  );
};

export default ColumnSelectorModal;
