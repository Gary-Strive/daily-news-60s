/**
 * 60秒读懂世界 - QX 图片推送版
 * 低日志、请求超时保护
 */

const apiURL = "https://60s.viki.moe/v2/60s";

$task.fetch({
  url: apiURL,
  method: "GET",
  timeout: 10000,
  headers: {
    "Accept": "application/json"
  }
}).then(response => {
  if (response.statusCode !== 200) {
    throw new Error("HTTP " + response.statusCode);
  }

  const json = JSON.parse(response.body || "{}");
  const data = json.data || json;

  const imageURL =
    typeof data.image === "string" &&
    /^https?:\/\//i.test(data.image)
      ? data.image
      : "https://60s.viki.moe/v2/60s?encoding=image";

  const date = data.date || "今日新闻";

  $notify(
    "📰 60秒读懂世界",
    date + " · 点击查看完整新闻图片",
    "今日新闻长图已准备好，点击此通知查看。",
    { "open-url": imageURL }
  );

  console.log("60s 图片推送成功");

}).catch(error => {
  console.log("60s 图片推送失败");

  $notify(
    "📰 60秒读懂世界",
    "图片获取失败",
    "请检查网络或稍后重试。",
    {
      "open-url": "https://60s.viki.moe/v2/60s?encoding=image"
    }
  );
});
