# 个人学习闭环 V6 · 实施与验收

V6 是体验层，底层保留 V5 学习协议、FSRS-6 默认参数与 90% 目标回忆概率。题库、稳定 ID、云同步与小组 V1 业务不变。四项 Tab 仍为学习／练习／小组／我的。

## 实施范围与顺序

1. 读取现有状态并建立纯函数 `learningDashboard`：今日行动、真实完成量、当前错题与已学关联题推荐、作答调度反馈。
2. 依据视觉参考与下方规格实现学习／练习／我的，增加可跳过的三步引导及可滚动规则弹层；整理学习卡、设置与记录说明。
3. 定向回归推荐边界、页面流程、旧数据保留，微信原生编译及状态截图；至少一次视觉校准。
4. 更新现有规则和设计基线，交付实际证据及未验收项。

## 页面级 UI Spec（实现前制定）

统一参考宽 750rpx（约 390px 手机）。沿用小组当前暖白 #F8F7F3、品牌绿 #4D785B、正文 #303D36、辅助 #68736C、浅绿 #EDF3E8、白色内容面与 #E8E9E3 边框。语义状态继续使用既有柔和绿／暖色／红色。

| 规格 | 学习首页 | 练习首页 | 结果反馈 | 我的 |
| --- | --- | --- | --- | --- |
| 左右/顶部 padding | 32/24rpx | 32/24rpx | 32/24rpx | 32/24rpx |
| section gap | 32rpx | 32rpx | 32rpx | 32rpx |
| 首区 | 范围栏最小 112rpx，自适应长标题 | 标题42rpx、副文案26rpx | 标题42rpx、表现数字44rpx、用时36rpx | 头像112rpx、昵称36rpx |
| 主卡 | 淡绿，padding32rpx，radius28rpx | 同左 | 白底表现区，padding32rpx，radius24rpx | 白底概览，padding32/16rpx，radius24rpx |
| 区域标题/正文 | 32/28rpx | 32/28rpx | 32/28rpx | 32/28rpx |
| 主 CTA | 根据状态仅一个，96rpx高、radius20rpx | 一个推荐CTA | 错题重练或返回练习 | 不新增无意义主按钮 |
| 次操作 | 行内链接，最小44px热区 | 全宽专项列表 | 文字型查看知识／返回 | 现有account-row列表 |
| 辅助字号/行高 | 24rpx/1.55 | 同左 | 同左 | 同左 |
| icon | 主40rpx、辅助32rpx | 同左 | 同左 | 同左 |

- 行动标题最多两行，范围与昵称允许两行，必要时截断并保留完整无障碍名称；正文不强截断。
- 今日主卡之后才显示总进度；学习程度为轻量四列摘要，无大号数字或独立彩色卡。
- 今日建议卡右上角为「调整计划」，卡下用说明文字和「了解规则」承载学习规则；底部仅保留自由学习整行入口。「学习状态」标题右侧为「全部已学 ›」，四档数量分别进入对应筛选；不保留「你的主动判断」副标题或独立的「查看已学内容」行。
- 学习完成时不再制造任务，仅保留可选练习；无复习时用状态行表达。
- 练习建议优先有效当前错题，其次当前范围已学知识的真实关联题，最后自由专项；所有入口最多20题，空题源不可开卷。
- 结果依次为本次表现、错题知识、实际系统反馈、唯一主操作、逐题解析。
- 引导为三步可跳过弹层；顶部圆角32rpx，最大高度88vh，正文scroll-view，显示步骤和关闭入口；规则长文可滚动，打开时隐藏TabBar并在关闭/离页恢复。
- 正文行高1.6、题干1.68；文字、关闭与关键辅助操作至少44px热区。遵循已有图标语言，不打包整张生成UI。

## 数据口径

- 学习进度：有效知识的正式 firstLearnedAt；自评与练习表现分开。
- 今日新学：北京时间今日首次正式学习的知识数；今日复习：今日复习会话中实际完成的知识去重数。普通查阅、重复修改程度、取消熟知、单纯答题不额外计为今日复习。
- 七日正确率：最近七个北京时间自然日真实 answer 事件，无记录显示“—”。
- 结果反馈只在本轮作答前后，已学且未免复习记录的 memoryEvent 实际改变时显示“更新复习安排”；熟知保持免复习，未学内容只累计作答证据。
- 引导与首次提示保存独立本地版本键，不上传，不触及旧学习键与事件队列。

## 视觉过程

使用内置 `imagegen`（未暴露 Sunburst/Flare/2.5 型号选择）生成四页核心设计板和三步引导板。采用轻范围栏、单一淡绿行动主卡、轻统计；不照搬生成图的重复顶部导航、示例邮箱、误写文字或虚构提示。参考保存于 `design-system/default/references/v6-*.png`。

## 底层保护与实现边界

本轮没有修改 learningModel、memoryScheduler、learningEngine、storage、cloudSync、server、题库材料、ID 和 group V1 逻辑。数据基线仍为 1044 条知识、1089 道题。V5 状态协议、设置协议3、本地键和待发事件确认规则不变；不触发迁移、清空或重建数据。引导仅写独立本地键。

回归用已有记录构造已学、主动程度、熟知、due date、阅读位置、今日草稿、答题次数、错题和待发队列；进入新presenter并完成引导后逐键比对未改变。实际答题仍进入旧写入链路：未学不冒充已学，已学答题可改变调度，熟知仍免复习，主动程度不被作答覆写。

## 初次 V6 实施验证（2026-09-09，Validation: L3）

初次实施定向测试 **PASS：113/113，0失败、0跳过**，Node.js 24.18.0：

```sh
node --test tests/learning-dashboard.test.js tests/learning-cards.test.js tests/daily-learning-cards.test.js tests/learning-experience.test.js tests/study-settings.test.js tests/account-experience.test.js tests/v4-learning.test.js tests/storage-sync.test.js tests/learning-reset.test.js tests/cloud-sync.test.js tests/tab-navigation.test.js tests/study-groups.test.js
```

- PASS：13个本轮JS文件执行 `node --check`，3个JSON解析；未全扫无关JS。
- PASS：`git diff --check`。
- PASS：`node scripts/prepare-v6-preview.js /private/tmp/zhilian-v6-preview-review` 创建隔离原生预览，真实WXML/WXSS与现有模型，仅合成验收数据；独立storage前缀，禁止网络请求、小组写入，未改用户正式记录。
- PASS：对底层保护路径执行 `git diff --name-only -- miniprogram/utils/learningModel.js miniprogram/utils/memoryScheduler.js miniprogram/utils/learningEngine.js miniprogram/utils/cloudSync.js miniprogram/utils/storage.js miniprogram/data server miniprogram/pages/study-group miniprogram/utils/groupRules.js miniprogram/utils/groupApi.js`，结果为空。

过程中首次8套件运行84/87，3项失败：新增用例的时间戳超前导致因果顺序不符；旧首页测试禁止完成后的可选练习入口；新presenter缺少既有daily.completed字段。定位后分别调整用例时序、按V6明确要求更新入口断言、补兼容字段。第二次56项中剩1项为同一时序用例，修正后通过。未删掉原数据保护断言，最终113项覆盖这些修正。逐次日志与精确命令见截图目录中的验证记录。

初次实施阶段未运行服务端完整套件；后续上传前已执行全套，见下节。沿用已有登录与同步链路，不把原生合成场景当成生产联调；真机、真实断网补传及正式发布仍需单独验收。

## 开发版本上传与后续首页调整（2026-09-09）

- 上传前 `npm test` 全套 **163/163 通过，0失败、0跳过**，包含客户端与服务端；首次运行因沙箱禁止本机临时端口监听而失败，允许本地集成测试后通过，未操作生产服务。
- 欢迎插画 PNG 仅重新压缩 IDAT 数据，1,484,461 → 1,206,534 字节；验证解压数据完全一致，其他 PNG 块保留，解决微信上传包超限。
- 微信开发者工具已确认 **1.0.0 代码上传成功**；仅开发版本，未提交审核或正式发布。
- 上传后继续调整首页辅助入口与学习状态排版；只修改 study 页 WXML/WXSS，Validation: L1，原生编译无错误；设置跳转、规则展开/关闭、自由学习及「全部已学」默认筛选均已验证。复用上传前有效测试，不重复全套。
- 当前 Git 源码包含上述后续调整，**微信平台的 1.0.0 尚不包含最后的首页调整**；重新上传是独立操作。
- 正式协议运营者为邵奇（个人），生效日 2026-09-09；完整小程序备案号与平台隐私配置待核对，`published` 保持 false。

## 微信原生与视觉校准

使用微信开发者工具 Stable 2.02.2608040 的隔离项目，原生编译查看学习各任务状态、练习推荐与自由专项、组卷、答题、逐题反馈、结果、我的、三步引导、滚动规则、学习设置、新学/复习卡、记录及小组。截图完整保留开发工具窗口，汇总图只裁取其中手机区域，不使用浏览器替代渲染。

第一轮后将主行动标题40rpx提高为44rpx，移除主卡重复数量/计划描述；修正微信默认按钮宽度覆盖引导CTA的问题；结果页将首次调度说明合并为一条真实反馈。至少两轮原生截图已记录。首次引导三步完成与跳过后Tab恢复，规则长文可滚动；在隔离数据上点击揭示仍停在当前条，选择程度后进入下一条。

基础库日志显示3.16.2，工具同时提示灰度3.17.2。预览中曾遇工具自身SdkReport 503，最终重新编译后为0错误；保留已有全局组件/预加载警告及隔离场景播种耗时提示。这些不代表已验收真机性能。

## 已知限制

- 仍使用FSRS-6公开默认参数、90%目标回忆概率，无个人拟合或AI学习量推荐。
- 推荐只使用当前错题与当前范围已学关联题，不虚构连续天数、薄弱原因或预测成绩。
- 学习与答题不会自动完成小组手动打卡；不增加整套公考模拟题库。
- 引导完成标记仅本机保存；换机可能再显示，可跳过。
- 活动记录按现有七日活动数据展示最多20条，保留近期浏览和专项积累入口；不伪造旧聚合记录的日期。
- 已上传开发版本1.0.0，未正式发布；后续首页调整尚未重新上传。用户原有 project.config.json 差异和慢燃线目录保留在本机，不纳入本次 V6 提交。


## 文件与截图入口

| 归属 | 主要文件 |
| --- | --- |
| 今日推荐与统计 | `miniprogram/utils/learningDashboard.js`（纯presenter），`learningGuide.js`（独立本地教育标记） |
| 首次引导与规则 | `miniprogram/components/learning-guide/index.{js,json,wxml,wxss}` |
| 首页、练习与我的 | `miniprogram/pages/study/index.{js,json,wxml,wxss}`、`exam/index.{js,wxml,wxss}`、`me/index.{js,wxml,wxss}` |
| 学习卡、记录和文案 | `today-study/index.{js,wxml,wxss}`、`learn/index.wxml`、`history/index.{js,wxml,wxss}`、`study-settings/index.{wxml,wxss}`、`group/index.wxml`、`review-topic/index.wxml`、`utils/learningView.js` |
| 统一视觉与导航 | `miniprogram/app.{json,wxss}`、`styles/learning-theme.wxss`、`styles/learning-experience.wxss`、`custom-tab-bar/index.{js,wxss}` |
| 验证与交接 | `tests/learning-dashboard.test.js`、`tests/study-settings.test.js`、`scripts/prepare-v6-preview.js`、`README.md`、`AGENTS.md`、`docs/PROJECT_RULES.md`、`docs/v5-learning.md`、本文件、`design-system/default/MASTER.md` |
| 视觉证据 | `design-system/default/references/v6-core.png`、`v6-guide.png`；[原生截图索引](v6-screenshots/README.md)、[逐次测试记录](v6-screenshots/validation.md) |

320×568与390×844开发工具预设均已查看。小屏针对长分类名、1044已学数量、首次引导/跳过、学习卡和结果主操作核对；其余边界在390预设查看。未覆盖全部真机型号、系统放大字号或真实网络状态。
