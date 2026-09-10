const guide = require('../../utils/learningGuide');
Component({
  properties: { open: Boolean, onboarding: Boolean },
  data: { step: 0, steps: guide.steps, more: false },
  observers: { open(value) { if (value) this.setData({ step: 0, more: false }); } },
  methods: {
    noop() {},
    close() { if (this.data.onboarding) guide.finish(); this.triggerEvent('close'); },
    next() { if (this.data.step < 2) this.setData({ step: this.data.step + 1 }); else this.close(); },
    more() { this.setData({ more: !this.data.more }); }
  }
});
