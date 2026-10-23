/**
 * 每日60S — Quantumult X 版
 * 基于 Nullwhy/Egern 的 Day60s 模块转换
 * 保留：定时推送、新闻条数、多条通知、海报跳转、同日去重、备用 API
 *
 * QX 配置项均在下方修改。
 */

const SCRIPT_NAME = "每日60S";
const TITLE_MAIN = "每日60S · 读懂世界 💭";
const SCRIPT_VERSION = "QX-v1.0";

// ===== 用户配置 =====
const API_URL = "https://60s-api.viki.moe/v2/60s";
const FALLBACK_APIS = [
  "https://60s.viki.moe/v2/60s"
];

const MAX_NEWS = 5;          // 0=全部新闻
const MULTI_NOTIFY = false;  // true=拆分为多条通知
const CHUNK_SIZE = 5;         // 每条通知新闻数
const OPEN_URL = "image";     // image=点击打开海报，none=不跳转
const ALLOW_REPEAT = false;   // false=同日只推送一次

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
      : item && (item.title || item.text);

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

// ===== 海报地址 =====
function resolveImageURL(image) {
  let url = String(image || "").trim();

  if (url.indexOf("//") === 0) {
    url = "https:" + url;
  }

  if (!/^https?:\/\//i.test(url)) {
    if (/^[a-z0-9.-]+\//i.test(url)) {
      url = "https://" + url;
    } else {
      return "";
    }
  }

  url = url.replace(/^http:\/\//i, "https://");

  if (/^data:/i.test(url)) return "";

  return url;
}

function posterByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return "";
  }

  return "https://cdn.jsdmirror.com/gh/vikiboss/60s-static-host@main/static/images/"
    + date + ".png";
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
    const data = json.data || {};
    const date = data.date || "";
    let news = Array.isArray(data.news) ? data.news.slice() : [];
    const tip = data.tip || "";

    if (!news.length) {
      throw new Error("新闻列表为空");
    }

    // 同日去重
    if (!ALLOW_REPEAT && date) {
      const lastDate = $prefs.valueForKey(STORE_KEY);

      if (lastDate === date) {
        log("今日已推送，跳过：" + date);
        return;
      }
    }

    // 新闻条数限制
    if (MAX_NEWS > 0 && !MULTI_NOTIFY) {
      news = news.slice(0, MAX_NEWS);
    } else if (MAX_NEWS > 0 && MULTI_NOTIFY && MAX_NEWS > CHUNK_SIZE) {
      news = news.slice(0, MAX_NEWS);
    }

    // 图片跳转
    let openURL = "";

    if (OPEN_URL.toLowerCase() === "image") {
      openURL = resolveImageURL(data.image || data.cover || "");
      if (!openURL) {
        openURL = posterByDate(date);
      }

      // 若没有海报地址，退回官方图片接口
      if (!openURL) {
        openURL = "https://60s.viki.moe/v2/60s?encoding=image";
      }
    }

    const chunks = MULTI_NOTIFY
      ? chunkArray(news, CHUNK_SIZE)
      : [news];

    const subtitle = buildSubtitle(data);

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

      // 仅最后一条通知附加图片跳转
      notify(
        title,
        subtitle,
        body,
        isLast ? openURL : ""
      );
    }

    // 保存日期，防止当天重复推送
    if (!ALLOW_REPEAT && date) {
      $prefs.setValueForKey(date, STORE_KEY);
    }

    log("推送完成，新闻 " + news.length + " 条");
  });
}

// 保证任务结束，避免长期显示为活跃 JS
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
