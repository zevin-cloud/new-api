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
import CardPro from '../../common/ui/CardPro';
import UsersTable from './UsersTable';
import UsersActions from './UsersActions';
import UsersFilters from './UsersFilters';
import UsersDescription from './UsersDescription';
import DepartmentTree from './DepartmentTree';
import EditUserModal from './modals/EditUserModal';
import UserDetailSideSheet from './modals/UserDetailSideSheet';
import UserImportModal from './modals/UserImportModal';
import BatchGroupModal from './modals/BatchGroupModal';
import { useUsersData } from '../../../hooks/users/useUsersData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const UsersPage = () => {
  const usersData = useUsersData();
  const isMobile = useIsMobile();

  const {
    // Modal state
    showEditUser,
    editingUser,
    setEditingUser,
    setShowEditUser,
    closeEditUser,
    showDetail,
    setShowDetail,
    detailUserId,
    showImportModal,
    setShowImportModal,
    showBatchGroupModal,
    setShowBatchGroupModal,
    refresh,

    // Enterprise selection & tree
    selectedDeptId,
    setSelectedDeptId,
    selectedUserGroupId,
    selectedRowKeys,
    setSelectedRowKeys,
    userGroupOptions,

    // Form state
    formInitValues,
    setFormApi,
    searchUsers,
    loadUsers,
    activePage,
    pageSize,
    groupOptions,
    loading,
    searching,

    // Description state
    compactMode,
    setCompactMode,

    // Translation
    t,
  } = usersData;

  const handleSelectDept = (deptId) => {
    setSelectedDeptId(deptId);
    searchUsers(1, pageSize, null, null, deptId, selectedUserGroupId);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowEditUser(true);
  };

  return (
    <>
      <EditUserModal
        refresh={refresh}
        visible={showEditUser}
        handleClose={closeEditUser}
        editingUser={editingUser}
        defaultDeptId={selectedDeptId}
      />

      <UserDetailSideSheet
        visible={showDetail}
        userId={detailUserId}
        onClose={() => setShowDetail(false)}
        t={t}
      />

      <UserImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refresh();
        }}
        t={t}
      />

      <BatchGroupModal
        visible={showBatchGroupModal}
        selectedUserIds={selectedRowKeys}
        onClose={() => setShowBatchGroupModal(false)}
        onSuccess={() => {
          setShowBatchGroupModal(false);
          setSelectedRowKeys([]);
          refresh();
        }}
        t={t}
      />

      <div className='flex flex-col md:flex-row gap-4 items-start w-full'>
        <DepartmentTree
          selectedDeptId={selectedDeptId}
          onSelectDept={handleSelectDept}
          t={t}
        />

        <div className='flex-1 min-w-0 w-full'>
          <CardPro
            type='type1'
            descriptionArea={
              <UsersDescription
                compactMode={compactMode}
                setCompactMode={setCompactMode}
                t={t}
              />
            }
            actionsArea={
              <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
                <UsersActions
                  onAddUser={handleAddUser}
                  setShowImportModal={setShowImportModal}
                  setShowBatchGroupModal={setShowBatchGroupModal}
                  selectedRowKeys={selectedRowKeys}
                  t={t}
                />

                <UsersFilters
                  formInitValues={formInitValues}
                  setFormApi={setFormApi}
                  searchUsers={searchUsers}
                  loadUsers={loadUsers}
                  activePage={activePage}
                  pageSize={pageSize}
                  groupOptions={groupOptions}
                  userGroupOptions={userGroupOptions}
                  loading={loading}
                  searching={searching}
                  t={t}
                />
              </div>
            }
            paginationArea={createCardProPagination({
              currentPage: usersData.activePage,
              pageSize: usersData.pageSize,
              total: usersData.userCount,
              onPageChange: usersData.handlePageChange,
              onPageSizeChange: usersData.handlePageSizeChange,
              isMobile: isMobile,
              t: usersData.t,
            })}
            t={usersData.t}
          >
            <UsersTable {...usersData} />
          </CardPro>
        </div>
      </div>
    </>
  );
};

export default UsersPage;
