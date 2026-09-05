Component({
  properties: {
    title: String, description: String, meta: String, symbol: String,
    badge: String, warning: Boolean
  },
  methods: { onTap() { this.triggerEvent("activate"); } }
});
