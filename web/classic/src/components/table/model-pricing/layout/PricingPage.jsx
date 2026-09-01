/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState } from 'react';
import { Layout, ImagePreview, Tabs, TabPane } from '@douyinfe/semi-ui';
import PricingSidebar from './PricingSidebar';
import PricingContent from './content/PricingContent';
import ModelDetailSideSheet from '../modal/ModelDetailSideSheet';
import RequestAccessModal from '../modal/RequestAccessModal';
import MyRequestsView from '../view/MyRequestsView';
import TokensPage from '../../tokens';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const PricingPage = () => {
  const pricingData = useModelPricingData();
  const { Sider, Content } = Layout;
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('models');
  const [showRatio, setShowRatio] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const allProps = {
    ...pricingData,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
  };

  return (
    <div className='bg-white min-h-[calc(100vh-60px)] flex flex-col'>
      <div className='px-4 pt-2 border-b border-[var(--semi-color-border)]'>
        <Tabs
          type='line'
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
        >
          <TabPane tab={pricingData.t('全部模型')} itemKey='models' />
          <TabPane tab={pricingData.t('我的申请')} itemKey='my_requests' />
          <TabPane tab={pricingData.t('我的 API Key')} itemKey='my_tokens' />
        </Tabs>
      </div>

      <div className='flex-1'>
        {activeTab === 'models' && (
          <Layout className='pricing-layout'>
            {!isMobile && (
              <Sider className='pricing-scroll-hide pricing-sidebar'>
                <PricingSidebar {...allProps} />
              </Sider>
            )}

            <Content className='pricing-scroll-hide pricing-content'>
              <PricingContent
                {...allProps}
                isMobile={isMobile}
                sidebarProps={allProps}
              />
            </Content>
          </Layout>
        )}

        {activeTab === 'my_requests' && (
          <div className='p-4'>
            <MyRequestsView t={pricingData.t} />
          </div>
        )}

        {activeTab === 'my_tokens' && (
          <div className='p-4'>
            <TokensPage />
          </div>
        )}
      </div>

      <ImagePreview
        src={pricingData.modalImageUrl}
        visible={pricingData.isModalOpenurl}
        onVisibleChange={(visible) => pricingData.setIsModalOpenurl(visible)}
      />

      <ModelDetailSideSheet
        visible={pricingData.showModelDetail}
        onClose={pricingData.closeModelDetail}
        modelData={pricingData.selectedModel}
        groupRatio={pricingData.groupRatio}
        usableGroup={pricingData.usableGroup}
        currency={pricingData.currency}
        siteDisplayType={pricingData.siteDisplayType}
        tokenUnit={pricingData.tokenUnit}
        displayPrice={pricingData.displayPrice}
        showRatio={allProps.showRatio}
        vendorsMap={pricingData.vendorsMap}
        endpointMap={pricingData.endpointMap}
        autoGroups={pricingData.autoGroups}
        t={pricingData.t}
      />

      <RequestAccessModal
        visible={pricingData.showRequestModal}
        modelName={pricingData.requestModalModel}
        onClose={pricingData.closeRequestAccess}
        onSuccess={() => {
          pricingData.closeRequestAccess();
          pricingData.refresh();
        }}
        t={pricingData.t}
      />
    </div>
  );
};

export default PricingPage;
