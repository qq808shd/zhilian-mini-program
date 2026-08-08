const {
  getTopicById,
  getModuleById,
  getKnowledgeByTopic
} = require("../../data/content");

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLearningText(value) {
  return normalizeText(value).replace(/[，。；！？,.!?;]+$/g, "");
}

function getMatchScore(item, query) {
  const title = normalizeText(item.title);
  const summary = normalizeText(item.summary);
  const detail = normalizeText(item.detail);
  if (title === query) return 0;
  if (title.indexOf(query) === 0) return 1;
  if (title.indexOf(query) !== -1) return 2;
  if (summary.indexOf(query) !== -1) return 3;
  if (detail.indexOf(query) !== -1) return 4;
  return -1;
}

Page({
  data: {
    topic: null,
    module: null,
    query: "",
    total: 0,
    resultCount: 0,
    resultLabel: "",
    items: []
  },

  onLoad(options) {
    const topic = getTopicById(options.topicId);
    if (!topic || !topic.catalogEnabled) {
      wx.showToast({ title: "该分类暂不支持全部查看", icon: "none" });
      wx.navigateBack();
      return;
    }

    const module = getModuleById(topic.moduleId);
    this.allItems = getKnowledgeByTopic(topic.id).map((item, index) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      detail: item.detail,
      order: index + 1,
      category: item.category || "",
      hasSeparateDetail:
        normalizeLearningText(item.detail) !== normalizeLearningText(item.summary)
    }));
    this.expandedIds = new Set();
    wx.setNavigationBarTitle({ title: `${topic.name}词库` });
    this.setData({ topic, module, total: this.allItems.length });
    this.applyFilter("");
  },

  onSearchInput(event) {
    const query = event.detail.value || "";
    this.applyFilter(query);
  },

  onClearSearch() {
    this.applyFilter("");
  },

  onToggleDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (this.expandedIds.has(id)) this.expandedIds.delete(id);
    else this.expandedIds.add(id);
    this.applyFilter(this.data.query);
  },

  applyFilter(rawQuery) {
    const query = normalizeText(rawQuery);
    const entries = query
      ? this.allItems
        .map((item) => ({ item, score: getMatchScore(item, query) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => a.score - b.score || a.item.order - b.item.order)
      : this.allItems.map((item) => ({ item, score: -1 }));

    const displayItems = entries.map((entry) => ({
      ...entry.item,
      detailExpanded: this.expandedIds.has(entry.item.id) || entry.score === 4
    }));
    this.setData({
      query: rawQuery,
      items: displayItems,
      resultCount: displayItems.length,
      resultLabel: query
        ? `找到 ${displayItems.length} 条相关内容`
        : "全部内容"
    });
  }
});
