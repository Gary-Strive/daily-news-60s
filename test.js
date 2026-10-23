
/**
 * 每日60S — Quantumult X 版
 * 基于 Nullwhy/Egern 的 Day60s 模块转换
 *
 * 功能：
 * 1. 通知正文显示新闻文字和每日微语
 * 2. 点击通知打开对应日期的 HTML 海报
 * 3. 关联 GitHub Pages
 * 4. 同日允许多次推送
 * 5. 保留备用 API、多条通知、新闻数量限制
 */

const SCRIPT_NAME = "每日60S";
const TITLE_MAIN = "每日60S · 读懂世界 💭";
const SCRIPT_VERSION = "QX-v1.1";

// ===== 用户配置 =====
const API_URL = "https://60s-api.viki.moe/v2/60s";
const FALLBACK_APIS = [
  "https://60s.viki.moe/v2/60s"
];

const MAX_NEWS = 5;          // 0=全部新闻
const MULTI_NOTIFY = false;  // true=拆分为多条通知
const CHUNK_SIZE = 5;        // 每条通知新闻数

// HTML 海报页面
const HTML_URL = "https://gary-strive.github.io/daily60s/";

// 同日允许多次推送
const ALLOW_REPEAT = true;

// 保留原配置项，但不再用于同日去重
const STORE_KEY = "60s_last_date_qx";

// ===== 基础工具 =====
function log(message) {
  console.log("[" + SCRIPT_NAME + "] " + message);
}

function getError(error) {
  return String(error && error.message ? error.message : error);
}

function stripLeadingIndex(text) {
  return String(text || "")
    .replace(/^\s*\d+\s*[.．、:：]\s*/, "")
    .trim();
}

function chunkArray(array, size) {
  const result = [];
  const step = Math.max(1, size);

  for (let i = 0; i < array.length; i += step) {
    result.push(array.slice(i, i + step));
  }

  return result.length ? result : [[]];
}

function buildBody(news, startIndex, tip) {
  const lines = news.map((item, index) => {
    let title = typeof item === "string"
      ? item
      : item && (item.title || item.text || item.content);

    title = stripLeadingIndex(title || "");
    return title ? (startIndex + index + 1) + ". " + title : "";
  }).filter(Boolean);

  if (tip) {
    lines.push("");
    lines.push("【微语】" + String(tip)
      .replace(/^\s*【\s*微语\s*】\s*/, "")
      .trim());
  }

  return lines.join("\n") || "暂无新闻";
}

function buildSubtitle(data) {
  const parts = [];

  if (data.date) parts.push(data.date);
  if (data.day_of_week) parts.push(data.day_of_week);

  let result = parts.join("  ");

  if (data.lunar_date) {
    result += (result ? "  ·  " : "") + data.lunar_date;
  }

  return result || "读懂世界";
}

// ===== HTML 海报地址 =====
function buildHTMLURL(date) {
  let url = HTML_URL;

  // 日期参数用于让网页识别对应日期
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    url += "?date=" + encodeURIComponent(date);
  }

  return url;
}

// ===== QX 请求 =====
function fetchJSON(url) {
  return $task.fetch({
    url: url,
    method: "GET",
    headers: {
      "Accept": "application/json",
      "User-Agent": "QuantumultX-60s/" + SCRIPT_VERSION
    },
    timeout: 10000
  }).then(function (response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error("HTTP " + response.statusCode);
    }

    let json;

    try {
      json = JSON.parse(response.body || "{}");
    } catch (e) {
      throw new Error("JSON 解析失败");
    }

    if (!json || (!json.data && json.code !== 200)) {
      throw new Error("API 返回数据异常");
    }

    return json;
  });
}

function loadNews() {
  const urls = [];

  [API_URL].concat(FALLBACK_APIS).forEach(function (url) {
    if (url && urls.indexOf(url) === -1) {
      urls.push(url);
    }
  });

  function tryNext(index, lastError) {
    if (index >= urls.length) {
      throw lastError || new Error("所有 API 均请求失败");
    }

    return fetchJSON(urls[index]).catch(function (error) {
      log("接口 " + (index + 1) + " 失败：" + getError(error));
      return tryNext(index + 1, error);
    });
  }

  return tryNext(0, null);
}

// ===== QX 通知 =====
function notify(title, subtitle, body, openURL) {
  const options = {};

  if (openURL && /^https?:\/\//i.test(openURL)) {
    options["open-url"] = openURL;
  }

  $notify(title, subtitle, body, options);
}

// ===== 主流程 =====
function main() {
  log("开始运行 " + SCRIPT_VERSION);

  return loadNews().then(function (json) {
    const data = json.data || json;
    const date = data.date || "";
    let news = Array.isArray(data.news) ? data.news.slice() : [];
    const tip = data.tip || "";

    if (!news.length) {
      throw new Error("新闻列表为空");
    }

    // 新闻条数限制
    if (MAX_NEWS > 0) {
      news = news.slice(0, MAX_NEWS);
    }

    // 生成带日期参数的 HTML 海报地址
    const openURL = buildHTMLURL(date);
    const subtitle = buildSubtitle(data);

    // 生成一条或多条通知
    const chunks = MULTI_NOTIFY
      ? chunkArray(news, CHUNK_SIZE)
      : [news];

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const startIndex = MULTI_NOTIFY ? i * CHUNK_SIZE : 0;

      const title = chunks.length > 1
        ? TITLE_MAIN + " (" + (i + 1) + "/" + chunks.length + ")"
        : TITLE_MAIN;

      const body = buildBody(
        chunks[i],
        startIndex,
        isLast ? tip : ""
      );

      // 每条通知均打开对应日期的 HTML 页面
      notify(title, subtitle, body, openURL);
    }

    // ALLOW_REPEAT=true：不读取、不写入同日去重状态
    log("推送完成，新闻 " + news.length + " 条");
    log("海报地址：" + openURL);
    log("同日重复推送：已允许");
  });
}

// 保证任务结束
main().catch(function (error) {
  log("运行失败：" + getError(error));

  try {
    $notify(
      TITLE_MAIN,
      "获取失败",
      getError(error).slice(0, 200)
    );
  } catch (_) {
    // 忽略通知错误
  }
}).then(function () {
  $done();
});
