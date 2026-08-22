async function exchangeWechatCode(code, config) {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", config.wechatAppId);
  url.searchParams.set("secret", config.wechatAppSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(config.wechatApiTimeoutMs) });
  } catch (error) {
    const wrapped = new Error("暂时无法连接微信登录服务");
    wrapped.statusCode = 502;
    wrapped.code = "WECHAT_UNAVAILABLE";
    throw wrapped;
  }

  if (!response.ok) {
    const error = new Error("微信登录服务返回异常");
    error.statusCode = 502;
    error.code = "WECHAT_BAD_RESPONSE";
    throw error;
  }

  const result = await response.json();
  if (result.errcode || !result.openid) {
    const error = new Error("微信登录凭证无效或已过期");
    error.statusCode = 401;
    error.code = "WECHAT_LOGIN_FAILED";
    throw error;
  }

  return { openid: result.openid, unionid: result.unionid || "" };
}

module.exports = { exchangeWechatCode };
