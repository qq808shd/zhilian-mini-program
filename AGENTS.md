# 知练 — 项目地图

> 更新：2026-09-09；适用整个仓库。用户最新明确要求优先；通用行为及 L0–L4 定级、停止条件沿用全局 Engineering OS。

## 开始与维护

- 先读本地图，确认当前分支、HEAD、相关未提交差异及并行工作，再读取对应文档/代码。保留已有改动，不覆盖或回滚无关文件。
- 用户自然表达需求；普通探索无需先写Spec或计划文件。只有长期约束、命令、数据基线或文档入口改变时，更新相应现有文档，不要求每个提交改AGENTS或写日志。
- 产品/数据规则与历史见 [PROJECT_RULES](docs/PROJECT_RULES.md)，按下表只读相关章节。

## 工程与代码入口

- 原生微信小程序；仓库根导入微信开发者工具，`miniprogramRoot` 为 `miniprogram/`，AppID 按 `project.config.json` 核对。
- 服务端位于 `server/`，Node.js 24 + 内置HTTP/SQLite；无第三方运行依赖，开发/测试无需安装依赖。
- 学习小组独立模块：`pages/study-group`、`group-create`、`group-join`、`group-month`、`group-history`；规则 `miniprogram/utils/groupRules.js`，服务端 `server/src/groups/`。只接收手动记录，不读取学习/答题数据；[实现与验收](docs/study-groups/README.md)。
- 页面：`miniprogram/pages/`；组件：`miniprogram/components/`；数据入口：`miniprogram/data/content.js`；材料：`miniprogram/data/materials/`。
- 本地统计/恢复：`utils/storage.js`；V5共享状态/迁移：`utils/learningModel.js`；FSRS-6默认调度：`utils/memoryScheduler.js`；按日期/模式/分类的会话与队列：`utils/learningEngine.js`；登录/同步：`utils/cloudSync.js`（均在miniprogram内）。共享状态与调度都被server引用，修改时考虑两端。
- `project.private.config.json` 是已忽略的本机配置；不提交生产.env、AppSecret、SESSION_SECRET、令牌、数据库、备份或本机私有记忆。

## 按任务读取

| 任务 | 文档与实现 |
| --- | --- |
| 整体功能/续做需求讨论 | [V5学习与复习](docs/v5-learning.md)为现行学习规则；[2026-09-06功能快照](docs/product-map/README.md)保留旧版导图与其他功能线索，不是当前学习规则或上线验收 |
| 产品范围/当前学习、考试、复习、我的 | [项目规则第1、3节](docs/PROJECT_RULES.md#1-项目定位与范围)，再读对应页面 |
| 新学/复习/学习设置/V5状态 | [V5学习与复习](docs/v5-learning.md)、[学习设置](docs/home-study-settings.md)对应节；learningModel/memoryScheduler/learningEngine；仅查历史时读[V4学习闭环](docs/v4/learning-loop.md) |
| 首次协议、头像昵称、个人中心 | [项目规则第3.4节](docs/PROJECT_RULES.md#34-我的首次使用与资料)和 [已有说明](docs/designs/account-onboarding/README.md)的现行说明；旧设计不直接继承 |
| 学习小组/契约/结算 | [学习小组 V1](docs/study-groups/README.md)、groupRules/groupApi/groupView、server/src/groups；身份守卫沿用现有登录与协议 |
| UI呈现 | [设计基线](design-system/default/MASTER.md)、[项目规则第5节](docs/PROJECT_RULES.md#5-界面和交互规则)、已有组件；以当前代码和用户最新反馈校准 |
| 题库、导入、数量、ID或分组 | 修改前读 [数据基线第4节](docs/PROJECT_RULES.md#4-已确认的数据基线)、[迁移第7节](docs/PROJECT_RULES.md#7-id本地统计和迁移约束)；代码索引在第6节 |
| 登录/云同步/存储/协议 | 修改前读 [架构第2节](docs/PROJECT_RULES.md#2-当前运行和架构基线)、[迁移第7节](docs/PROJECT_RULES.md#7-id本地统计和迁移约束)及相关测试 |
| 部署/证书/服务器 | [server/README](server/README.md)、对应功能验收中的待部署项；沿用现有授权，不因本地验证操作生产 |
| 历史缘由/已踩问题 | PROJECT_RULES第10–11节按关键词查找；不把旧日志当现行要求或本轮验证证据 |

## 关键保护规则

- 资料“新增/补充”默认增量追加，保留既有ID、前缀、释义、顺序和统计；不为整齐重建ID。改变ID/分组必须说明必要性，并验证既有数据与新数据的幂等迁移。
- 题库本地、用户数据云端、本地优先；离线不能阻断学习，待发事件持久保留，明确确认后移除；事件幂等及用户隔离不得退化。
- 未同意协议或协议失效不发云请求；旧停止状态不能静默覆盖。本机头像昵称不上传服务端，凭证不进入客户端、Git或测试fixture。
- V5学习状态/设置协议3保护旧服务端不误确认新事件；部署同时包含server/src、共享learningModel和memoryScheduler，先服务端后客户端。迁移继续保留V4离线队列与历史完成位置；旧阶段4不自动免复习。恢复/重置不能丢正式学习、自评、熟知决定和今日已完成位置。
- 打包包含miniprogram/assets及Tab图标，不为体积把assets整体忽略。生产开关/真实微信能力不用于绕过本地测试环境限制。

## 验证映射

命令在仓库根、Node.js 24执行，按影响选择；语法检查不代表微信渲染或业务通过。

| 范围/等级 | 最小相关检查 |
| --- | --- |
| L0 文档/非逻辑文字 | 本次diff、格式和必要链接；`git diff --check -- <本次文件>`，不Build/Test或启动微信工具 |
| L1 局部UI | 对应WXML/WXSS/JS代码；修改JS时对本次及实际关联JS执行 `node --check <文件>`，不全扫JS；视觉/交互无法从代码合理判断时一次微信工具编译并检查受影响页面 |
| L2 Tab导航 | `node --test tests/tab-navigation.test.js`；需要时验证真实Tab路径 |
| L2 自由学习/组卷/答题 | `node --test tests/learning-experience.test.js`；统计写入受影响时加入 `tests/storage-sync.test.js` |
| L2 学习卡/每日新学与复习页面 | 按页面选择 `node --test tests/learning-cards.test.js` 或 `node --test tests/daily-learning-cards.test.js`；跨页面核心状态受影响时加入 `tests/v4-learning.test.js`（保留文件名，覆盖V5及历史兼容） |
| L2 每日设置本地逻辑 | `node --test tests/study-settings.test.js`；核心状态受影响时加入 `tests/v4-learning.test.js` |
| L3 学习小组规则/服务端 | `node --test server/test/groups.test.js server/test/groups-api.test.js tests/study-groups.test.js`；Tab 变化加 tab-navigation；认证/同步变化加原有相关测试 |
| L3 协议/登录/云队列/存储 | 按影响从 `tests/account-experience.test.js`、`tests/cloud-sync.test.js`、`tests/storage-sync.test.js` 选相关文件用 `node --test`；涉及服务端/协议时加入 `server/test/api.test.js` |
| L3 V5共享模型/迁移/跨端同步 | 按影响用 `node --test` 选择 `tests/memory-scheduler.test.js`（算法/模型）、`tests/v4-learning.test.js`（引擎/历史兼容）；跨端改动加入 `server/test/api.test.js`，离线合并/恢复/重置链路加入 `server/test/learning-flow.test.js`；设置、确认或队列受影响时加入对应study-settings/account/cloud-sync测试 |
| L4 发布/CI；或实际影响覆盖全套的L3任务 | 根 `npm test` 是客户端+服务端全套；不再重复先前有效结果。发布另执行下述真实上线门禁 |

- 云同步变更保留受影响的首次导入、事件幂等、用户隔离、旧统计/V4迁移兼容、FSRS调度/当天不重复复习、熟知恢复、重置与进度保护验证；跨端行为不能只测试客户端。
- 数据改动核对知识/题目ID唯一、题目关联和正确选项存在、分组展平与原序一致；数量按PROJECT_RULES第4节当前基线，除非任务明确变更。导入还须对比旧前缀、ID、标题、释义、顺序及净增，不能仅凭结构测试证明旧内容未变。
- 组卷/题量/相关边界改动才覆盖0、1–10、11–20、21–100、100以上等相关输入，禁止生成0道或超过页面承载量的试卷；普通样式不检查全部题量。
- 真实上线仍验证/health、HTTPS证书、微信合法域名、真实wx.login、首次同步、断网学习与恢复补传，以及相关功能文档中的发布条件。不得用桩或历史验收冒充本轮上线通过。
- 服务端集成测试使用内存SQLite与回环临时端口；环境禁止监听时报告缺口，不改用生产测试。当前无独立lint或小程序CLI build脚本，不编造命令或通过结论。
- 交付前核对status与本次文件范围；充分即停止，保留用户的私有配置、原始大文件和无关变更。

## Git与跨电脑接管

- 另一电脑安装Git、Codex、微信开发者工具后，使用现有HTTPS地址 `https://github.com/qq808shd/zhilian-mini-program.git` 克隆，打开仓库根，先读本地图再按任务读取知识；微信工具核对AppID。
- 默认在main，远端origin。先检查分支、HEAD、status、相关差异及并行工作；需要同步且不会覆盖/打乱本地工作时才 `git pull origin main`。有未提交或并发改动时先保留并判断归属，不自动stash、reset或换副本。
- 提交/推送沿用当前会话授权；提交任务按“相关验证→精确暂存本次文件→检查staged diff→清晰提交→普通 `git push origin main`”执行。
- **只允许正常HTTPS推送**，不改代理、SSH、镜像或替代方式。失败如实报告；已授权的V4推送按原要求保留本地提交、重试普通HTTPS，不因网络失败重复改代码。
- 不要求每个提交更新AGENTS；本次确有长期规则或入口变化时，与对应文件一起提交。新增知识文件要随正常审阅提交才能进入其他电脑/新worktree。
