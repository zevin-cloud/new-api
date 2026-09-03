# 授权管理修复记录

2026-09-03。范围：Classic 授权管理页面及后端模型鉴权、组织成员变更和授权存储。

## 修复结果

| 问题 | 修复后的行为 |
| --- | --- |
| 勾选个人被组织树自动提升为部门授权，或选择部门时混入个人授权 | 使用 Semi TreeSelect 的 `checkRelation="unRelated"`，部门和个人独立勾选。部门授权通过成员关系继承，不额外生成个人授权。 |
| 固定渠道请求跳过模型权限校验 | 提交请求在处理渠道绑定前统一验证用户授权及令牌模型限制；视频 remix 从原任务恢复模型后验证。 |
| 不携带模型的任务结果查询被 403 拦截 | 查询接口继续进入任务归属检查，不把空模型当作提交请求校验。 |
| 禁用的部门、用户组继续贡献权限 | 计算有效权限时过滤禁用和已删除的授权来源。 |
| 授权已到期，缓存仍保留五分钟 | 缓存有效期不超过最早授权到期时间，读取时再次校验到期时间，并防止并发旧查询回填已失效的缓存。 |
| 移除组成员、调整部门后权限滞留 | 用户组设置和成员替换在同一事务提交，清理旧、新成员缓存；部门修改清理相关成员缓存。修复修改部门名称时丢失部门路径的问题。 |
| 用户的部门和工号编辑未保存 | 保存 `department_id`、`employee_id`，兼容未传字段的旧请求；显式传入 0 或空字符串可清空，部门变化后刷新权限缓存。 |
| 批量授权部分成功、临时模型集残留 | 先验证所有主体和资源，再在一个事务内创建模型集、模型条目、批次和授权；失败全部回滚。补充无效 ID、有效期及长度验证。 |
| 一次提交显示为多条不相关记录 | 一次提交显示一个授权批次，支持展开明细、撤销单条或撤销整批。 |
| 关键词搜索无效 | 后端按部门、用户组、用户名、显示名及模型集名称过滤，支持组合筛选和批次分页。 |
| 用户选择器只显示前 100 人 | 服务层按分页总数加载全部用户；中断旧请求并识别不完整响应，覆盖授权创建、权限诊断及模型集主体选择。 |
| 管理员诊断显示“0 个可用模型” | 明确显示“拥有全部模型权限”，说明调用仍受 API Key 限制及渠道可用性约束。 |
| 模型集长名称覆盖相邻列 | 主表和明细表约束标签宽度、截断长名称并提供完整标题；自动生成的直接授权模型集显示为“指定模型”。 |
| 部门列表地址缺少无尾斜杠路由 | 同时支持 `/api/department` 与 `/api/department/`。 |

## 批次与历史数据语义

截图中的六条明细可以来自“三个主体 × 两组资源”。后端仍保存这些独立权限关系；新页面将同一次提交展示为一个批次。组织树误级联导致的额外授权已单独修复。

- 新增 `model_grant_batches` 表及 `model_grants.batch_id`，保留原来的主体和模型集唯一约束。
- 历史授权的 `batch_id` 为 0，每条独立展示。相同时间不足以证明属于同一提交，因此不会自动合并或删除历史权限。
- 同一主体和模型集重新授权时，现有绑定归入新批次。撤销旧批次不会撤销已转入新批次的绑定。
- 筛选命中批次内任一明细时显示完整批次，整批撤销确认框明确展示待撤销数量。
- 权限按多个来源取并集。撤销某条或某批授权后，其他有效授权仍可能提供相同模型的访问权限。
- 仅主数据库增加授权字段及表；独立日志数据库的表结构和迁移没有变更。

## 验证

环境：Windows amd64；Go 1.27.1；Node.js 24.19.0；Bun 1.4.0。

| 验证项 | 结果 |
| --- | --- |
| SQLite 3.50.4，真实内存数据库 | 授权行为、事务回滚、筛选、组织变更、批次撤销、新建及旧表升级通过 |
| MySQL 5.7.44，隔离实例 `127.0.0.1:13306/model_grant_test` | 同上，通过 |
| PostgreSQL 17.11，隔离实例 `127.0.0.1:15432/model_grant_test` | 同上，通过 |
| 模型层完整测试 | 通过 |
| middleware、controller、service 完整测试 | 通过 |
| Go 全项目构建 | 通过 |
| Classic Vitest | 3 个文件、6 个行为回归测试通过，使用真实 Semi 组件 |
| Classic ESLint、生产构建、i18n 同步 | 通过；七个语言包各补充 87 个键，原有翻译值未修改 |
| Chrome 生产页面检查 | 一批六条明细、长名称布局、单条撤销、整批撤销、空列表刷新及管理员诊断通过；无页面运行异常 |

迁移测试在每个数据库中分别覆盖新表和已有授权表升级，连续执行两次 `AutoMigrate`，验证历史 ID、到期时间、创建时间、授权人以及唯一约束和批次索引。重复授权插入的唯一约束错误是预期断言。

已有授权表使用本分支变更前 `2549ec6c8f8cb343af3263faf56f194a2df2cea0` 的字段定义，并填入代表性旧数据。检查的 upstream 发布标签 `v1.0.0-rc.26` 尚无本分支自定义授权表，其涉及本次变更的路径由新建授权表用例覆盖；没有将此检查表述为全应用历史版本升级测试。

主要执行命令（从仓库根目录运行 Go；从 `web/classic` 运行前端）。本机 Go 使用 `D:/software/go/bin/go.exe`，Node 使用 `C:/Users/zewen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`，Bun 使用 `D:/softFile/Node.js/node_modules/bun/bin/bun.exe`：

```powershell
$env:GOCACHE='D:\codex-model-grant-tests-01a06551\go-cache'
$env:GOTMPDIR='D:\codex-model-grant-tests-01a06551'

go test -p 2 ./middleware ./controller ./service -count=1
go test -p 2 ./model -count=1
go build -p 2 ./...

# 两个服务端数据库均为专门初始化的隔离测试实例。
# 测试会重建 model_grant_test 中的相关表，不能指向业务数据库。
foreach ($grantDialect in @('sqlite', 'mysql', 'postgres')) {
  $env:MODEL_GRANT_TEST_DIALECT=$grantDialect
  go test -p 2 ./model -run 'TestModelGrant(Migration|Batch)|TestDisabledOrganization|TestGrantKeyword|TestEditingUserPersists|TestOrganizationEdits' -count=1
}
Remove-Item Env:MODEL_GRANT_TEST_DIALECT

go test -p 2 ./service -run '^TestModelAuthCacheNeverOutlivesTheFirstGrantExpiry$' -count=1
```

```powershell
node ../node_modules/vitest/vitest.mjs run --config vitest.config.js
node ../node_modules/eslint/bin/eslint.js --parser-options '{"ecmaVersion":2022}' --ext .js,.jsx src/components/table/model-grants src/components/table/model-sets/modals/ModelSetSubjectsModal.jsx src/services/modelGrants.js src/services/__tests__/modelGrants.test.js src/test-setup.js vitest.config.js
bun run i18n:sync
bun run build
```

浏览器检查使用生产构建和隔离的 API 响应，实际点击确认撤销并核对 DELETE 地址与刷新后的行数。后端真实数据行为由三数据库测试覆盖。测试期间未操作业务数据库。

另外修正了既有测试夹具：模型列表测试明确初始化用户授权，固定渠道测试明确提供有权限用户，缓存统计测试使用稳定且独立的测试键，避免 Windows 时钟精度导致跨用例串数据。

验证结束后已正常关闭本次启动的 MySQL、PostgreSQL 隔离实例及浏览器预览服务。
