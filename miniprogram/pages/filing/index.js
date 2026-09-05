const product = require("../../config/product");
Page({ data: { url: "" }, onLoad() {
  if (product.filingWebViewEnabled && /^https:\/\//.test(product.filingQueryUrl)) this.setData({ url: product.filingQueryUrl });
}, onError() { this.setData({ url: "" }); }, onBack() { wx.navigateBack(); } });
