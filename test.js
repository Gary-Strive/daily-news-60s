/**
 * 60秒读懂世界 - QX API 调试版
 */

const url = "https://60s.viki.moe/v2/60s";

$task.fetch({
  url: url,
  method: "GET",
  headers: {
    "Accept": "application/json"
  }
}).then(response => {
  const body = response.body || "";

  console.log("HTTP状态码：" + response.statusCode);
  console.log("返回内容：" + body.slice(0, 1500));

  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    throw new Error("返回内容不是有效JSON，请查看上方日志");
  }

  console.log("顶层字段：" + Object.keys(data).join(", "));

  // 临时检查，不发送正式新闻通知
  $notify(
    "60秒接口调试",
    "HTTP " + response.statusCode,
    "已获取响应，请查看 QX 日志"
  );

}).catch(error => {
  console.log("接口调试失败：" + error);
  $notify("60秒接口调试失败", "", String(error));
});
