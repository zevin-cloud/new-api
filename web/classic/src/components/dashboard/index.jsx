/*
Copyright (C) 2025-2026 QuantumNous

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

import React, { useContext, useEffect } from 'react';
import { getRelativeTime, API } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

import DashboardHeader from './DashboardHeader';
import DashboardFilterBar from './DashboardFilterBar';
import StatsCards from './StatsCards';
import ModelCostPanel from './ModelCostPanel';
import UserUsageTable from './UserUsageTable';
import ChartsPanel from './ChartsPanel';
import ApiInfoPanel from './ApiInfoPanel';
import AnnouncementsPanel from './AnnouncementsPanel';
import FaqPanel from './FaqPanel';
import UptimePanel from './UptimePanel';

import { useDashboardData } from '../../hooks/dashboard/useDashboardData';
import { useDashboardCharts } from '../../hooks/dashboard/useDashboardCharts';

import {
  CHART_CONFIG,
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  ILLUSTRATION_SIZE,
  ANNOUNCEMENT_LEGEND_DATA,
  UPTIME_STATUS_MAP,
} from '../../constants/dashboard.constants';
import {
  handleCopyUrl,
  handleSpeedTest,
  getUptimeStatusColor,
  getUptimeStatusText,
  renderMonitorList,
} from '../../helpers/dashboard';

const Dashboard = () => {
  // ========== Context ==========
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);

  // ========== 主要数据管理 ==========
  const dashboardData = useDashboardData(userState, userDispatch, statusState);

  // ========== 图表管理 ==========
  const dashboardCharts = useDashboardCharts(
    dashboardData.dataExportDefaultTime,
    dashboardData.setTrendData,
    dashboardData.setConsumeQuota,
    dashboardData.setTimes,
    dashboardData.setConsumeTokens,
    dashboardData.setPieData,
    dashboardData.setLineData,
    dashboardData.setModelColors,
    dashboardData.t,
  );

  // ========== 数据加载处理 ==========
  const loadUserData = async () => {
    if (dashboardData.isAdminUser) {
      const userData = await dashboardData.loadUserQuotaData();
      if (userData && userData.length > 0) {
        dashboardCharts.updateUserChartData(userData);
      }
    }
  };

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, data } = res.data;
      if (success && statusDispatch) {
        statusDispatch({ type: 'set', payload: data });
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const initChart = async () => {
    loadStatus().catch(console.error);
    await dashboardData.loadQuotaData().then((data) => {
      if (data && data.length > 0) {
        dashboardCharts.updateChartData(data);
      }
    });
    await loadUserData();
    await dashboardData.loadUptimeData();
  };

  const handleRefresh = async () => {
    loadStatus().catch(console.error);
    const data = await dashboardData.refresh();
    if (data && data.length > 0) {
      dashboardCharts.updateChartData(data);
    }
    await loadUserData();
  };

  const handleScrollToUsers = () => {
    const tableEl = document.getElementById('user-usage-table-card');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ========== 数据准备 ==========
  const apiInfoData = statusState?.status?.api_info || [];
  const announcementData = (statusState?.status?.announcements || []).map(
    (item) => {
      const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
      const absoluteTime =
        pubDate && !isNaN(pubDate.getTime())
          ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')} ${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`
          : item?.publishDate || '';
      const relativeTime = getRelativeTime(item.publishDate);
      return {
        ...item,
        time: absoluteTime,
        relative: relativeTime,
      };
    },
  );
  const faqData = statusState?.status?.faq || [];

  const uptimeLegendData = Object.entries(UPTIME_STATUS_MAP).map(
    ([status, info]) => ({
      status: Number(status),
      color: info.color,
      label: dashboardData.t(info.label),
    }),
  );

  // ========== Effects ==========
  useEffect(() => {
    initChart();
  }, []);

  return (
    <div className='h-full'>
      {/* 头部：标题、汇报日期与刷新 */}
      <DashboardHeader
        getGreeting={dashboardData.getGreeting}
        greetingVisible={dashboardData.greetingVisible}
        refresh={handleRefresh}
        loading={dashboardData.loading}
        isAdminUser={dashboardData.isAdminUser}
        t={dashboardData.t}
      />

      {/* 常驻多维筛选栏 (今日/昨日/7天/30天、时间粒度、用户、用户组、模型、渠道) */}
      <DashboardFilterBar
        inputs={dashboardData.inputs}
        handleInputChange={dashboardData.handleInputChange}
        handleTimePresetChange={(preset) => {
          dashboardData.handleTimePresetChange(preset);
          setTimeout(() => handleRefresh(), 50);
        }}
        activeTimePreset={dashboardData.activeTimePreset}
        userGroupOptions={dashboardData.userGroupOptions}
        userSuggestions={dashboardData.userSuggestions}
        onSearchUserSuggestions={dashboardData.searchUserSuggestions}
        onSelectUserSuggestion={dashboardData.handleSelectUserSuggestion}
        modelOptions={dashboardData.modelOptions}
        channelOptions={dashboardData.channelOptions}
        onSearch={handleRefresh}
        onReset={() => {
          dashboardData.handleReset();
          setTimeout(() => handleRefresh(), 50);
        }}
        loading={dashboardData.loading}
        isAdminUser={dashboardData.isAdminUser}
        t={dashboardData.t}
      />

      {/* 3×3 关键运营质量与价值矩阵九宫格 */}
      <StatsCards
        stats={dashboardData.statsMatrix}
        loading={dashboardData.loading}
        isAdminUser={dashboardData.isAdminUser}
        onUserCardClick={handleScrollToUsers}
      />

      {/* 模型占比与算力价值折算面板 (量化自建算力 ROI 与公私模型分布) */}
      {dashboardData.isAdminUser && (
        <ModelCostPanel
          modelDistribution={dashboardData.modelDistribution}
          privateShare={dashboardData.statsMatrix.privateShare}
          failureRate={dashboardData.statsMatrix.failureRate}
          upstreamDetails={dashboardData.upstreamDetails}
          totalTokens={dashboardData.statsMatrix.totalTokens}
          t={dashboardData.t}
        />
      )}

      {/* API信息与趋势图表面板 */}
      <div className='mb-4'>
        <div
          className={`grid grid-cols-1 gap-4 ${
            dashboardData.hasApiInfoPanel && !dashboardData.isAdminUser
              ? 'lg:grid-cols-4'
              : ''
          }`}
        >
          <ChartsPanel
            activeChartTab={dashboardData.activeChartTab}
            setActiveChartTab={dashboardData.setActiveChartTab}
            spec_line={dashboardCharts.spec_line}
            spec_model_line={dashboardCharts.spec_model_line}
            spec_pie={dashboardCharts.spec_pie}
            spec_rank_bar={dashboardCharts.spec_rank_bar}
            spec_user_rank={dashboardCharts.spec_user_rank}
            spec_user_trend={dashboardCharts.spec_user_trend}
            isAdminUser={dashboardData.isAdminUser}
            CARD_PROPS={CARD_PROPS}
            CHART_CONFIG={CHART_CONFIG}
            FLEX_CENTER_GAP2={FLEX_CENTER_GAP2}
            hasApiInfoPanel={
              dashboardData.hasApiInfoPanel && !dashboardData.isAdminUser
            }
            t={dashboardData.t}
          />

          {dashboardData.hasApiInfoPanel && !dashboardData.isAdminUser && (
            <ApiInfoPanel
              apiInfoData={apiInfoData}
              handleCopyUrl={(url) => handleCopyUrl(url, dashboardData.t)}
              handleSpeedTest={handleSpeedTest}
              CARD_PROPS={CARD_PROPS}
              FLEX_CENTER_GAP2={FLEX_CENTER_GAP2}
              ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
              t={dashboardData.t}
            />
          )}
        </div>
      </div>

      {/* 全网关用户用量排行统揽表 (管理员视角下钻与统揽) */}
      {dashboardData.isAdminUser && (
        <UserUsageTable
          usersData={dashboardData.userUsageList}
          loading={dashboardData.loading}
          onSelectUser={(username) => {
            dashboardData.handleSelectUser(username);
            setTimeout(() => handleRefresh(), 50);
          }}
          t={dashboardData.t}
        />
      )}

      {/* 系统公告和常见问答卡片 */}
      {dashboardData.hasInfoPanels && (
        <div className='mb-4'>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-4'>
            {/* 公告卡片 */}
            {dashboardData.announcementsEnabled && (
              <AnnouncementsPanel
                announcementData={announcementData}
                announcementLegendData={ANNOUNCEMENT_LEGEND_DATA.map(
                  (item) => ({
                    ...item,
                    label: dashboardData.t(item.label),
                  }),
                )}
                CARD_PROPS={CARD_PROPS}
                ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
                t={dashboardData.t}
              />
            )}

            {/* 常见问答卡片 */}
            {dashboardData.faqEnabled && (
              <FaqPanel
                faqData={faqData}
                CARD_PROPS={CARD_PROPS}
                FLEX_CENTER_GAP2={FLEX_CENTER_GAP2}
                ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
                t={dashboardData.t}
              />
            )}

            {/* 服务可用性卡片 */}
            {dashboardData.uptimeEnabled && (
              <UptimePanel
                uptimeData={dashboardData.uptimeData}
                uptimeLoading={dashboardData.uptimeLoading}
                activeUptimeTab={dashboardData.activeUptimeTab}
                setActiveUptimeTab={dashboardData.setActiveUptimeTab}
                loadUptimeData={dashboardData.loadUptimeData}
                uptimeLegendData={uptimeLegendData}
                renderMonitorList={(monitors) =>
                  renderMonitorList(
                    monitors,
                    (status) => getUptimeStatusColor(status, UPTIME_STATUS_MAP),
                    (status) =>
                      getUptimeStatusText(
                        status,
                        UPTIME_STATUS_MAP,
                        dashboardData.t,
                      ),
                    dashboardData.t,
                  )
                }
                CARD_PROPS={CARD_PROPS}
                ILLUSTRATION_SIZE={ILLUSTRATION_SIZE}
                t={dashboardData.t}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
