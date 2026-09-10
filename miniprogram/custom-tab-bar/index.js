Component({
  data: {
    selected: 0,
    hidden: false,
    tabs: [
      { route: 'pages/study/index', label: '学习', icon: 'study' },
      { route: 'pages/exam/index', label: '练习', icon: 'exam' },
      { route: 'pages/study-group/index', label: '小组', icon: 'groups' },
      { route: 'pages/me/index', label: '我的', icon: 'me' }
    ]
  },
  lifetimes: { attached() { this.refresh(); } },
  pageLifetimes: { show() { this.refresh(); } },
  methods: {
    refresh() {
      const pages = getCurrentPages(), current = pages[pages.length - 1];
      const selected = this.data.tabs.findIndex((tab) => current && tab.route === current.route);
      if (current && current.route !== 'pages/study-group/index' && !(current.data && current.data.guideOpen) && this.data.hidden) this.setData({ hidden: false });
      if (selected >= 0 && selected !== this.data.selected) this.setData({ selected });
    },
    onTab(event) {
      const index = Number(event.currentTarget.dataset.index), tab = this.data.tabs[index];
      if (!tab || index === this.data.selected || this.switching) return;
      this.switching = true;
      wx.switchTab({ url: '/' + tab.route, success: () => this.setData({ selected: index }),
        fail: () => wx.showToast({ title: '暂时无法切换，请重试', icon: 'none' }),
        complete: () => { this.switching = false; } });
    }
  }
});
