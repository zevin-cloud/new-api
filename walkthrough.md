# 企业级 AI 网关改造实施记录

本文档完整记录从商业 Relay 代理站转型为**企业级内部统一 AI 网关 / 算力治理平台**的改造全过程，涵盖商业转售元素净化、在途并发流控、【授权管理】企业权限/模型/预算全面统一治理，以及**彻底解耦与移除渠道分组标签、将渠道调度全面归纳为状态/优先级/权重控制**。

---

## 零、 模型管理集成定价设置（方案b）与通用列设置拖拽排序（最新）

### 1. 模型管理集成定价设置（方案b）
* **背景与需求**：
  此前模型定价（按 Token 计费倍率、按次调用固定价格）仅能在【系统设置】->【倍率设置】中的大 JSON 或独立定价编辑器中统一管理，模型管理页面无法直接查看和配置单个模型的计费规则。
* **架构方案（方案b）**：
  直接在【模型管理】编辑/创建侧边栏（[EditModelModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/models/modals/EditModelModal.jsx)）中集成专属的“模型定价设置”卡片（[ModelPricingSection.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/models/components/ModelPricingSection.jsx)），并与系统设置 (`/api/option/` 下的 `ModelRatio`、`ModelPrice`、`CompletionRatio` 等）**实时双向绑定与无缝同步**：
  1. **直观双模式切换**：
     - **按量计费 (按 Token 计费)**：输入价格（`$/1M tokens`）、输出价格（`$/1M tokens`），实时换算对应模型倍率（`model_ratio = input_price / 2`）与补全倍率（`completion_ratio = completion_price / input_price`）。
     - **按次计费 (按请求固定扣费)**：输入固定金额（`$/次`）。
     - **高级价格项（折叠面板）**：支持细粒度配置缓存命中价格、缓存写入价格、音频输入/输出价格以及图片倍率。
  2. **智能状态与一键重置**：
     - 自动检测并显示当前模型状态徽章：`[已自定义定价]`（绿色）、`[系统默认倍率]`（蓝色）或 `[未设置定价]`（灰色）。
     - 提供“清除自定义并重置”按钮，点击后恢复为系统内置默认定价，并在提交时自动清除系统自定义倍率选项中的对应键值。
  3. **实时双向同步机制**：
     - 打开抽屉时拉取 `/api/option/` 与 `/api/pricing`，解析并自动预填。
     - 提交时仅向 `/api/option/` 提交真正发生变动的定价项；若用户未更改定价且模型使用系统默认值，则不污染自定义选项表。
     - 若模型名称被重命名，自动清理旧模型名称对应的定价项，并在新名称下写入对应定价。

### 2. 通用表格列自定义排序与显示设置
* **背景与需求**：
  此前表格列设置仅渠道管理具备基础显隐功能且样式与其他页面不统一，缺少列拖拽调序、上移/下移微调能力，且不同表格（渠道、模型、用户等）代码重复。
* **改造内容**：
  1. **封装通用列控制器 Hook**（[useTableColumns.js](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/hooks/common/useTableColumns.js)）：
     - 统一管理列的可见性（`visibleKeys`）与列顺序（`columnOrder`）。
     - 基于 `localStorage` 进行跨会话持久化存储，支持一键重置为系统默认排列。
  2. **封装通用列配置弹窗组件**（[ColumnSelectorModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/common/table/ColumnSelectorModal.jsx)）：
     - 采用原生 HTML5 Drag & Drop 实现平滑流畅的拖拽排序，配合上移/下移图标按钮方便无障碍微调。
     - 深度适配 Semi-UI 设计系统与暗色模式主题变量（`var(--semi-color-*)`）。
     - 提供“全选/清空”与“恢复默认”快捷操作。
  3. **全量接入三大核心表格**：
     - **渠道管理**（[ChannelsTable.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/channels/ChannelsTable.jsx)）：全量接入，支持所有渠道信息列的自定义排序与显隐。
     - **模型管理**（[ModelsTable.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/models/ModelsTable.jsx) & [ModelsActions.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/models/ModelsActions.jsx)）：新增“列设置”入口与状态持久化。
     - **用户管理**（[UsersTable.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/users/UsersTable.jsx) & [UsersActions.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/users/UsersActions.jsx)）：新增“列设置”入口与状态持久化。

---

### 1. 问题背景与根本原因
* **痛点**：在 New-API 中使用 Codex 客户端渠道或 OpenAI 代理（如 CPA）测试 `gpt-image-2` 等生图模型时，报错：
  `model gpt-image-2 is only supported on /v1/images/generations and /v1/images/edits`
* **根因**：
  1. **Codex 适配器不支持生图**：[relay/channel/codex/adaptor.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/relay/channel/codex/adaptor.go) 原代码将 `ConvertImageRequest` 直接写死报错 `endpoint not supported`，且未配置生图上游路由。
  2. **测试未识别生图模型**：[controller/channel-test.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/controller/channel-test.go) 默认将 Codex 渠道测试强转为 `/v1/responses`，且缺少生图模型的自动检测，导致 `gpt-image-2` 兜底走 Chat 请求被打向 `/v1/chat/completions`。
  3. **模型规则库未收录新模型**：[common/model.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/common/model.go) 仅包含 `gpt-image-1`，未收录 `gpt-image-2` 及其系列前缀。

### 2. 改造内容
1. **Codex 渠道适配器完整支持生图**（[relay/channel/codex/adaptor.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/relay/channel/codex/adaptor.go)）：
   - `ConvertImageRequest`：接收并透传 `dto.ImageRequest`。
   - `GetRequestURL`：`RelayModeImagesGenerations` 路由至 `/backend-api/codex/images/generations`（若配置第三方代理地址则自适应 `/v1/images/generations`）。
   - `SetupRequestHeader`：自动注入 `User-Agent: codex-cli/0.153.4`，防止触发 Cloudflare 1010 拦截。
   - `DoResponse`：接入 `openai.OpenaiImageHandler` / `openai.OpenaiImageStreamHandler` 完成图像结果解析与额度扣费。
2. **规则库模型扩充**（[common/model.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/common/model.go)）：
   - `ImageGenerationModels` 增加 `gpt-image-2`、`gpt-image-`、`chatgpt-image-`，`IsImageGenerationModel` 自动识别所有生图模型。
3. **测试自动识别与路由修正**（[controller/channel-test.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/controller/channel-test.go)）：
   - `normalizeChannelTestEndpoint` 传入当前测试模型，遇生图模型优先保留为 `image-generation` 端点。
   - `buildTestRequest` 自动为生图模型构造标准 `dto.ImageRequest`，不再错误回退到 Chat。
4. **模型列表同步更新**：
   - [relay/channel/codex/constants.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/relay/channel/codex/constants.go) 与 [service/clientauth/manager.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/service/clientauth/manager.go) 增加 `gpt-image-2`，确保客户端授权与渠道配置均有一键选项。

### 3. 验证情况
- 单元测试：`go test -v -count=1 ./relay/channel/codex` 全部通过（包含生图 URL 路由与请求转换）。
- 单元测试：`go test -v -count=1 ./controller -run "TestNormalizeChannelTestEndpointImageModel|TestBuildTestRequestImageModel"` 全部通过。
- 模块独立性：`cd relaykit && GOWORK=off go build ./...` 校验通过。
- 服务构建与运行：主二进制成功编译，后台服务正常对外提供健康服务。

---

## 零、 渠道分组标签彻底移除与调度纯粹化（最新）

### 1. 架构目标与重构原则
- **彻底消除“渠道分组/标签”的冗余与混淆**：
  - “渠道分组”此前与优先级、权重、授权池功能重叠，造成创建渠道、授权管理及运营设置中的心智负担。
  - 系统自此**仅保留一个“组”的概念：【用户组】（User Group）**，100% 专用于企业组织架构（研发组、产品组、部门等）的模型授权与预算配额分配。
- **渠道调度的纯粹化法则**：
  - 渠道作为纯粹的上游连接基础设施，其调度完全由以下 3 个固有属性决定：
    1. **启用/禁用状态 (`Status`)**：决定渠道是否提供服务。
    2. **优先级 (`Priority`)**：降序排列。主备故障切换（Failover）完全由优先级驱动（高优先级故障时无缝顺延至次高优先级）。
    3. **权重 (`Weight`)**：同优先级渠道之间，通过加权随机算法进行加权轮询（Weighted Round-Robin）负载均衡。
- **数据库兼容底座保持稳定**：
  - 底层数据库 `abilities` 复合主键包含 `group` 列，后台创建渠道或更新渠道时自动回退为 `'default'`，屏蔽底层表结构差异，确保 SQLite / MySQL / PostgreSQL 跨库零迁移隐患。

### 2. 代码改造清单

#### 前端交互层 (`web/classic/`)
- [EditChannelModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/channels/modals/EditChannelModal.jsx)：
  - 移除 `<Form.Select field='groups' ... />`，管理员新增/编辑渠道时不再需要挑选或感知任何渠道分组/标签。
  - 提交数据时默认保障写入 `'default'`。
- [EditTagModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/channels/modals/EditTagModal.jsx)：
  - 移除标签批量编辑抽屉中的“分组设置”卡片。
- [ChannelsColumnDefs.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/channels/ChannelsColumnDefs.jsx)：
  - 移除渠道表格中的【分组】数据列定义。
- [ChannelsFilters.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/channels/ChannelsFilters.jsx)：
  - 移除渠道筛选工具条中的【选择分组】下拉筛选器。
- [useChannelsData.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/hooks/channels/useChannelsData.jsx)：
  - 默认列可见性配置中关闭 `COLUMN_KEYS.GROUP`。
- [RatioSetting.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/settings/RatioSetting.jsx)：
  - 完全移除【渠道池与调度设置】Tab 页及 `GroupRatioSettings` 关联引用。

#### 后端模型与调度层
- [model/channel_cache.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/channel_cache.go)：
  - `GetRandomSatisfiedChannelForModel` 遍历 `group2model2channels` 汇总所有支持该模型的已启用渠道候选集，去除之前仅查 `usableGroups` 的限制，让所有启用渠道按 `Priority DESC, Weight` 统一参与调度。
  - 修复 `GetRandomSatisfiedChannelFromAnyGroup` 在禁用内存缓存时的无限自递归问题，委托给 `GetChannelForModel` 直接查询 DB。
- [model/ability.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/ability.go)：
  - 新增 `GetChannelForModel(model string, retry int, filters []dto.ChannelFilter) (*Channel, error)`，提供跨渠道直查数据库能力的降级支持。
- [controller/channel.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/controller/channel.go)：
  - `AddChannel` 和 `UpdateChannel` 增加自动默认回退 `channel.Group = "default"`，保障接口无论是否传递 `group` 均具备健壮的数据库兼容性。
- [service/model_auth.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/service/model_auth.go)：
  - 确保管理员或具备全部权限的用户在鉴权通过时均挂载 `EffectiveGrantPolicy`，统一进入跨渠道调度机制。

---

## 一、 第三阶段：【授权管理】企业权限、渠道、模型与预算统一治理（最新）

### 1. 架构核心思想
- **零权限基线 (Zero-Privilege by Default)**：
  - 新建用户默认具备零信任/零权限基线，无需绑定物理渠道、无需充值或预存配额、无默认模型访问权限。
- **一处授权，全维纳管 (Unified Enterprise Authorization)**：
  - 管理员在【授权管理】中发起一次授权，即可完成以下维度的全量配置：
    1. **主体维度**：按部门、按跨部门角色用户组、或按具体个人。
    2. **模型资源**：按企业预设模型集或勾选指定模型。
    3. **物理渠道池 (`routing_group`)**：指定该授权所调用的物理渠道集群（如 `default`、`vip`、`dedicated_gpu`）。
    4. **预算额度策略 (`quota_type` & `grant_quota`)**：
       - `0`: 无限额度（企业免充值模式，零门槛调用，无消费上限）。
       - `1`: 指定预算配额（按 Token 预算控制消耗上限）。
    5. **最大在途并发 (`max_concurrency`)**：限制该授权策略下的在途同时请求并发数。
    6. **时效管理 (`expired_at`)**：支持永不过期或指定到期失效。
- **动态调度穿透**：
  - 请求进入网关在鉴权阶段解析用户的 `EffectiveGrantPolicy`，并将 `policy.RoutingGroup` 挂载到 Gin 上下文，下游渠道选择与调度自动查询匹配的物理渠道池，彻底解耦用户主体与渠道的关系。

### 2. 代码落地清单

#### 后端模型与业务层
- [model/model_grant.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/model_grant.go)：
  - `ModelGrant` 表增加 `RoutingGroup varchar(64)`, `QuotaType int`, `GrantQuota bigint`, `UsedQuota bigint`, `MaxConcurrency int`。
  - 新增 `EffectiveGrantPolicy` 结构体及 `GetEffectiveGrantPolicyForUser(userId int, modelName string) (*EffectiveGrantPolicy, error)`，按优先级合并部门、用户组及个人授权。
- [model/model_grant_batch.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/model_grant_batch.go)：
  - `ModelGrantBatch`、`ModelGrantBatchView`、`ModelGrantBatchDetail` 同步增加 `RoutingGroup`, `QuotaType`, `GrantQuota`, `MaxConcurrency`。
  - 批量授权、详情查询与批次列表同步返回与持久化 QoS 配置。
- [service/model_auth.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/service/model_auth.go)：
  - 在 `ValidateUserAndTokenModelAccess` 中注入 `EffectiveGrantPolicy` 解析：
    - 当配额模式为 `QuotaType == 1` 且已用配额超标时，立即拦截并提示预算用尽。
    - 当授权指定了 `RoutingGroup` 时，将请求的 `constant.ContextKeyUsingGroup` 动态覆盖为授权中的渠道池。
    - 当配额模式为 `QuotaType == 0`（无限额度）时，激活 `ContextKeyTokenUnlimited = true`，使账户免充值即可畅享算力。
- [service/concurrency_limiter.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/service/concurrency_limiter.go)：
  - 并发限流器扩展新增 `"grant"` 维度（`concurrency:grant:<batch_id>`），对单项授权策略生效全局并发控制。
- [controller/model_set.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/controller/model_set.go)：
  - `GrantModelSetRequest` 接收 `routing_group`, `quota_type`, `grant_quota`, `max_concurrency` 并在创建授权批次时持久化。

#### 前端交互层 (`web/classic/`)
- [CreateGrantModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/model-grants/modals/CreateGrantModal.jsx)：
  - 增加【渠道资源池与服务质量 (QoS)】卡片：
    - 物理渠道池下拉选择（从 `/api/group/` 动态加载渠道池列表）。
    - 预算额度模式单选按钮（无限额度企业免充值 / 指定预算配额）。
    - 授权预算配额输入框（`grantQuota`，Token 标定）。
    - 最大并发限制输入框（`maxConcurrency`，0 为不限制）。
- [ModelGrantsTable.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/model-grants/ModelGrantsTable.jsx)：
  - 表格新增【物理渠道池】、【预算配额】、【并发限制】3 列。
- [GrantDetailModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/model-grants/modals/GrantDetailModal.jsx)：
  - 概览 Descriptions 增加渠道资源池、预算配额（已用/总额）与最大并发限制条目。
- [EditUserModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/users/modals/EditUserModal.jsx)：
  - 移除必填限制，顶部增加引导横幅说明企业授权与预算已统一由【授权管理】负责，消除用户开户时的配置负担。
- **多语言国际化**：
  - 8 种语言字典（`en`, `zh`, `zh-CN`, `zh-TW`, `fr`, `ja`, `ru`, `vi`）全面录入 22 个新增 QoS 词条。

---

## 二、 验证结果汇总

| 验证维度 | 测试命令 / 方式 | 执行结果 | 说明 |
| :--- | :--- | :--- | :--- |
| **Go 模块独立性** | `cd relaykit && GOWORK=off go build ./...` | **PASS (exit 0)** | 严格保障 relaykit 独立编译与零污染 |
| **Go 后端整体编译** | `go build -o new-api main.go` | **PASS (exit 0)** | 成功生成二进制，无编译警告与错误 |
| **数据库兼容性** | PostgreSQL 迁移与启动 | **PASS** | `ModelGrant` & `ModelGrantBatch` 全量字段迁移幂等无冲突 |
| **授权策略解析单测** | `go test -v ./model -run TestGetEffectiveGrantPolicyForUser` | **PASS** | 验证主体优先级合并（部门、用户组、个人）及 QoS 策略解析 |
| **授权并发限流单测** | `go test -v ./service -run TestConcurrencyLimiter_GrantLimit` | **PASS** | 验证基于授权维度的分布式原子并发限制及释放 |
| **全后端核心套件** | `go test -count=1 ./model ./service ./middleware ./controller` | **PASS (4 套件全部通过)** | 跨模型/业务全流程校验无损 |
| **Classic 前端单元测试** | `bunx vitest run` | **PASS (3 files, 7 passed)** | 包含授权创建、批次表格等全部用例通过 |
| **Classic 前端生产打包** | `bun run build` in `web/classic` | **PASS (exit 0)** | Rsbuild 打包成功并完成 dist 产物同步 |
| **浏览器 UI 端到端验证** | Browser Subagent | **PASS** | 成功验证授权管理列表 QoS 列、新建弹窗 QoS 卡片联动及渲染 |

---

## 三、 浏览器实机截图

### 新建授权 QoS 配置界面 (`CreateGrantModal`)
![新建授权 QoS 配置界面](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/create_grant_modal_qos_scrolled_1788684623387.png)

### 用户编辑抽屉纯净化 (`EditUserModal`)
已彻底剥离遗留的个人钱包金额、充值调整与个人路由等级，改造为【模型权限与渠道配额】引导入口：
![用户编辑抽屉纯净化](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/edit_user_drawer_scrolled_1788685231397.png)

### 用户列表企业免充值状态展示 (`UsersTable`)
优化了原商业转售模式下的 `0 / 0` 虚假告警指示器，企业用户默认展示清晰规范的【免充值】状态标签：
![用户列表企业免充值状态展示](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/user_table_unlimited_quota_1788685326658.png)

---

## 四、 第四阶段：用户组织归属与多主体额度分配模式（团队共享 vs 成员独立上限）

### 1. 业务目标与需求
1. **用户列表去商业化**：
   - 彻底移除用户管理表格中商业转售遗留的 `剩余额度/总额度` 和 `免充值` 指示器，替换为企业组织标识【所属部门】（展示用户所在的部门 Tag，未分配部门时显示灰度占位标签）。
2. **多主体授权额度分配模式 (`quota_scope`)**：
   - 在【授权管理】中向部门或用户组批量授权并指定预算额度时，引入两种预算分配模式：
     - **团队共享总额度 (`quota_scope = 0`)**：所有被授权部门及下级子部门、或用户组下的全体成员，共同消耗这一笔总预算池；当累计消耗达到上限时，全体成员暂停使用。
     - **成员独立额度上限 (`quota_scope = 1`)**：被授权主体下的每一位成员，均独立享有等额的预算上限（如设置 500,000 点，则每位成员各拥有 500,000 点），成员之间的消费互不影响、互不挤占。

### 2. 代码改造清单

#### 后端模型与业务层
- [model/user.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/user.go)：
  - `User` 结构体新增 `DepartmentName string `json:"department_name,omitempty" gorm:"-"``。
  - 新增 `populateUserDepartmentNames(users []*User)`，在 `GetAllUsers`、`SearchUsersAdvanced` 和 `GetUserById` 查询时批量映射并填充用户所在部门名称。
- [model/model_grant.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/model_grant.go)：
  - `ModelGrant` 表与 `EffectiveGrantPolicy` 结构体新增 `QuotaScope int `json:"quota_scope" gorm:"type:int;not null;default:0"``。
  - 新增 `IncreaseGrantUsedQuota(grantId int, quota int64) error`，在用户实际发生模型调用后，实时原子更新授权记录及批次记录的 `used_quota`。
  - 在 `GetEffectiveGrantPolicyForUser` 中适配共享模式：当 `QuotaScope == 0` 时，动态读取该批次共享总消耗与总额度。
- [model/model_grant_batch.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/model/model_grant_batch.go)：
  - `ModelGrantBatch`、`ModelGrantBatchView`、`ModelGrantBatchDetail` 增加 `QuotaScope int` 与 `UsedQuota int64`。
  - 在 `CreateModelGrantBatch` 中实现成员独立上限模式展开逻辑：
    - 当 `quotaScope == 1` 且主体为部门或用户组时，在当前事务 `tx` 内查询展开其全部成员，为每位成员独立生成对应的 `ModelGrant` 记录，每人享有独立的 `GrantQuota`。
    - 注意避免 SQLite 单连接嵌套事务锁死问题，展开查询一律使用传入的 `tx` 执行。
- [controller/model_set.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/controller/model_set.go)：
  - `GrantModelSetRequest` 增加 `QuotaScope int`，透传至 `CreateModelGrantBatch`。
- [service/model_auth.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/service/model_auth.go) & [service/quota.go](file:///Users/zevin/Desktop/fit2cloud/code/new-api/service/quota.go)：
  - 上下文贯通：在 `ValidateUserAndTokenModelAccess` 中将生效策略的 `grant_id` 注入 Gin 上下文。
  - 扣费落库：请求消费结算 (`postConsumeQuotaWithResult`) 时调用 `IncreaseGrantUsedQuota`，实时推进授权预算已用额度。

#### 前端交互层 (`web/classic/`)
- [UsersColumnDefs.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/users/UsersColumnDefs.jsx)：
  - 彻底移除 `quota_usage` 列定义及其相关的半圆/百分比进度条逻辑。
  - 新增 `所属部门` 列，渲染用户所在部门名称标签（或 `未分配` 占位标签）。
- [CreateGrantModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/model-grants/modals/CreateGrantModal.jsx)：
  - 在指定预算配额模式下，动态呈现【额度分配模式】单选框：
    - `团队共享总额度`：展示提示语“所有选中的主体共同消耗此总预算池，适合部门项目制预算”。
    - `成员独立额度上限`：展示提示语“为所选主体下的每位成员分别赋予此额度上限，成员之间额度互不影响”。
  - 提交创建授权请求时携带 `quota_scope` 参数。
- [ModelGrantsTable.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/model-grants/ModelGrantsTable.jsx) & [GrantDetailModal.jsx](file:///Users/zevin/Desktop/fit2cloud/code/new-api/web/classic/src/components/table/model-grants/modals/GrantDetailModal.jsx)：
  - 预算配额列与详情弹窗中，附带高亮 Tag 标注【团队共享】或【每人独立】。
- **国际化同步**：
  - 8 种语言字典（`en`, `zh`, `zh-CN`, `zh-TW`, `fr`, `ja`, `ru`, `vi`）全面录入 `所属部门`、`额度分配模式`、`团队共享总额度`、`成员独立额度上限` 等 9 个新增词条。

---

## 五、 验证与浏览器实机效果

### 1. 自动化测试验证
- **独立编译**：`cd relaykit && GOWORK=off go build ./...` 编译成功 (exit 0)。
- **后端模型单测**：`go test -v ./model -run TestModelGrantBatchQuotaScope` 通过，精确验证了团队共享总消耗累加及成员独立额度互不干扰的逻辑。
- **核心模块单测**：`go test -count=1 ./model ./service ./middleware ./controller` 全量通过。
- **前端单元测试**：`bunx vitest run` 全部通过 (3 files, 7 passed)。
- **前端生产打包**：`bun run build` 产物同步成功 (exit 0)。

### 2. 浏览器端到端实机截图

#### 用户管理列表：展示【所属部门】，彻底剥离商业额度
![用户管理所属部门列](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/users_table_department_1788686690950.png)

#### 授权管理：支持【团队共享总额度】与【成员独立额度上限】
![授权分配模式切换](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/grant_modal_quota_allocation_1788686739504.png)

---

## 六、 客户端账号（CLI Proxy API / OAuth 凭证复用）修复与上线

### 1. 背景与核心价值
- **复用官方 OAuth 凭证**：通过登录本地 CLI（如 Claude Code、ChatGPT/Codex、Antigravity/Gemini CLI、Kimi Code）获得的 OAuth 凭据，无缝转变为 New API 的上游渠道。
- **向下游暴露统一 OpenAI 兼容接口**：下游程序与业务服务无需关心 Claude / Codex 私有协议，通过标准 `/v1/chat/completions` 或 `/v1/responses` 统一调用。

### 2. 问题排查与关键修复
1. **Gin 路由通配符遮蔽修复 (`router/channel-router.go`)**：
   - 之前 `/client_auth/*` 系列路由定义在 `/:id` 之后，导致请求 `/api/channel/client_auth/providers` 时被 Gin 字典树直接匹配进 `/:id` 通配符分支并报 404 / RelayNotFound。
   - **修复**：将 `/client_auth/*` 全部子路由优先提升至 `/:id` 通配符之前注册。
2. **前端取消错误过滤与状态保护 (`ClientChannels.jsx`)**：
   - React 严格模式和组件重新挂载时 `AbortController.abort()` 触发 Axios 抛出 `CanceledError`，导致之前显示红色全局报错条 `! canceled`。
   - **修复**：在 catch 块中显式过滤 `CanceledError`、`err.message === 'canceled'` 以及 `err.code === 'ERR_CANCELED'`，同时引入 `active` 挂载守卫。
3. **并发缓存陷阱修复 (`services/clientAuth.js`)**：
   - 全局 `patchAPIInstance` 会在内存缓存并发中的 GET 请求 Promise。当 StrictMode 中第一个请求因取消被中止时，共享 Promise 被标记为 rejected，后续非取消请求直接复用了被中止的 Promise。
   - **修复**：在 `clientAuth.providers`、`clientAuth.accounts` 及 `clientAuth.test` 请求中显式传入 `disableDuplicate: true`，彻底消除并发请求共享导致的数据空置。
4. **统一分组规范对齐 (`ClientChannels.jsx`)**：
   - 按照全站渠道分组解耦原则，移除客户端授权弹窗中的渠道分组选择器，默认归入 `'default'`。

### 3. 验证与实机效果
- **后端单测**：`go test -count=1 ./service/clientauth ./relay/channel/clientoauth ./router ./controller` 全部通过。
- **relaykit 独立构建**：`cd relaykit && GOWORK=off go build ./...` 成功。
- **前端单测**：`bunx vitest run src/components/table/channels/__tests__/client-auth.test.jsx` (4/4 passed)，全套测试 (13/13 passed)。
- **端到端浏览器实机效果**：
  - 客户端渠道列表页正常渲染 4 款客户端（Kimi Code、ChatGPT / Codex、Claude Code、Antigravity）卡片及已接入账号表格。
  - 点击“授权账号”弹窗正常呼出，展示回调网址输入与 OAuth 快捷登录链接。

#### 客户端账号主页（4 款客户端卡片全量正常渲染）
![客户端账号主页](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/clients_tab_overview_1788783173179.png)

#### 客户端账号授权弹窗（Claude Code 授权指引与回调链接）
![客户端授权弹窗](/Users/zevin/.gemini/antigravity-ide/brain/fb258509-f602-416f-9f4b-dd76fea42234/claude_code_auth_modal_1788783291862.png)


