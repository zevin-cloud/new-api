/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import { Tree, Button, Modal, Typography, Dropdown, Space } from '@douyinfe/semi-ui';
import { IconPlus, IconMore, IconEdit, IconDelete, IconFolder, IconFolderOpen } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../helpers';
import DepartmentModal from './modals/DepartmentModal';

const { Text } = Typography;

const DepartmentTree = ({ selectedDeptId, onSelectDept, t }) => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [parentDeptId, setParentDeptId] = useState(0);

  const [expandedKeys, setExpandedKeys] = useState(['0']);

  const loadTree = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/department/tree');
      if (res.data?.success) {
        const formatNodes = (nodes) => {
          if (!nodes || nodes.length === 0) return [];
          return nodes.map((n) => ({
            label: n.name,
            value: String(n.id),
            key: String(n.id),
            raw: n,
            children: formatNodes(n.children),
          }));
        };

        const rootNode = {
          label: t('全部用户 (全组织)'),
          value: '0',
          key: '0',
          children: formatNodes(res.data.data),
        };
        const allNodes = [rootNode];
        setTreeData(allNodes);

        // Collect all node keys to expand by default
        const collectKeys = (nodes) => {
          let keys = [];
          nodes.forEach((n) => {
            keys.push(n.key);
            if (n.children && n.children.length > 0) {
              keys = keys.concat(collectKeys(n.children));
            }
          });
          return keys;
        };
        setExpandedKeys(collectKeys(allNodes));
      } else {
        showError(res.data?.message || '获取部门树失败');
      }
    } catch (e) {
      showError('获取部门树失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const handleCreateRoot = () => {
    setEditingDept(null);
    setParentDeptId(0);
    setShowDeptModal(true);
  };

  const handleCreateSub = (raw) => {
    setEditingDept(null);
    setParentDeptId(raw.id);
    setShowDeptModal(true);
  };

  const handleEdit = (raw) => {
    setEditingDept(raw);
    setParentDeptId(raw.parent_id || 0);
    setShowDeptModal(true);
  };

  const handleDelete = (raw) => {
    Modal.confirm({
      title: t('确认删除部门'),
      content: t('确定要删除部门 {{name}} 吗？删除前请确保该部门下无子部门和用户。', { name: raw.name }),
      onOk: async () => {
        try {
          const res = await API.delete(`/api/department/${raw.id}`);
          if (res.data?.success) {
            showSuccess(t('删除部门成功'));
            if (selectedDeptId === raw.id) {
              onSelectDept(0);
            }
            loadTree();
          } else {
            showError(res.data?.message || '删除失败');
          }
        } catch (e) {
          showError('删除失败: ' + e.message);
        }
      },
    });
  };

  const renderLabel = (label, raw) => {
    const isRoot = !raw || raw.id === undefined;
    return (
      <div className='flex items-center justify-between w-full pr-2 group'>
        <span className='truncate text-sm font-medium'>{label}</span>
        {!isRoot && (
          <div
            className='opacity-0 group-hover:opacity-100 transition-opacity flex items-center'
            onClick={(e) => e.stopPropagation()}
          >
            <Dropdown
              trigger='click'
              position='bottomRight'
              menu={[
                {
                  node: 'item',
                  name: t('添加子部门'),
                  icon: <IconPlus />,
                  onClick: () => handleCreateSub(raw),
                },
                {
                  node: 'item',
                  name: t('编辑部门'),
                  icon: <IconEdit />,
                  onClick: () => handleEdit(raw),
                },
                {
                  node: 'item',
                  name: t('删除部门'),
                  icon: <IconDelete style={{ color: 'var(--semi-color-danger)' }} />,
                  type: 'danger',
                  onClick: () => handleDelete(raw),
                },
              ]}
            >
              <Button
                icon={<IconMore />}
                size='small'
                theme='borderless'
                type='tertiary'
              />
            </Dropdown>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className='w-full md:w-64 flex-shrink-0 bg-[var(--semi-color-bg-1)] border border-[var(--semi-color-border)] rounded-lg p-3 flex flex-col'>
      <div className='flex items-center justify-between pb-2 mb-2 border-b border-[var(--semi-color-border)]'>
        <Text strong>{t('组织架构')}</Text>
        <Button
          icon={<IconPlus />}
          size='small'
          theme='light'
          type='primary'
          onClick={handleCreateRoot}
        >
          {t('新建部门')}
        </Button>
      </div>

      <div className='flex-1 overflow-y-auto max-h-[600px]'>
        <Tree
          treeData={treeData}
          value={String(selectedDeptId || 0)}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={(val) => {
            onSelectDept(Number(val));
          }}
          renderLabel={(label, item) => renderLabel(label, item.raw)}
        />
      </div>

      <DepartmentModal
        visible={showDeptModal}
        editingDept={editingDept}
        parentDeptId={parentDeptId}
        onClose={() => setShowDeptModal(false)}
        onSuccess={() => {
          setShowDeptModal(false);
          loadTree();
        }}
        t={t}
      />
    </div>
  );
};

export default DepartmentTree;
