/**
 * 每日 60 秒读懂世界
 *
 * 功能：
 * 1. 通知直接显示新闻内容（最多 5 条）和微语
 * 2. 点击通知打开对应日期的 HTML 新闻海报
 * 3. 允许同一天重复推送，不进行日期去重
 * 4. 主 API 失败时自动尝试备用 API
 *
 * 定时任务示例：
 * cron "0 0 8 * * *" script-path=60s.js, tag=每日60秒新闻
 */

const API_URL = "https://60s-api.viki.moe/v2/60s";
const FALLBACK_APIS = [
  "https://60s.viki.moe/v2/60s"
];

// 新闻最多显示条数；0 表示不限制
const MAX_NEWS = 5;

// false：合并为一条通知
// true：按 CHUNK_SIZE 分批发送多条通知
const MULTI_NOTIFY = false;
const CHUNK_SIZE = 5;

// 点击通知打开的 HTML 新闻海报
const HTML_URL = "https://gary-strive.github.io/daily-news-60s/";

// 允许同一天重复通知
const ALLOW_REPEAT = true;

// ==================== 通用函数 ====================

function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildHTMLURL(date) {
  const base = HTML_URL.replace(/\/+$/, "") + "/";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return base + "?date=" + encodeURIComponent(date);
  }
  return base;
}

function fetchJSON(url) {
  return $task.fetch({
    url: url,
    method: "GET",
    headers: {
      "Accept": "application/json",
      "User-Agent": "Quantumult X"
    },
    timeout: 15000
  }).then(response => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error("HTTP " + response.statusCode);
    }

    let result;
    try {
      result = JSON.parse(response.body);
    } catch (e) {
      throw new Error("API 返回的内容不是有效 JSON");
    }

    if (!result || typeof result !== "object") {
      throw new Error("API 返回的数据格式异常");
    }

    return result;
  });
}

function loadNews() {
  const urls = [API_URL].concat(FALLBACK_APIS);

  function tryNext(index, lastError) {
    if (index >= urls.length) {
      throw lastError || new Error("所有新闻 API 均不可用");
    }

    return fetchJSON(urls[index]).then(result => {
      const data = result.data || result;

      if (!data || !Array.isArray(data.news) || data.news.length === 0) {
        throw new Error("API 未返回有效新闻列表");
      }

      return data;
    }).catch(error => {
      console.log(
        "新闻 API 失败：" + urls[index] + "；原因：" + error.message
      );
      return tryNext(index + 1, error);
    });
  }

  return tryNext(0, null);
}

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function buildSubtitle(data) {
  const parts = [];

  const date = cleanText(data.date) || getToday();
  const weekday = cleanText(
    data.day_of_week || data.weekday || data.week
  );
  const lunar = cleanText(
    data.lunar_date || data.lunar || data.chinese_calendar
  );

  parts.push(date);

  if (weekday) parts.push(weekday);
  if (lunar) parts.push(lunar);

  return parts.join(" · ");
}

function buildBody(news, tip) {
  const lines = [];

  news.forEach((item, index) => {
    let text = "";

    if (typeof item === "string") {
      text = item;
    } else if (item && typeof item === "object") {
      text = cleanText(
        item.title || item.content || item.text || item.name
      );
    }

    if (text) {
      lines.push((index + 1) + ". " + text);
    }
  });

  if (tip) {
    lines.push("");
    lines.push("【微语】");
    lines.push(tip);
  }

  return lines.join("\n");
}

function notify(title, subtitle, body, openURL) {
  $notify(title, subtitle, body, {
    "open-url": openURL
  });
}

// ==================== 主流程 ====================

function main() {
  return loadNews().then(data => {
    const newsList = data.news || [];
    const tip = cleanText(
      data.tip || data.note || data.quote || data.micro_tip
    );

    const date = cleanText(data.date) || getToday();
    const openURL = buildHTMLURL(date);

    let news = newsList.slice();

    if (MAX_NEWS > 0) {
      news = news.slice(0, MAX_NEWS);
    }

    if (news.length === 0) {
      throw new Error("没有可用于推送的新闻");
    }

    const subtitle = buildSubtitle(data);

    if (MULTI_NOTIFY) {
      const size = Math.max(1, CHUNK_SIZE);
      const chunks = [];

      for (let i = 0; i < news.length; i += size) {
        chunks.push(news.slice(i, i + size));
      }

      chunks.forEach((chunk, index) => {
        const body = buildBody(chunk, index === chunks.length - 1 ? tip : "");

        notify(
          "每日60秒新闻（" + (index + 1) + "/" + chunks.length + "）",
          subtitle,
          body,
          openURL
        );
      });
    } else {
      notify(
        "每日60秒读懂世界",
        subtitle,
        buildBody(news, tip),
        openURL
      );
    }

    console.log("新闻推送完成，日期：" + date);
    console.log("海报链接：" + openURL);
  });
}

main()
  .catch(error => {
    console.log("每日60秒新闻推送失败：" + error.message);

    $notify(
      "每日60秒新闻获取失败",
      "请检查网络或 API 状态",
      cleanText(error.message)
    );
  })
  .finally(() => {
    $done();
  });
