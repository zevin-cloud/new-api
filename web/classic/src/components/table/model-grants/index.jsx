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

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CardPro from '../../common/ui/CardPro';
import ModelGrantsTable from './ModelGrantsTable';
import ModelGrantsActions from './ModelGrantsActions';
import ModelGrantsFilters from './ModelGrantsFilters';
import CreateGrantModal from './modals/CreateGrantModal';
import InspectUserModal from './modals/InspectUserModal';
import GrantDetailDrawer from './modals/GrantDetailDrawer';
import { showError, showSuccess } from '../../../helpers';
import {
  listGrants,
  loadGrantModelSets,
  revokeGrant,
  revokeGrantBatch,
  batchRevokeGrantBatches,
} from '../../../services/modelGrants';
import { Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const ModelGrantsPage = () => {
  const { t } = useTranslation();
  const activeRequest = useRef(null);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // 批量操作控制
  const [enableBatchDelete, setEnableBatchDelete] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 新建 / 编辑抽屉
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);

  // 纯详情抽屉（展示具体哪些用户授权了哪些模型）
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [detailBatch, setDetailBatch] = useState(null);

  const [modelSets, setModelSets] = useState([]);
  const [filters, setFilters] = useState({
    subject_type: 0,
    model_set_id: 0,
    status: 0,
    keyword: '',
  });

  // 其它弹窗
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);

  useEffect(() => {
    loadModelSets();
  }, []);

  useEffect(() => {
    loadGrants(1, pageSize, filters);
  }, [filters.subject_type, filters.model_set_id, filters.status]);

  const loadModelSets = async () => {
    try {
      const sets = await loadGrantModelSets();
      setModelSets(Array.isArray(sets) ? sets : []);
    } catch (error) {
      showError(error.message || t('获取模型集失败'));
    }
  };

  useEffect(() => () => activeRequest.current?.abort(), []);

  const loadGrants = async (p = page, ps = pageSize, f = filters) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    try {
      const data = await listGrants(p, ps, f, controller.signal);
      if (controller.signal.aborted) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      if (p > 1 && items.length === 0) {
        loadGrants(Math.max(1, Math.ceil((data?.total || 0) / ps)), ps, f);
        return;
      }
      setGrants(items);
      setTotal(data?.total || 0);
      setPage(data?.page || 1);
      setPageSize(data?.page_size || ps);
      setSelectedRowKeys([]);
    } catch (error) {
      if (!controller.signal.aborted)
        showError(error.message || t('无法加载授权数据'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (key === 'keyword' || key === 'status') {
      loadGrants(1, pageSize, newFilters);
    }
  };

  const handlePageChange = (newPage, newPageSize) => {
    setPage(newPage);
    setPageSize(newPageSize);
    loadGrants(newPage, newPageSize, filters);
  };

  const handleRevoke = async (record) => {
    try {
      const batchId = record?.batch_id || record?.batchId || 0;
      const legacyId =
        record?.legacy_id ||
        record?.legacyId ||
        (Array.isArray(record?.grants) && record.grants[0]?.id) ||
        record?.id;

      if (batchId > 0) {
        await revokeGrantBatch(batchId);
      } else if (legacyId) {
        await revokeGrant(legacyId);
      }
      showSuccess(t('授权已撤销'));
      loadGrants(page, pageSize, filters);
    } catch (error) {
      showError(error.message || t('撤销授权失败'));
    }
  };

  const handleBatchRevoke = async (keys) => {
    if (!keys || keys.length === 0) return;
    try {
      const selectedItems = grants.filter(
        (item) =>
          keys.includes(item.id) ||
          keys.includes(`batch_${item.batch_id}`) ||
          keys.includes(item.rowKey)
      );
      await batchRevokeGrantBatches(
        selectedItems.length > 0 ? selectedItems : keys.map((id) => ({ id }))
      );
      showSuccess(t('授权已撤销'));
      setSelectedRowKeys([]);
      loadGrants(page, pageSize, filters);
    } catch (error) {
      showError(error.message || t('撤销授权失败'));
    }
  };

  return (
    <>
      <CreateGrantModal
        visible={showFormModal}
        batchItem={editingBatch}
        onClose={() => {
          setShowFormModal(false);
          setEditingBatch(null);
        }}
        onSuccess={() => loadGrants(1, pageSize, filters)}
        t={t}
      />

      <InspectUserModal
        visible={showInspectModal}
        onClose={() => setShowInspectModal(false)}
        t={t}
      />

      <GrantDetailDrawer
        visible={showDetailDrawer}
        batchItem={detailBatch}
        onClose={() => {
          setShowDetailDrawer(false);
          setDetailBatch(null);
        }}
        onEdit={(item) => {
          setEditingBatch(item);
          setShowFormModal(true);
        }}
        onRevoke={handleRevoke}
      />

      <CardPro
        type='type3'
        descriptionArea={
          <div>
            <Title heading={4}>{t('模型权限授权管理')}</Title>
            <Text type='secondary'>
              {t(
                '集中管理部门、用户组和个人用户的模型访问权限，支持批量授权、覆盖成员查看及权限诊断'
              )}
            </Text>
          </div>
        }
        actionsArea={
          <ModelGrantsActions
            enableBatchDelete={enableBatchDelete}
            setEnableBatchDelete={setEnableBatchDelete}
            selectedKeys={selectedRowKeys}
            onBatchRevoke={handleBatchRevoke}
            statusFilter={filters.status}
            setStatusFilter={(status) => handleFilterChange('status', status)}
          />
        }
        searchArea={
          <ModelGrantsFilters
            onOpenCreate={() => {
              setEditingBatch(null);
              setShowFormModal(true);
            }}
            onOpenInspect={() => setShowInspectModal(true)}
            onRefresh={() => loadGrants(page, pageSize, filters)}
            filters={filters}
            onFilterChange={handleFilterChange}
            modelSets={modelSets}
          />
        }
        t={t}
      >
        <ModelGrantsTable
          grants={grants}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onRevoke={handleRevoke}
          onViewDetail={(record) => {
            setDetailBatch(record);
            setShowDetailDrawer(true);
          }}
          onEdit={(record) => {
            setEditingBatch(record);
            setShowFormModal(true);
          }}
          enableBatchDelete={enableBatchDelete}
          selectedRowKeys={selectedRowKeys}
          onSelectedChange={setSelectedRowKeys}
          t={t}
        />
      </CardPro>
    </>
  );
};

export default ModelGrantsPage;
