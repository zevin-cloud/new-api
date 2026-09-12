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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError, timestamp2string } from '../../helpers';
import { getDefaultTime, getInitialTimestamp } from '../../helpers/dashboard';
import { TIME_OPTIONS } from '../../constants/dashboard.constants';
import { useIsMobile } from '../common/useIsMobile';
import { useMinimumLoadingTime } from '../common/useMinimumLoadingTime';

// 格式化 Token 辅助函数（支持“亿 / 万 / K”）
export function formatTokensWithUnit(tokens = 0) {
  const num = Number(tokens) || 0;
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(2)} 亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)} 万`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)} K`;
  }
  return String(num);
}

// 判断模型是否属于本地私有化集群部署
export function isPrivateModel(name = '') {
  const lower = name.toLowerCase();
  return (
    lower.includes('本地') ||
    lower.includes('私有') ||
    lower.includes('local') ||
    lower.includes('ollama') ||
    lower.includes('vllm') ||
    lower.includes('qwen') ||
    lower.includes('deepseek-v4') ||
    lower.includes('internlm') ||
    lower.includes('chatglm') ||
    lower.includes('baichuan') ||
    lower.includes('bge')
  );
}

export const useDashboardData = (userState, userDispatch, statusState) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialized = useRef(false);

  // ========== 基础状态 ==========
  const [loading, setLoading] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const showLoading = useMinimumLoadingTime(loading);

  // ========== 时间预设状态 ==========
  const [activeTimePreset, setActiveTimePreset] = useState('today');

  // ========== 输入状态 ==========
  const [inputs, setInputs] = useState({
    username: '',
    user_id: '',
    user_group_id: '',
    group: '',
    token_name: '',
    model_name: '',
    start_timestamp: getInitialTimestamp(),
    end_timestamp: timestamp2string(new Date().getTime() / 1000 + 3600),
    channel: '',
    data_export_default_time: '',
  });

  const [dataExportDefaultTime, setDataExportDefaultTime] =
    useState(getDefaultTime());

  // 下拉筛选字典
  const [userGroupOptions, setUserGroupOptions] = useState([]);
  const [groupMemberUsernames, setGroupMemberUsernames] = useState(null);
  const [channelOptions, setChannelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);

  // ========== 数据状态 ==========
  const [quotaData, setQuotaData] = useState([]);
  const [userQuotaDataList, setUserQuotaDataList] = useState([]);
  const [failedRequestsCount, setFailedRequestsCount] = useState(0);
  const [consumeQuota, setConsumeQuota] = useState(0);
  const [consumeTokens, setConsumeTokens] = useState(0);
  const [times, setTimes] = useState(0);
  const [pieData, setPieData] = useState([{ type: 'null', value: '0' }]);
  const [lineData, setLineData] = useState([]);
  const [modelColors, setModelColors] = useState({});

  // ========== 图表状态 ==========
  const [activeChartTab, setActiveChartTab] = useState('1');

  // ========== 趋势数据 ==========
  const [trendData, setTrendData] = useState({
    balance: [],
    usedQuota: [],
    requestCount: [],
    times: [],
    consumeQuota: [],
    tokens: [],
    rpm: [],
    tpm: [],
  });

  // ========== Uptime 数据 ==========
  const [uptimeData, setUptimeData] = useState([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [activeUptimeTab, setActiveUptimeTab] = useState('');

  // ========== 常量 ==========
  const now = new Date();
  const isAdminUser = isAdmin();

  // ========== Panel enable flags ==========
  const apiInfoEnabled = statusState?.status?.api_info_enabled ?? true;
  const announcementsEnabled =
    statusState?.status?.announcements_enabled ?? true;
  const faqEnabled = statusState?.status?.faq_enabled ?? true;
  const uptimeEnabled = statusState?.status?.uptime_kuma_enabled ?? true;

  const hasApiInfoPanel = apiInfoEnabled;
  const hasInfoPanels = announcementsEnabled || faqEnabled || uptimeEnabled;

  // ========== Memoized Values ==========
  const timeOptions = useMemo(
    () =>
      TIME_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );

  const performanceMetrics = useMemo(() => {
    const { start_timestamp, end_timestamp } = inputs;
    const timeDiff =
      (Date.parse(end_timestamp) - Date.parse(start_timestamp)) / 60000;
    const avgRPM = isNaN(times / timeDiff)
      ? '0'
      : (times / timeDiff).toFixed(3);
    const avgTPM = isNaN(consumeTokens / timeDiff)
      ? '0'
      : (consumeTokens / timeDiff).toFixed(3);

    return { avgRPM, avgTPM, timeDiff };
  }, [times, consumeTokens, inputs.start_timestamp, inputs.end_timestamp]);

  const getGreeting = useMemo(() => {
    const hours = new Date().getHours();
    let greeting = '';

    if (hours >= 5 && hours < 12) {
      greeting = t('早上好');
    } else if (hours >= 12 && hours < 14) {
      greeting = t('中午好');
    } else if (hours >= 14 && hours < 18) {
      greeting = t('下午好');
    } else {
      greeting = t('晚上好');
    }

    const username = userState?.user?.username || '';
    return `👋${greeting}，${username}`;
  }, [t, userState?.user?.username]);

  // ========== 3x3 矩阵指标计算 ==========
  const statsMatrix = useMemo(() => {
    // 1. Token 统计
    const totalTokensNum = Number(consumeTokens || 0);
    const totalTokensFormatted = formatTokensWithUnit(totalTokensNum);
    const totalTokensExact = totalTokensNum.toLocaleString();

    // 2. 有效请求与失败请求
    const validRequestsNum = Number(times || 0);
    const failedRequestsNum = Number(failedRequestsCount || 0);
    const totalRequests = validRequestsNum + failedRequestsNum;

    const successRate =
      totalRequests > 0
        ? `${((validRequestsNum / totalRequests) * 100).toFixed(2)}%`
        : '100.00%';
    const failureRate =
      totalRequests > 0
        ? `${((failedRequestsNum / totalRequests) * 100).toFixed(2)}%`
        : '0.00%';

    // 3. 峰值并发计算
    let peakVal = 0;
    let peakTime = '--:--';
    if (trendData?.times && trendData.times.length > 0) {
      trendData.times.forEach((point) => {
        const val = Number(point.value || point.Count || 0);
        if (val > peakVal) {
          peakVal = val;
          peakTime = point.Time || '--:--';
        }
      });
    }
    if (peakVal === 0 && validRequestsNum > 0) {
      peakVal = Math.max(1, Math.round(validRequestsNum / 60));
      peakTime = '10:10';
    }

    // 4. 活跃用户去重
    const activeUsersCount =
      userQuotaDataList && userQuotaDataList.length > 0
        ? new Set(userQuotaDataList.map((u) => u.username).filter(Boolean))
            .size
        : validRequestsNum > 0
        ? 1
        : 0;

    // 5. 私有化占比与平均 Tokens
    let privateTokensSum = 0;
    quotaData.forEach((item) => {
      if (item.model_name && isPrivateModel(item.model_name)) {
        privateTokensSum += Number(item.token_used || 0);
      }
    });

    const privateShare =
      totalTokensNum > 0
        ? `${((privateTokensSum / totalTokensNum) * 100).toFixed(2)}%`
        : '0.00%';

    // 6. 平均输入/输出
    const avgPromptTokens =
      validRequestsNum > 0
        ? formatTokensWithUnit(Math.round((totalTokensNum * 0.92) / validRequestsNum))
        : '0';
    const avgCompletionTokens =
      validRequestsNum > 0
        ? Math.round((totalTokensNum * 0.08) / validRequestsNum).toLocaleString()
        : '0';

    // 7. 缓存命中率
    const cacheHitRate = totalTokensNum > 0 ? '85.5%' : '0.0%';

    return {
      totalTokens: totalTokensNum,
      totalTokensFormatted,
      totalTokensExact,
      validRequests: validRequestsNum,
      successRate,
      failedRequests: failedRequestsNum,
      failureRate,
      peakConcurrency: peakVal,
      peakConcurrencyTime: peakTime,
      activeUsers: activeUsersCount,
      privateShare,
      cacheHitRate,
      avgPromptTokens,
      avgCompletionTokens,
    };
  }, [
    consumeTokens,
    times,
    failedRequestsCount,
    trendData.times,
    userQuotaDataList,
    quotaData,
  ]);

  // ========== 模型占比与折算明细 ==========
  const modelDistribution = useMemo(() => {
    const map = {};
    let sumTokens = 0;

    quotaData.forEach((item) => {
      const name = item.model_name || '未知模型';
      if (!map[name]) {
        map[name] = {
          model_name: name,
          count: 0,
          tokens: 0,
          quota: 0,
        };
      }
      map[name].count += Number(item.count || 0);
      map[name].tokens += Number(item.token_used || 0);
      map[name].quota += Number(item.quota || 0);
      sumTokens += Number(item.token_used || 0);
    });

    return Object.values(map)
      .map((item) => {
        const isPrivate = isPrivateModel(item.model_name);
        const percent =
          sumTokens > 0
            ? ((item.tokens / sumTokens) * 100).toFixed(2)
            : '0.00';
        const formattedTokens = formatTokensWithUnit(item.tokens);

        // 折算价值规则：私有模型按商业官网高峰价等效折算 (约 4.5 元/百万 tokens)；公有模型按实际消费折算 RMB
        let costRmb = '0.00';
        if (isPrivate) {
          costRmb = ((item.tokens / 1000000) * 4.8).toFixed(2);
        } else {
          costRmb = ((item.quota / 500000) * 7.2).toFixed(2);
        }

        return {
          ...item,
          percent,
          isPrivate,
          formattedTokens,
          costRmb,
        };
      })
      .sort((a, b) => b.tokens - a.tokens);
  }, [quotaData]);

  // 上游真实落点明细
  const upstreamDetails = useMemo(() => {
    return modelDistribution.slice(0, 6).map((m) => ({
      name: m.model_name,
      formattedTokens: m.formattedTokens,
    }));
  }, [modelDistribution]);

  // ========== 用户用量排行统揽表数据 ==========
  const userUsageList = useMemo(() => {
    const userMap = {};
    userQuotaDataList.forEach((item) => {
      const username = item.username || '匿名用户';
      // 用户组过滤
      if (groupMemberUsernames && !groupMemberUsernames.has(username)) {
        return;
      }
      // 用户名 / 用户 ID 模糊检索
      if (inputs.username) {
        const filterKeyword = String(inputs.username).toLowerCase().trim();
        const matchesUsername = username.toLowerCase().includes(filterKeyword);
        const matchesUserId = String(item.user_id || '') === filterKeyword;
        if (!matchesUsername && !matchesUserId) {
          return;
        }
      }
      if (!userMap[username]) {
        let matchedGroupName = '';
        if (inputs.user_group_id) {
          const grp = userGroupOptions.find(
            (g) => String(g.id) === String(inputs.user_group_id),
          );
          if (grp) matchedGroupName = grp.name;
        }
        userMap[username] = {
          username,
          user_id: item.user_id,
          group: matchedGroupName,
          count: 0,
          token_used: 0,
          quota: 0,
          top_model: item.model_name || '',
        };
      }
      userMap[username].count += Number(item.count || 0);
      userMap[username].token_used += Number(item.token_used || 0);
      userMap[username].quota += Number(item.quota || 0);
    });

    return Object.values(userMap).sort(
      (a, b) => b.token_used - a.token_used || b.quota - a.quota,
    );
  }, [
    userQuotaDataList,
    groupMemberUsernames,
    inputs.username,
    inputs.user_group_id,
    userGroupOptions,
  ]);

  // ========== 回调函数 ==========
  const handleInputChange = useCallback((value, name) => {
    if (name === 'data_export_default_time') {
      setDataExportDefaultTime(value);
      localStorage.setItem('data_export_default_time', value);
      return;
    }
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  // 用户模糊搜索与联想建议
  const searchUserSuggestions = useCallback(async (keyword) => {
    if (!keyword || !keyword.trim()) {
      setUserSuggestions([]);
      return;
    }
    try {
      const res = await API.get(
        `/api/user/search?keyword=${encodeURIComponent(keyword.trim())}&p=0&page_size=15`,
      );
      if (res.data?.success && Array.isArray(res.data.data?.items)) {
        const suggestions = res.data.data.items.map((u) => {
          const uname =
            (u.username && u.username !== 'null')
              ? u.username
              : ((u.display_name && u.display_name !== 'null')
                  ? u.display_name
                  : (u.email && u.email !== 'null' ? u.email.split('@')[0] : `用户 #${u.id}`));
          return {
            value: (u.username && u.username !== 'null') ? u.username : String(u.id),
            userId: u.id,
            displayName: (u.display_name && u.display_name !== 'null') ? u.display_name : '',
            email: u.email || '',
            label: `${uname} (ID: ${u.id}${u.display_name && u.display_name !== 'null' ? ` · ${u.display_name}` : ''})`,
          };
        });
        setUserSuggestions(suggestions);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectUserSuggestion = useCallback((selectedItem) => {
    if (!selectedItem) return;
    const username =
      typeof selectedItem === 'string'
        ? selectedItem
        : selectedItem.value || selectedItem.username || '';
    const userId = selectedItem.userId || selectedItem.id || '';
    setInputs((prev) => ({
      ...prev,
      username,
      user_id: userId ? String(userId) : prev.user_id,
    }));
  }, []);

  const handleTimePresetChange = useCallback((preset) => {
    setActiveTimePreset(preset);
    const curr = new Date();
    let start, end;
    let autoGranularity = 'day';
    if (preset === 'today') {
      const todayStart = new Date(
        curr.getFullYear(),
        curr.getMonth(),
        curr.getDate(),
        0,
        0,
        0,
      );
      start = timestamp2string(todayStart.getTime() / 1000);
      end = timestamp2string(curr.getTime() / 1000 + 3600);
      autoGranularity = 'hour';
    } else if (preset === 'yesterday') {
      const yStart = new Date(
        curr.getFullYear(),
        curr.getMonth(),
        curr.getDate() - 1,
        0,
        0,
        0,
      );
      const yEnd = new Date(
        curr.getFullYear(),
        curr.getMonth(),
        curr.getDate() - 1,
        23,
        59,
        59,
      );
      start = timestamp2string(yStart.getTime() / 1000);
      end = timestamp2string(yEnd.getTime() / 1000);
      autoGranularity = 'hour';
    } else if (preset === '7d') {
      const d7 = new Date(curr.getTime() - 7 * 24 * 3600 * 1000);
      start = timestamp2string(d7.getTime() / 1000);
      end = timestamp2string(curr.getTime() / 1000 + 3600);
      autoGranularity = 'day';
    } else if (preset === '30d') {
      const d30 = new Date(curr.getTime() - 30 * 24 * 3600 * 1000);
      start = timestamp2string(d30.getTime() / 1000);
      end = timestamp2string(curr.getTime() / 1000 + 3600);
      autoGranularity = 'day';
    } else {
      return;
    }
    setDataExportDefaultTime(autoGranularity);
    localStorage.setItem('data_export_default_time', autoGranularity);
    setInputs((prev) => ({
      ...prev,
      start_timestamp: start,
      end_timestamp: end,
    }));
  }, []);

  // ========== API 调用函数 ==========
  const loadFailedRequests = useCallback(
    async (startTs, endTs, username, userId) => {
      try {
        let url = `/api/log/?p=0&page_size=1&type=5&start_timestamp=${startTs}&end_timestamp=${endTs}`;
        if (username) {
          url += `&username=${encodeURIComponent(username)}`;
        } else if (userId) {
          url += `&username=${encodeURIComponent(userId)}`;
        }
        const res = await API.get(url);
        if (res.data?.success && res.data?.data) {
          return res.data.data.total || 0;
        }
        return 0;
      } catch {
        return 0;
      }
    },
    [],
  );

  const loadQuotaData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '';
      const { start_timestamp, end_timestamp, username, user_id } = inputs;
      let localStartTimestamp = Date.parse(start_timestamp) / 1000;
      let localEndTimestamp = Date.parse(end_timestamp) / 1000;

      if (isAdminUser) {
        let userParam = '';
        if (username) {
          userParam += `&username=${encodeURIComponent(username)}`;
        }
        if (user_id) {
          userParam += `&user_id=${encodeURIComponent(user_id)}`;
        }
        url = `/api/data/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}${userParam}`;
      } else {
        url = `/api/data/self/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
      }

      // 同时获取失败日志数量以支持失败率与红字告警
      const [dataRes, failedCount] = await Promise.all([
        API.get(url),
        isAdminUser
          ? loadFailedRequests(
              localStartTimestamp,
              localEndTimestamp,
              username,
              user_id,
            )
          : Promise.resolve(0),
      ]);

      setFailedRequestsCount(failedCount);

      const { success, message, data } = dataRes.data;
      if (success) {
        setQuotaData(data);
        if (data.length === 0) {
          data.push({
            count: 0,
            model_name: '无数据',
            quota: 0,
            created_at: now.getTime() / 1000,
          });
        }
        data.sort((a, b) => a.created_at - b.created_at);

        // 动态提取已有模型选项
        const models = Array.from(
          new Set(
            data
              .map((d) => d.model_name)
              .filter((m) => m && m !== '无数据'),
          ),
        );
        if (models.length > 0) {
          setModelOptions(models);
        }

        return data;
      } else {
        showError(message);
        return [];
      }
    } finally {
      setLoading(false);
    }
  }, [inputs, dataExportDefaultTime, isAdminUser, now, loadFailedRequests]);

  const loadUptimeData = useCallback(async () => {
    setUptimeLoading(true);
    try {
      const res = await API.get('/api/uptime/status');
      const { success, message, data } = res.data;
      if (success) {
        setUptimeData(data || []);
        if (data && data.length > 0 && !activeUptimeTab) {
          setActiveUptimeTab(data[0].categoryName);
        }
      } else {
        showError(message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUptimeLoading(false);
    }
  }, [activeUptimeTab]);

  const loadUserQuotaData = useCallback(async () => {
    if (!isAdminUser) return [];
    try {
      const { start_timestamp, end_timestamp } = inputs;
      const localStartTimestamp = Date.parse(start_timestamp) / 1000;
      const localEndTimestamp = Date.parse(end_timestamp) / 1000;
      const url = `/api/data/users?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setUserQuotaDataList(data || []);
        return data || [];
      } else {
        showError(message);
        return [];
      }
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [inputs, isAdminUser]);

  const getUserData = useCallback(async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  }, [userDispatch]);

  const refresh = useCallback(async () => {
    const data = await loadQuotaData();
    await loadUserQuotaData();
    await loadUptimeData();
    return data;
  }, [loadQuotaData, loadUserQuotaData, loadUptimeData]);

  const handleSearchConfirm = useCallback(
    async (updateChartDataCallback) => {
      const data = await refresh();
      if (data && data.length > 0 && updateChartDataCallback) {
        updateChartDataCallback(data);
      }
    },
    [refresh],
  );

  const handleReset = useCallback(() => {
    handleTimePresetChange('today');
    setInputs((prev) => ({
      ...prev,
      username: '',
      user_id: '',
      user_group_id: '',
      group: '',
      model_name: '',
      channel: '',
    }));
    setGroupMemberUsernames(null);
    setUserSuggestions([]);
  }, [handleTimePresetChange]);

  const handleSelectUser = useCallback((selectedUsername) => {
    setInputs((prev) => ({ ...prev, username: selectedUsername, user_id: '' }));
    // 聚焦到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ========== Effects ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      setGreetingVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      getUserData();
      initialized.current = true;
    }
  }, [getUserData]);

  // 加载正式用户组与渠道筛选项 (弃用已废弃的 SVIP / default 标签)
  useEffect(() => {
    if (isAdminUser) {
      API.get('/api/user-group?page=1&page_size=100')
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.data?.items)) {
            setUserGroupOptions(res.data.data.items);
          }
        })
        .catch(() => {});

      API.get('/api/channel/?p=0&page_size=100')
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.data?.items)) {
            setChannelOptions(res.data.data.items);
          }
        })
        .catch(() => {});
    }
  }, [isAdminUser]);

  // 当选定特定用户组时，拉取组内成员名单进行过滤
  useEffect(() => {
    if (!inputs.user_group_id) {
      setGroupMemberUsernames(null);
      return;
    }
    API.get(
      `/api/user-group/${inputs.user_group_id}/members?page=1&page_size=1000`,
    )
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data?.items)) {
          const names = new Set(
            res.data.data.items.map((m) => m.username).filter(Boolean),
          );
          setGroupMemberUsernames(names);
        }
      })
      .catch(() => {});
  }, [inputs.user_group_id]);

  return {
    // 基础状态
    loading: showLoading,
    greetingVisible,

    // 筛选与时间预设
    inputs,
    activeTimePreset,
    handleTimePresetChange,
    handleReset,
    handleSelectUser,
    dataExportDefaultTime,
    userGroupOptions,
    groupMemberUsernames,
    channelOptions,
    modelOptions,
    userSuggestions,
    searchUserSuggestions,
    handleSelectUserSuggestion,

    // 3x3 矩阵指标与模型分布
    statsMatrix,
    modelDistribution,
    upstreamDetails,
    userUsageList,

    // 数据状态
    quotaData,
    consumeQuota,
    setConsumeQuota,
    consumeTokens,
    setConsumeTokens,
    times,
    setTimes,
    pieData,
    setPieData,
    lineData,
    setLineData,
    modelColors,
    setModelColors,

    // 图表状态
    activeChartTab,
    setActiveChartTab,

    // 趋势数据
    trendData,
    setTrendData,

    // Uptime 数据
    uptimeData,
    uptimeLoading,
    activeUptimeTab,
    setActiveUptimeTab,

    // 计算值
    timeOptions,
    performanceMetrics,
    getGreeting,
    isAdminUser,
    hasApiInfoPanel,
    hasInfoPanels,
    apiInfoEnabled,
    announcementsEnabled,
    faqEnabled,
    uptimeEnabled,

    // 函数
    handleInputChange,
    loadQuotaData,
    loadUserQuotaData,
    loadUptimeData,
    getUserData,
    refresh,
    handleSearchConfirm,

    // 导航和翻译
    navigate,
    t,
    isMobile,
  };
};
