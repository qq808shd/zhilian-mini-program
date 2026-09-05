// 上线前补齐真实资料，并将 published 改为 true、更新 policyVersion。
module.exports = {
  name: "知练", fullName: "知练个人笔记",
  operator: "", contactEmail: "", filingNumber: "",
  filingQueryUrl: "https://beian.miit.gov.cn/",
  // 仅在已配置允许访问的业务域名并完成真机验证后启用 web-view。
  filingWebViewEnabled: false,
  published: false, policyVersion: "2026-09-05-draft", effectiveDate: ""
};
