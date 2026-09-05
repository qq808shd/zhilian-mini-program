Component({ properties: { title: String, detail: String, icon: String, danger: Boolean },
  methods: { onActivate() { this.triggerEvent("activate"); } } });
