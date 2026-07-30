Component({
  data: {
    displayLines: []
  },
  properties: {
    lines: {
      type: Array,
      value: []
    },
    note: {
      type: String,
      value: ""
    },
    spoken: {
      type: String,
      value: ""
    },
    size: {
      type: String,
      value: "normal"
    }
  },
  observers: {
    lines(lines) {
      this.setData({
        displayLines: (lines || []).map((parts, lineIndex) => ({
          id: `line-${lineIndex}`,
          parts: (parts || []).map((part, partIndex) => ({
            ...part,
            id: `line-${lineIndex}-part-${partIndex}`
          }))
        }))
      });
    }
  }
});
