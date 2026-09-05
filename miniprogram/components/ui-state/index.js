Component({
  properties: { title: String, description: String, action: String, mark: { type: String, value: "—" } },
  methods: { onAction() { this.triggerEvent("action"); } }
});
