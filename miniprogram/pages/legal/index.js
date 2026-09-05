const { getLegalDocument } = require("../../data/legal");
const { isPublicationReady } = require("../../utils/account");
const { openPrivacyContract } = require("../../utils/productActions");
Page({ data: { document: null, draft: true, privacy: true },
  onLoad(options) { const kind = options.kind === "terms" ? "terms" : "privacy"; const document = getLegalDocument(kind);
    this.setData({ document, draft: !isPublicationReady(), privacy: kind === "privacy" });
    wx.setNavigationBarTitle({ title: document.title }); },
  onPlatformPrivacy: openPrivacyContract
});
