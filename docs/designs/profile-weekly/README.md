# 个人资料引导与本周状态说明 · 2026-09-10

## 修改结果与范围

资料页从多级标题、大卡片、长说明改为「设置头像和昵称」＋居中头像＋昵称框＋完成按钮。选择头像后引导昵称焦点；昵称非空、1–24字、头像有效且原生昵称校验通过才可完成。后续编辑同一核心布局，主按钮为保存，附简短资料用途。

首次保留低强调「暂不设置」：头像昵称并非基础学习必要信息，不能以拒绝提供为由阻断基本功能。[网信办规定](https://www.cac.gov.cn/2021-03/22/c_1617990997054277.htm)明确涵盖小程序。此为任务书第八节允许报告的合规偏离；未实现强制资料门禁。

周卡移除常驻长图例；标题右侧问号打开现有 Bottom Sheet。七天等宽、姓名省略、底部独立摘要。黄/红文字＋颜色区分两种牌。真实「回」表示当天挑战达标：连续三天达标后，下一日恢复正式席。补充真实系统离席、已离席解释，不改变任何状态机。

用户明确补充授权统一昵称并允许扩展服务端：新增个人资料接口，统一头像昵称，创建/加入页不再重复填写组内称呼。OpenID、userId、签名登录、学习同步协议、FSRS、学习与答题数据、人数、结算规则、Tab 均未改变。

## 微信能力与存储

- 沿用 wx.login → code → 服务端身份与签名会话；本次未重写注册/登录。
- 实际使用 button open-type="chooseAvatar" 与 input type="nickname"，支持原生头像选项和手动昵称。不是一次点击同时获取头像昵称，不使用 getUserProfile、不伪造系统弹窗。
- 微信官方 userProfile 文档本次抓取失败，未据此断言存在/不存在其他新组合接口。
- 临时头像先按原实现复制到持久目录，再压缩并保存到当前账户服务端；跨设备读取服务器保存的图像内容。不会将微信临时路径当长期服务器 URL。
- 新增 GET/PUT /v1/profile，认证复用现有 requestAuthenticated；user_profiles 表主键为服务端认证用户。nickname、image、revision 与学习表独立。输入验证、图片128KB上限、乐观版本冲突和相同内容重试去重。
- 客户端待提交资料单独持久保存，按 userId 隔离；断网后在资料/我的/小组再次读取时重试。旧版本冲突报错，不静默覆盖另一设备。旧接口404不误报保存成功。
- 当前小组与成员/月度展示读取统一个人资料；历史旧称呼、内置头像保留兼容。退出隐藏头像，但账户资料供本人保留，重新加入复用。删除本机资料不等于删除服务器资料。
- 协议版本2026-09-10-v3；统一资料服务已于2026-09-10部署，客户端1.0.1已上传微信开发体验版。平台隐私指引仍需对应更新。

## 图像探索

实际使用 Codex 内置 image_gen.imagegen，接口未暴露具体模型选择，不能声称指定了 GPT Images 2.5 Sunburst 或 Flare。生成两份高保真参考，均仅作构图，不切图作为产品界面：

- [资料参考](references/profile.png)：采用居中头像、单输入、单主行动及暖白留白。
- [周卡与弹层参考](references/weekly.png)：基于用户真实小组截图生成，采用问号、等宽周表、独立摘要；未采用生成图错误文案、额外状态与卡片顺序。

提示词核心：WeChat mini-program / Quiet Growth / background #F8F7F3 / primary #4D785B / centered round avatar / one nickname input / one primary CTA / no large cards, gradients, glass or heavy shadows。周卡强调 Monday–Sunday equal grid, 3–8 members, top-right help, compact summary, no persistent legend，弹层分每日状态和小组状态。

先输出规格再写WXML/WXSS。真实运行后的第二轮修订：输入边框从主色边框改为常规浅边框，仅聚焦时绿色；黄牌红牌由同形感叹号改为「黄」「红」。

## 最终 Design Spec（750rpx）

| 项目 | 实际值 |
| --- | --- |
| 页面 padding | 左右40，顶部72，底部32＋safe-area；≤600px高时顶部40 |
| 标题/副标题 | 40/600，26；间距16 |
| 标题区到头像 | 64；小屏40 |
| 头像 | 160圆形；按钮上下12，纵向热区≥184，居中 |
| 头像操作文字 | 28，距头像20 |
| 头像区到昵称 | 56；小屏32 |
| 昵称 label / 输入文字 | 26/500；30 |
| Label 到输入 | 16 |
| 输入 | 高92，左右28，边框1，圆角20 |
| 昵称到CTA | 56；小屏32 |
| CTA | 高92、文字30/600、圆角20、宽100% |
| 周卡 | padding28、radius24 |
| 标题至副信息 | 10（按任务书明确数值） |
| 副信息至表头 / 表头至首行 | 28 / 12 |
| 姓名列 | 136、文字26、单行省略 |
| 成员行 | 72、浅divider1 |
| 日期列 / 状态点 | 剩余空间等分7列 / 36×36，文字26 |
| 问号 | 图标32，热区64×64 |
| 周摘要 | 顶距24，分割线1，线后20，文字24 |
| Sheet | 左右/顶部32，底部32＋safe-area，radius32，标题34/600 |
| Sheet正文 | 60vh可滚动；首组距标题32；区域间32；区域标题26/600 |
| 状态行 | min-height88，上下16，符号列52，列间16；名称28、说明24，间距8 |
| 基础色 | Background #F8F7F3，Surface #FFFFFF，Primary #4D785B，Text #303D36，Secondary #68736C，Border #E8E9E3 |
| 状态色 | 沿用success #356B4F、warning #86662F、danger #AD5146及原有soft背景；颜色均为既有语义Token |
| 禁用按钮 | 原有track底色＋secondary文字，真实disabled |

## 实际微信截图

截图来自微信开发者工具原生运行，右侧模拟器为产品页面。使用隔离存储与禁止生产请求的预览；小组为合成数据，未写真实学习/小组资料。

1. [新资料页最终版](screenshots/01-profile-final.jpg)
2. [实际微信头像已选择、昵称获得焦点](screenshots/02-avatar-selected.jpg)
3. [昵称已填写、原生校验后完成可用](screenshots/03-profile-filled.jpg)
4. [三人本周守约](screenshots/04-week-three.jpg)
5. [状态说明小组状态下半部](screenshots/05-status-sheet.jpg)、[每日状态上半部](screenshots/09-status-small.jpg)
6. [八人周表和长昵称](screenshots/06-week-eight.jpg)
7. [320px小屏资料页](screenshots/07-profile-small.jpg)、[小屏八人周表](screenshots/08-week-small.jpg)
8. [视觉修订前资料页](screenshots/01-profile-first-pass.jpg)

开发工具 Stable 2.02.2608040，基础库3.17.2，iPhone12/13与iPhone5。头像原生选择器实际打开，含使用微信头像/从相册选择/拍照。实际选中微信头像，昵称焦点与系统快捷昵称提示出现；手动昵称填写并校验后完成按钮可用。未点击保存向生产提交。

小组：问号打开、关闭恢复Tab、小屏滚动查看全部说明均实测；八人/三人、七列、长昵称、小屏与安全区可见。初始未填表单首屏无需滚动，无大卡片和技术长说明。没有把运行截图当作云端业务验收。

## Validation: L3

| 实际命令 | 结果 |
| --- | --- |
| node --test tests/account-experience.test.js tests/profile-sync.test.js tests/group-avatar.test.js tests/study-groups.test.js tests/tab-navigation.test.js tests/cloud-sync.test.js tests/storage-sync.test.js server/test/profiles.test.js | PASS，52项；此后新增1项状态弹层测试由下述定向测试覆盖 |
| node --test tests/group-avatar.test.js tests/profile-sync.test.js tests/account-experience.test.js | PASS，28项，覆盖最终表单与状态说明逻辑 |
| node --test tests/profile-sync.test.js tests/study-groups.test.js | PASS，14项，覆盖最后错误文案与404处理修订 |
| node --test server/test/groups-api.test.js server/test/groups.test.js server/test/api.test.js | 初次31/32通过；新增测试误把join结果当dashboard，修正测试后下述重跑通过。旧API10项及小组18项成功结果仍有效 |
| node --test server/test/groups-api.test.js | PASS，4项，含完整真实HTTP统一资料鉴权、更新、冲突、同组展示、退出和重新加入 |
| node --check（本轮12个修改JS文件，见下文） | PASS |
| git diff --check | PASS |
| 微信开发工具原生编译和上述页面交互 | PASS；开发工具存在热重载/预加载/选择器等warning，无本轮运行错误 |

语法检查文件：pages/profile、study-group、me、group-create、group-join 的 index.js；utils/profile.js、profileSync.js、groupAvatar.js；server/src/profiles.js、api.js、database.js、groups/service.js。

未完成的真实环境验证：本次未重新执行生产wx.login、未真机验证微信昵称快捷选中及相册/拍照选图后的完整保存、未生产上传统一资料、未做跨设备真机恢复。登录与账户隔离由现有真实HTTP接口测试覆盖；本机资料持久化与服务器重启恢复由对应测试覆盖。不能据此宣称真机/上线全验收通过。

## 2026-09-10 开发体验版上传记录

北京时间13:12，实际仓库上传为1.0.1，微信工具显示“代码上传成功”，并确认覆盖原体验版；未提交审核或发布正式版。[上传结果](screenshots/10-upload-success.jpg)。上传仅自动忽略无依赖的utils/accountView.js。

Validation: L4（本次上传检查）：本地完整npm test 176/176通过；服务器候选测试33/33通过。先部署服务端批次20260910T050633Z，再上传客户端。15个运行文件哈希与候选一致，HTTPS健康检查含profileVersion=1，匿名资料请求401。原13张表内容不变，数据库完整性和外键检查通过；备份位置见server/README.md。以上不替代前述真机跨设备验收，正式版仍未发布。

### 2026-09-10 13:36 开发体验版1.0.2

最新隐私政策补充与协议版本2026-09-10-v4已随实际仓库代码上传。微信工具明确显示代码上传成功，并替换原体验版；未提交代码审核或正式发布，published仍为false。Validation: L4（开发版上传），本次npm test 176/176通过、git diff --check通过。此次无服务端变更或重新部署；真机跨设备等正式发布验收缺口继续保留。

### 2026-09-17 开发版本1.0.3

用户确认小程序备案通过，完整备案号为辽ICP备2026020036号-2X。product配置更新备案号及published=true，使正式环境可以确认协议并进入服务；此开关不等于在微信平台发布。协议正文及版本2026-09-10-v4保持不变，旧preview范围的同意仍需重新确认。

微信开发者工具已明确显示代码上传成功，版本号1.0.3，并确认替换原体验版。[上传结果](screenshots/11-upload-1.0.3-success.jpg)。未提交代码审核或正式发布。

Validation: L4（开发版本上传）：完整npm test 176/176通过、相关JS语法检查及git diff --check通过；账户测试改为明确模拟published=false的草稿状态，继续验证草稿不能在正式环境授权及preview同意不能替代正式同意。公网HTTPS /health正常，学习5、设置3、小组1、资料1能力版本齐全；本轮无服务端重新部署。工具初始模拟器启动曾报simulator launch failed，随后欢迎页正常渲染，上传打包成功；不作为本轮真机完整验收。平台隐私指引提交与微信认证未确认，真机跨设备等正式发布验收缺口继续保留。
