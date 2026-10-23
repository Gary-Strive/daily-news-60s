/**
 * 60秒读懂世界 - Quantumult X
 * 兼容 {code, message, data} 返回结构
 */

const url = "https://60s.viki.moe/v2/60s";

$task.fetch({
  url: url,
  method: "GET",
  headers: {
    "Accept": "application/json"
  }
}).then(response => {
  if (response.statusCode !== 200) {
    throw new Error("HTTP " + response.statusCode);
  }

  const json = JSON.parse(response.body || "{}");

  console.log("API code: " + json.code);
  console.log("API message: " + (json.message || ""));

  // 实际新闻数据位于 data 字段
  const result = json.data || json;

  let news = result.news;

  // 兼容新闻列表为字符串的情况
  if (typeof news === "string") {
    news = news.split(/\r?\n/).filter(Boolean);
  }

  if (!Array.isArray(news) || news.length === 0) {
    console.log("data 字段：" + Object.keys(result).join(", "));
    throw new Error("未找到新闻数组，请检查 data 内的字段");
  }

  const lines = news.map((item, index) => {
    const title = typeof item === "string"
      ? item
      : (item.title || item.content || "");

    return title ? (index + 1) + ". " + title : "";
  }).filter(Boolean);

  if (lines.length === 0) {
    throw new Error("新闻内容为空");
  }

  const date = result.date || "每日新闻";
  const tip = result.tip || "";

  let message = lines.join("\n");

  if (tip) {
    message += "\n\n每日微语：" + tip;
  }

  if (message.length > 1800) {
    message = message.slice(0, 1800) + "\n…内容已截断";
  }

  $notify("60秒读懂世界", date, message);
  console.log("推送成功，新闻条数：" + lines.length);

}).catch(error => {
  console.log("60秒新闻获取失败：" + error);
  $notify("60秒读懂世界", "获取失败", String(error));
});
