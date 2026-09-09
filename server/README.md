# 知练同步服务

> V5 学习同步使用 `learningVersion: 5`、`learningSettingsVersion: 3`、`learningResetVersion: 1`。preferences 保存分类与 1–200 的整数新学数量（version: 3、batchId 为空），客户端继续按分类实际总量限制；保存后即刻生效，保留已完成内容。新学与复习按日期、模式、分类分别保存，不再采用旧配套题／再练混合计划。历史协议事件继续兼容；新客户端只有能力匹配与明确确认同时满足才移除待上传事件。2026-09-09 已部署生产，升级必须同时包含 `server/src`、`learningModel.js` 和 `memoryScheduler.js`。

该目录是“知练”微信小程序的轻量云端。题库和公式仍打包在小程序内，服务器负责微信登录、学习进度、答题统计和错题状态同步，以及独立学习小组契约。

服务只依赖 Node.js 24 自带的 HTTP、加密、`fetch` 和 SQLite，`package.json` 没有第三方运行依赖，适合低配置的中国大陆轻量应用服务器或云服务器。

## 数据流

1. 小程序通过 `wx.login` 获取一次性 `code`。
2. 服务端使用 AppID、AppSecret 和 `code` 向微信换取 OpenID。
3. 服务端返回自己的签名登录令牌；小程序不会接触 AppSecret 和 OpenID。
4. 答题和学习进度始终先写本机，稍后批量同步。
5. 每次答题生成唯一事件 ID，服务端幂等入库，网络重试不会重复累计。
6. 首次连接云端时，已有本机记录作为一次性基线导入；以后只上传新增答题事件和最新学习进度。

## 运行要求

- Node.js 24 或以上。
- 一个已经解析到中国大陆服务器的 HTTPS 子域名，例如 `api.example.com`。
- 微信公众平台中的小程序 AppSecret。
- 云平台防火墙只需对外开放 80、443；Node 服务默认只监听 `127.0.0.1:8787`。

正式小程序不能把公网 IP 或 HTTP 地址作为请求域名。域名需要完成相应备案、配置有效 HTTPS 证书，并在微信公众平台“开发管理 → 开发设置 → 服务器域名”中加入 `request` 合法域名。

## 本地验证

```bash
cd server
npm test
```

Node 24 环境可直接运行，不需要 `npm install`。如需用环境文件启动：

```bash
cp .env.example .env
# 在 .env 中填写真实值后执行
npm run start:env
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

## 阿里云轻量应用服务器部署步骤

当前生产环境是阿里云北京地域的 Ubuntu 24.04 轻量应用服务器。本机使用 SSH 别名 `zhilian-aliyun`，服务器安装隔离 Node.js 24.19，代码目录为 `/opt/zhilian-mini-program`，数据库目录为 `/var/lib/zhilian-api`。备案域名 `api.dabaommz.cloud`、HTTPS 证书和 AppSecret 已配置，Nginx 与 `zhilian-api` 均已启用并运行。

### 1. 准备域名与证书

1. 给域名增加 A 记录，指向阿里云轻量应用服务器公网 IP。当前生产记录为 `api.dabaommz.cloud`。
2. 通过阿里云完成备案并申请 HTTPS 证书，可使用阿里云数字证书管理服务或 Certbot。
3. 将 `deploy/nginx.conf.example` 复制到 Nginx 配置目录，把示例域名和证书路径替换成真实值。
4. Node 端口 8787 不对公网开放，由 Nginx 反向代理。

当前个人测试证书有效期截至 2026-12-01 23:59:59 UTC（北京时间 2026-12-02 07:59:59）。到期前应在阿里云重新申请证书，替换 `/etc/nginx/ssl/api.dabaommz.cloud/` 中的 `.pem` 与 `.key` 文件，执行 `nginx -t` 验证后平滑重载 Nginx；证书过期会导致微信小程序拒绝连接。

### 2. 准备独立运行时、运行用户和数据目录

建议把仓库部署到 `/opt/zhilian-mini-program`，并把 Node.js 24 放在 `/opt/zhilian-mini-program/runtime/node`。systemd 模板使用该隔离运行时，不替换服务器的系统 Node.js，也不影响同机现有服务。数据库放在 `/var/lib/zhilian-api`。创建专用的低权限系统用户 `zhilian`，确保该用户拥有数据库目录写权限。

### 3. 配置服务端密钥

从 `.env.example` 创建 `/etc/zhilian-api.env`。其中：

- `WECHAT_APP_ID` 使用当前 AppID `wx01e13d3df486356c`；
- `WECHAT_APP_SECRET` 只在服务器上填写，不提交 Git；
- `SESSION_SECRET` 可通过 `openssl rand -hex 32` 生成；
- `DB_PATH` 建议保持 `/var/lib/zhilian-api/zhilian.sqlite`。

环境文件权限建议设为仅 root 和服务账户可读。

### 4. 注册 systemd 服务

将 `deploy/zhilian-api.service` 复制到 `/etc/systemd/system/`，确认隔离 Node 路径和工作目录正确，然后重新加载 systemd、启用并启动服务。日志通过 `journalctl -u zhilian-api` 查看。

### 5. 开启小程序连接

服务器健康检查和 HTTPS 验证通过后，修改：

```js
// miniprogram/config/cloud.js
module.exports = {
  enabled: true,
  baseUrl: "https://api.dabaommz.cloud",
  requestTimeout: 10000,
  syncDebounceMs: 1800,
  maxEventBatch: 200
};
```

同时在微信公众平台配置完全相同、且不带路径的 `request` 合法域名，再重新编译上传小程序。

准备提供给朋友使用和提交审核前，还要按实际数据处理情况更新微信公众平台中的“小程序用户隐私保护指引”，说明用户标识和学习记录用于登录识别、跨设备同步及错题复习，小组另外保存用户明确填写的组内称呼与契约记录，并对同组成员展示；原本机个人头像昵称仍不上传，不收集手机号。

## API

| 方法 | 路径 | 登录 | 用途 |
| --- | --- | --- | --- |
| GET | `/health` | 否 | 健康检查 |
| POST | `/v1/auth/wechat` | 否 | 用微信登录 code 换取服务端令牌 |
| GET | `/v1/sync` | 是 | 拉取当前用户的云端状态 |
| PUT | `/v1/sync` | 是 | 首次导入、增量答题、进度同步或清空统计 |

## 数据和备份

- `users`：OpenID 与内部用户 ID，只保存在服务器。
- `question_stats`：每位用户每道题的聚合统计。
- `answer_events`：用于网络重试幂等去重的答题事件。
- `study_progress`：分类分组学习位置。
- `sync_meta`：初始化状态和同步版本。

SQLite 已开启 WAL。应定期备份 `/var/lib/zhilian-api`，升级或迁移前先停止服务或使用 SQLite 的在线备份能力，避免只复制主数据库而漏掉 WAL 中尚未合并的数据。

## 安全约束

- AppSecret、`SESSION_SECRET`、数据库文件和生产环境配置不得提交到 GitHub。
- 不在小程序端直接请求微信 `code2Session` 接口。
- Node 服务只监听回环地址，公网只暴露 Nginx 的 443。
- 用户不需要自建用户名和密码；服务端以微信 OpenID 区分用户。
- 本机头像昵称不上传；学习小组只保存明确填写的组内称呼与内置头像编号，不收集手机号。


## V5 学习状态同步与升级

`GET /health` 与同步快照返回 `learningVersion: 5`、`learningSettingsVersion: 3`、`learningResetVersion: 1`。`PUT /v1/sync` 每批仍最多提交 200 条 `learningEvents`，回应 `ackedLearningEventIds` 与 V5 `learningState`。保留原有统计字段和历史 V4／设置协议 1、2 事件的兼容；三种自评和熟知免复习使用 V5 事件，不能由旧服务端静默确认。

SQLite 的 `learning_events` 表继续按 `(user_id, event_id)` 唯一去重，事件按发生时间和 ID 重放，支持离线晚到、自评、熟知、记忆模型与会话完成。V4 旧计划及完成记录保留，V5 新学与复习分别按北京时间日期、模式、分类安排；范围修改可立即生效，已经完成的真实学习结果不丢失。快照保留近 30 日任务及近 7 日计算需要的明细，服务端事件日志保留用于重放。此版本继续采用简单全量重放，用户规模扩大前应增加快照检查点和符合最终隐私协议的保留策略。

范围清空使用 `reset-learning` 事件，携带当前 topicId 和范围知识 ID。持久清空截止点阻止旧学习事件和旧 study_progress 恢复；事务内先应用学习事件，再删除该范围截止点以前的阅读进度，保留其他范围、答题统计和后续新学。清空前版本的服务端不可确认该事件；客户端离线保留直到能力匹配。

服务端通过相对路径共用 `miniprogram/utils/learningModel.js` 和其依赖的 `miniprogram/utils/memoryScheduler.js`。部署必须保留仓库目录结构，并同时更新这两个纯模型文件与 `server/src`，不能只复制 server 目录。FSRS-6 使用公开默认参数，服务端与客户端必须使用同一版公式和参数；服务端不向小程序传输静态题库。

发布顺序：先用 SQLite 备份功能备份数据库，再部署兼容服务端并核对 `/health` 的三个版本标识、现有用户登录、新学习状态和熟知往返、重复上传及离线补传；最后发布小程序。V4 已掌握不迁移为免复习，旧客户端晚到事件不能覆盖 V5 主动程度和熟知决定。回滚旧服务时保留新增表及数据库备份，客户端未确认事件仍保留。不要将生产环境变量或数据库放入仓库。

2026-09-09 已部署 V5 与小组后端；本地验证与真实微信、生产同步验收分别记录，当前实现状态见 [V5 学习与复习说明](../docs/v5-learning.md)。

## 学习小组 V1 服务与升级

[完整 API、状态机、迁移与验证](../docs/study-groups/README.md)。新增 `/v1/groups` 模块沿用签名会话、请求大小与频率限制；用户身份来自认证，不接受客户端 user_id。小组记录与 V5 学习数据独立。

启动数据库时执行增量迁移 v1，新增小组、成员契约、每日记录、审计事件、幂等请求与迁移版本表；保留全部既有用户及学习表。加入采用 SQLite 即时事务检查八人上限，用户当前契约有部分唯一索引。部署前按现有 SQLite 备份规范操作；回滚服务代码保留新增表，不执行删表。

`server/src/index.js` 启动进程内调度：北京时间每日 00:05 结算昨日，启动时补偿；每批最多 32 份当前契约，批间让出事件循环，失败记录日志并 60 秒后重试。请求先补结算相关小组，逐日事务、结算游标和唯一事件保证重复运行不重复处罚。systemd 仍保证主进程常驻，无需额外 cron、Redis 或 WebSocket。

发布仍先服务端后客户端，除原 V5 的共享模型文件，还需同步 `miniprogram/utils/groupRules.js` 与 `server/src/groups/`，保持仓库相对路径。`GET /health` 新增 `groupVersion: 1`。2026-09-09 已部署生产，公网版本及小程序当前会话的小组读取通过；仍需在发布验收中检查真实微信登录、跨账号邀请/加入/记录/请假、HTTPS 与合法域名、定时结算日志，以及原学习离线补传。小组写入必须取得在线确认，不能把超时或旧服务端 404 当成功。


### 2026-09-09 部署记录

部署批次 `20260909T030631Z`：北京时间 11:08:45 停服备份，11:08:46 新服务启动；Node 24.19.0，systemd 状态 active/running，NRestarts=0。候选目录 `/opt/zhilian-mini-program/releases/20260909T030631Z`，独立合成数据接口测试 30/30 通过；生产安装的 13 个运行 JS 文件与候选清单逐一校验一致。

备份在服务器 `/var/backups/zhilian-api/20260909T030631Z/`（目录 700、数据库 600，仅 root）：`zhilian.sqlite` 为包含 WAL 数据的一致快照，`src/` 为旧代码，`before.json` 为迁移前表行摘要，`deployed-manifest.json` 为部署文件清单。迁移后、启动前逐表核对原有五张业务表全部行内容不变，SQLite 完整性与外键检查通过；没有将备份或密钥下载到本机/Git。

公网 HTTPS `/health` 返回 learningVersion=5、learningSettingsVersion=3、learningResetVersion=1、groupVersion=1；匿名 `/v1/groups` 从 404 变为受认证保护的 401。微信开发者工具现有登录会话读取小组成功，显示真实空组首页，无生产测试小组或虚构学习记录写入。用户随后明确授权传输当前微信一次性登录 code 与本机已有待同步记录。真实 wx.login 与认证接口返回 200 并取得有效令牌（未输出令牌）；原同步流程完成后 state=ready、lastError 为空、学习与答题待发事件均为 0，dirty=false、resetPending=false。这覆盖已有积压记录恢复，不代替真机断网学习全流程验收。

回滚只恢复应用代码：停服务，将当前 `server/src` 留存，再从上述 `src/` 恢复并启动。新建共享模型可保留，旧代码不引用；保留已迁移数据库及新增表。服务已经恢复对外后，禁止直接用部署前数据库快照覆盖，因为可能丢失新的真实记录；如需数据库恢复必须另行评估后续写入。
