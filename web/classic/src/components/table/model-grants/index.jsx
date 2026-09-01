/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CardPro from '../../common/ui/CardPro';
import ModelGrantsTable from './ModelGrantsTable';
import ModelGrantsActions from './ModelGrantsActions';
import ModelGrantsFilters from './ModelGrantsFilters';
import CreateGrantModal from './modals/CreateGrantModal';
import InspectUserModal from './modals/InspectUserModal';
import { API, showError, showSuccess } from '../../../helpers';
import { Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const ModelGrantsPage = () => {
  const { t } = useTranslation();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [modelSets, setModelSets] = useState([]);
  const [filters, setFilters] = useState({
    subject_type: 0,
    model_set_id: 0,
    status: 0,
    keyword: '',
  });

  // Modal states
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
      const res = await API.get('/api/model-set?page=1&page_size=200');
      if (res.data?.success) {
        setModelSets(res.data.data.items || []);
      }
    } catch (e) {
      // ignore
    }
  };

  const loadGrants = async (p = page, ps = pageSize, f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p,
        page_size: ps,
      });
      if (f.subject_type > 0) params.append('subject_type', f.subject_type);
      if (f.model_set_id > 0) params.append('model_set_id', f.model_set_id);
      if (f.status > 0) params.append('status', f.status);
      if (f.keyword) params.append('keyword', f.keyword);

      const res = await API.get(`/api/model-grant?${params.toString()}`);
      if (res.data?.success) {
        setGrants(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || 1);
        setPageSize(res.data.data.page_size || 10);
      } else {
        showError(res.data?.message || '获取授权列表失败');
      }
    } catch (e) {
      showError('获取授权列表失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (key === 'keyword') {
      loadGrants(1, pageSize, newFilters);
    }
  };

  const handlePageChange = (newPage, newPageSize) => {
    setPage(newPage);
    setPageSize(newPageSize);
    loadGrants(newPage, newPageSize, filters);
  };

  const handleRevoke = async (grantId) => {
    try {
      const res = await API.delete(`/api/model-grant/${grantId}`);
      if (res.data?.success) {
        showSuccess(t('撤销授权成功'));
        loadGrants(page, pageSize, filters);
      } else {
        showError(res.data?.message || '撤销授权失败');
      }
    } catch (e) {
      showError('撤销授权失败: ' + e.message);
    }
  };

  return (
    <>
      <CreateGrantModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => loadGrants(1, pageSize, filters)}
        t={t}
      />

      <InspectUserModal
        visible={showInspectModal}
        onClose={() => setShowInspectModal(false)}
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <div>
            <Title heading={4}>{t('模型权限授权管理')}</Title>
            <Text type='secondary'>
              {t(
                '集中管理部门、用户组和个人用户的模型访问权限，支持批量分配模型集、有效期管控与权限诊断'
              )}
            </Text>
          </div>
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <ModelGrantsActions
              onRefresh={() => loadGrants(page, pageSize, filters)}
              onOpenCreate={() => setShowCreateModal(true)}
              onOpenInspect={() => setShowInspectModal(true)}
              t={t}
            />

            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
              <ModelGrantsFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                modelSets={modelSets}
                t={t}
              />
            </div>
          </div>
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
          t={t}
        />
      </CardPro>
    </>
  );
};

export default ModelGrantsPage;
