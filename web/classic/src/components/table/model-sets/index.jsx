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
import ModelSetsTable from './ModelSetsTable';
import ModelSetsActions from './ModelSetsActions';
import ModelSetsFilters from './ModelSetsFilters';
import ModelSetModal from './modals/ModelSetModal';
import ModelSetSubjectsModal from './modals/ModelSetSubjectsModal';
import AdminRequestsModal from './modals/AdminRequestsModal';
import { API, showError, showSuccess } from '../../../helpers';
import { Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const ModelSetsPage = () => {
  const { t } = useTranslation();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  // Modal states
  const [showSetModal, setShowSetModal] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [managingSubjectsSet, setManagingSubjectsSet] = useState(null);
  const [showAdminRequests, setShowAdminRequests] = useState(false);

  const loadSets = async (p = page, kw = keyword) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/model-set?page=${p}&page_size=${pageSize}&keyword=${encodeURIComponent(kw)}`);
      if (res.data?.success) {
        setSets(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || 1);
      } else {
        showError(res.data?.message || '获取模型集列表失败');
      }
    } catch (e) {
      showError('获取模型集列表失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSets(1);
  }, []);

  const handleSearch = (kw) => {
    setKeyword(kw);
    loadSets(1, kw);
  };

  const handleAdd = () => {
    setEditingSet(null);
    setShowSetModal(true);
  };

  const handleEdit = (record) => {
    setEditingSet(record);
    setShowSetModal(true);
  };

  const handleManageSubjects = (record) => {
    setManagingSubjectsSet(record);
    setShowSubjectsModal(true);
  };

  const handleDelete = async (record) => {
    try {
      const res = await API.delete(`/api/model-set/${record.id}`);
      if (res.data?.success) {
        showSuccess(t('删除模型集成功'));
        loadSets(page);
      } else {
        showError(res.data?.message || '删除失败');
      }
    } catch (e) {
      showError('删除失败: ' + e.message);
    }
  };

  return (
    <>
      <ModelSetModal
        visible={showSetModal}
        editingSet={editingSet}
        onClose={() => setShowSetModal(false)}
        onSuccess={() => {
          setShowSetModal(false);
          loadSets(page);
        }}
        t={t}
      />

      <ModelSetSubjectsModal
        visible={showSubjectsModal}
        modelSet={managingSubjectsSet}
        onClose={() => {
          setShowSubjectsModal(false);
          loadSets(page);
        }}
        t={t}
      />

      <AdminRequestsModal
        visible={showAdminRequests}
        onClose={() => setShowAdminRequests(false)}
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <div>
            <Title heading={4}>{t('模型集管理')}</Title>
            <Text type='secondary'>
              {t('将多个底层模型打包为业务模型集，统一面向部门、用户组或个人授权。')}
            </Text>
          </div>
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <ModelSetsActions
              onAdd={handleAdd}
              onOpenRequests={() => setShowAdminRequests(true)}
              t={t}
            />
            <ModelSetsFilters onSearch={handleSearch} loading={loading} t={t} />
          </div>
        }
        t={t}
      >
        <ModelSetsTable
          sets={sets}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => loadSets(p)}
          onEdit={handleEdit}
          onManageSubjects={handleManageSubjects}
          onDelete={handleDelete}
          t={t}
        />
      </CardPro>
    </>
  );
};

export default ModelSetsPage;
