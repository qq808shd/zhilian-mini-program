const product = require("../../config/product");
const { getVersionLabel, isPublicationReady } = require("../../utils/account");
const { contact, filingQuery } = require("../../utils/productActions");
const { openLegal } = require("../../utils/accountNavigation");
Page({ data: { product, version: "", draft: true },
  onLoad() { this.setData({ version: getVersionLabel(), draft: !isPublicationReady() }); },
  onLegal: openLegal, onContact: contact, onFiling: filingQuery
});
