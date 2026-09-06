const {
  knowledge,
  getTopicById,
  getModuleById,
  getKnowledgeByTopic
} = require("../../data/content");

const PAGE_SIZE = 40;

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
    items: [],
    hasMore: false,
    visibleCount: 0
  },

  onLoad(options) {
    const topic = options.topicId ? getTopicById(options.topicId) : { id: "", name: "全部知识", moduleId: "" };
    if (!topic) { wx.navigateBack(); return; }
    const module = getModuleById(topic.moduleId) || { name: "快速查询" };
    this.allItems = (topic.id ? getKnowledgeByTopic(topic.id) : knowledge).map((item, index) => ({
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
    this.collapsedIds = new Set();
    this.filteredItems = [];
    wx.setNavigationBarTitle({ title: `${topic.name}查询` });
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
    const item = this.filteredItems.find((entry) => entry.id === id);
    const isExpanded = this.expandedIds.has(id)
      || Boolean(item && item.matchedInDetail && !this.collapsedIds.has(id));
    if (isExpanded) {
      this.expandedIds.delete(id);
      this.collapsedIds.add(id);
    } else {
      this.collapsedIds.delete(id);
      this.expandedIds.add(id);
    }
    this.renderVisible(this.data.visibleCount);
  },

  onLoadMore() {
    this.renderVisible(this.data.visibleCount + PAGE_SIZE);
  },

  applyFilter(rawQuery) {
    const query = normalizeText(rawQuery);
    const entries = query
      ? this.allItems
        .map((item) => ({ item, score: getMatchScore(item, query) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => a.score - b.score || a.item.order - b.item.order)
      : this.allItems.map((item) => ({ item, score: -1 }));

    this.filteredItems = entries.map((entry) => ({
      ...entry.item,
      matchedInDetail: entry.score === 4
    }));
    this.setData({
      query: rawQuery,
      resultCount: this.filteredItems.length,
      resultLabel: query
        ? `找到 ${this.filteredItems.length} 条相关内容`
        : "全部内容"
    });
    this.renderVisible(PAGE_SIZE);
  },

  renderVisible(requestedCount) {
    const visibleCount = Math.min(Math.max(requestedCount, PAGE_SIZE), this.filteredItems.length);
    const items = this.filteredItems.slice(0, visibleCount).map((item) => ({
      ...item,
      detailExpanded: this.expandedIds.has(item.id)
        || (item.matchedInDetail && !this.collapsedIds.has(item.id))
    }));
    this.setData({
      items,
      visibleCount,
      hasMore: visibleCount < this.filteredItems.length
    });
  }
});
