/**
 * 60秒读懂世界 - Quantumult X
 * 数据源：vikiboss/60s
 * 建议定时：每天 08:30
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
    throw new Error("HTTP 状态码：" + response.statusCode);
  }

  const data = JSON.parse(response.body);

  if (!data || !Array.isArray(data.news)) {
    throw new Error("新闻数据格式异常");
  }

  const date = data.date || "每日新闻";

  const newsText = data.news.map((item, index) => {
    const title = typeof item === "string"
      ? item
      : item.title;

    return title ? (index + 1) + ". " + title : "";
  }).filter(Boolean).join("\n");

  const tip = data.tip
    ? "\n\n每日微语：" + data.tip
    : "";

  if (!newsText) {
    throw new Error("新闻列表为空");
  }

  // 避免单条系统通知内容过长
  const maxLength = 1800;
  let message = newsText + tip;

  if (message.length > maxLength) {
    message = message.slice(0, maxLength) + "\n…内容已截断";
  }

  $notify("60秒读懂世界", date, message);
  console.log("60秒新闻推送成功：" + date);

}).catch(error => {
  console.log("60秒新闻获取失败：" + error);
  $notify(
    "60秒读懂世界",
    "新闻获取失败",
    String(error)
  );
});
