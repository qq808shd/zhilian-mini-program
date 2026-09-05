const product = require("../config/product");
function openPrivacyContract() {
  if (!wx.openPrivacyContract) { wx.showToast({ title: "请更新微信后查看", icon: "none" }); return; }
  wx.openPrivacyContract({ fail() { wx.showToast({ title: "微信隐私指引暂不可用", icon: "none" }); } });
}
function contact() {
  if (!product.contactEmail) { wx.showToast({ title: "联系邮箱待补齐", icon: "none" }); return; }
  wx.setClipboardData({ data: product.contactEmail, success() { wx.showToast({ title: "联系邮箱已复制", icon: "success" }); } });
}
function filingQuery() {
  if (product.filingWebViewEnabled) { wx.navigateTo({ url: "/pages/filing/index" }); return; }
  wx.showModal({ title: "备案查询", content: "工信部备案查询网址：" + product.filingQueryUrl + "\n可复制后在浏览器中查询。小程序内跳转尚待配置。", confirmText: "复制网址",
    success(result) { if (result.confirm) wx.setClipboardData({ data: product.filingQueryUrl }); } });
}
module.exports = { openPrivacyContract, contact, filingQuery };
