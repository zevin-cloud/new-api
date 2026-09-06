# 模型授权与路由解耦

本次在 `codex/latest-backend-classic` 当前工作区修改，保留了原有未提交改动。产品前端仅修改 `web/classic/`。

## 使用方式

1. 在「模型管理 → 编辑模型 → 允许使用的渠道池」配置该模型的池。可选多个，按选择顺序尝试；没有配置时仅使用 `default`。
2. 在「授权管理」选择部门、用户组、个人，以及模型集或具体模型；新授权不再绑定单一池。
3. 编辑旧授权时，原有分组保持不变。确认每个模型的路由配置后，可选择「跟随模型路由」迁移。系统会检查所选模型在允许的池内是否存在启用的渠道能力，缺失时返回模型名称，拒绝保存。
4. 「权限诊断」显示每个授权模型的池、命中的授权 ID 和渠道可用性。可用性表示存在启用的渠道配置，不代表对上游做了实时健康探测。

旧授权的预算和并发策略优先级保持：个人 > 用户组 > 部门，同级授权 ID 较大者优先。模型权限取有效授权的并集；路由与预算仍取实际命中的同一条授权，不合并多个授权的预算。

## 实现与兼容

- `models.routing_groups` 使用可空 TEXT 保存 JSON 字符串数组，没有数据库专属 JSON 类型。精确模型元数据支持该字段；现有规范化模型名称沿用同一匹配规则。
- 新 Classic 授权请求带 `routing_mode: "model"`；数据库沿用现有 `routing_group` 字段的内部标记 `@model`，无需重写旧授权数据。
- 原有空路由继续继承用户/API Key 路由；原有显式池继续生效。旧客户端不发送 `routing_groups` 时，编辑模型不会擦除已配置的池。
- 普通 API Key 的旧分组检查推迟到模型授权解析之后：模型路由不再受旧用户分组限制，旧继承授权继续检查其分组权限。API Key 的模型范围依然只能缩小权限。
- 删除任意分组兜底。重试、亲和渠道和固定渠道受最终允许池约束；操练场参数不能覆盖普通用户的最终策略。
- API 模型列表和模型广场按每个模型的路由策略判断可用性，避免跨组授权后模型仍不显示。
- 本次不改计费实现。实际验收确认原来的“免充值无限”仍检查账户余额，已将相关 UI 改为“不设授权预算上限”，明确账户计费规则仍适用。

## 验证记录（2026-09-06）

| 检查 | 结果 |
| --- | --- |
| `go test ./model ./service ./middleware ./controller -count=1` | 四个包通过 |
| 新增跨分组模型列表、固定渠道越界用例 | 通过 |
| Classic Vitest | 3 个文件、7 项测试通过 |
| 修改文件 ESLint | 通过；仓库现有 ESLint/ajv 加载冲突，使用临时独立 ESLint 8.57.0 环境执行，不修改项目依赖 |
| Classic `bun run i18n:sync`、`bun run build` | 通过；新增文案覆盖七个活动语言及保留的 zh 文件 |
| Go 应用构建 | 通过 |
| 浏览器 | 验证模型路由回填/保存、新授权无统一渠道池、列表标记与权限诊断；检查诊断布局 |
| 实际 HTTP 调用 | 本地模拟上游；同一 Key 成功调用 default 池的 route-a 与 vip 池的 route-b；未授权模型拒绝；不兼容的统一池授权保存失败 |

数据库均为本机新建隔离实例，没有操作现有业务数据库：

| 数据库 | 精确版本 | 检查 |
| --- | --- | --- |
| SQLite | 3.50.4（Go 驱动查询） | 新建、旧表升级、重复迁移、应用启动两次通过 |
| MySQL | 26.7.0（Homebrew 服务端报告） | 同上，127.0.0.1:13306 |
| PostgreSQL | 17.11 | 同上，127.0.0.1:15432 |

迁移测试使用 `v1.0.0-rc.30` 的原始模型表结构及代表性记录，验证旧数据、ID、模型名称索引、路由默认值、配置保存及旧客户端更新不擦除路由。新库与升级库均重复执行 `AutoMigrate`。另使用完整应用在三种数据库各连续启动两次。没有声称验证完整历史应用数据升级；本次变更不涉及日志表，独立日志库迁移只处理 Log，模型路由表不在该路径。

执行命令（仓库根目录）：

```sh
go test ./model ./service ./middleware ./controller -count=1
go test ./controller ./middleware -run 'TestModelRoutingLists|TestDistributeRejectsPinned' -count=1
MODEL_GRANT_TEST_DIALECT=sqlite go test ./model -run '^TestModelRouting' -count=1
MODEL_GRANT_TEST_DIALECT=mysql go test ./model -run '^TestModelRouting' -count=1
MODEL_GRANT_TEST_DIALECT=postgres go test ./model -run '^TestModelRouting' -count=1
go test ./model -run '^TestModelRoutingMigration$' -v -count=1
go build -o /tmp/new-api-routing-db/new-api-final .
python3 /tmp/new-api-routing-db/startup_check.py
python3 /tmp/new-api-routing-db/acceptance.py
```

前端命令（`web/classic`）：

```sh
bun run i18n:sync
bun run build
node ../node_modules/vitest/vitest.mjs run --config vitest.config.js
node /tmp/model-routing-eslint/node_modules/eslint/bin/eslint.js --resolve-plugins-relative-to /tmp/model-routing-eslint/node_modules --parser-options '{"ecmaVersion":2022}' src/services/modelRouting.js src/components/table/model-grants/ModelGrantsTable.jsx src/components/table/model-grants/modals/{CreateGrantModal,GrantDetailModal,InspectUserModal}.jsx src/components/table/models/{index.jsx,modals/EditModelModal.jsx} src/components/table/model-grants/__tests__/{batch-table,creation}.test.jsx
```

当前运行边界：现有 3000 后端进程未替换。验证运行在独立 3002 后端、5175 预览及隔离数据库。正式使用须重新构建/启动当前后端，使新增模型字段迁移生效；切换旧授权前先配置对应模型的池。
