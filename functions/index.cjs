const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
require("dotenv").config();

const app = express();
app.use(express.json({ limit: "64kb" }));

const adminApp = initializeApp();
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "ai-studio-9e78684d-5bd5-4001-9fa5-f6b8a6fda0e8";
const db = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 45000);

function getAIKey() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or DEEPSEEK_API_KEY is missing. Please set it in your server environment.");
  }
  return apiKey;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAspectName(name) {
  const value = String(name || "综合").trim();
  if (value === "情感" || value === "爱情" || value === "关系") return "感情";
  if (value === "工作" || value === "学业") return "事业";
  if (value === "财富" || value === "金钱") return "财运";
  if (value === "身体") return "健康";
  return value;
}

function validateEnergyResult(data) {
  if (!isObject(data) || typeof data.dayMaster !== "string" || typeof data.bazi !== "string" || !isObject(data.periods)) {
    throw new Error("AI返回格式不完整");
  }

  for (const key of ["yearly", "monthly", "daily", "hourly"]) {
    const period = data.periods[key];
    if (!isObject(period) || typeof period.title !== "string" || typeof period.subtitle !== "string" || typeof period.description !== "string" || typeof period.score !== "number" || !Array.isArray(period.aspects)) {
      throw new Error(`AI返回缺少${key}周期数据`);
    }
    period.score = Math.max(0, Math.min(100, Math.round(period.score)));
    period.aspects = period.aspects.slice(0, 8).map((aspect) => ({
      name: normalizeAspectName(aspect && aspect.name),
      status: String((aspect && aspect.status) || "平稳"),
      detail: aspect && aspect.detail ? String(aspect.detail) : ""
    }));
  }

  return data;
}

function extractJson(text) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI没有返回有效JSON");
  }
}

async function generateWithDeepSeek(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAIKey()}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.72,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    const bodyText = await response.text();
    if (!response.ok) {
      let message = bodyText;
      try {
        message = JSON.parse(bodyText)?.error?.message || bodyText;
      } catch {}
      const error = new Error(message || `DeepSeek API error ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const body = JSON.parse(bodyText);
    const content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    if (!content) {
      throw new Error("AI没有返回有效的能量结果");
    }
    return validateEnergyResult(extractJson(content));
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/api/share", async (req, res) => {
  try {
    const { userInput, result, targetTimes } = req.body || {};
    if (!isObject(userInput) || !isObject(result) || !isObject(targetTimes)) {
      return res.status(400).json({ error: "分享数据不完整" });
    }

    const validResult = validateEnergyResult(result);
    const shareId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    const record = {
      shareId,
      userInput,
      targetYear: targetTimes.targetYear || null,
      targetMonth: targetTimes.targetMonth || null,
      targetDay: targetTimes.targetDay || null,
      targetHour: targetTimes.targetHour || null,
      bazi: validResult.bazi || "",
      dayMaster: validResult.dayMaster || "",
      periods: validResult.periods || {},
      score: validResult.periods && validResult.periods.yearly ? validResult.periods.yearly.score || 0 : 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365
    };

    await db.collection("sharedCalculations").doc(shareId).set(record);
    res.json({ shareId });
  } catch (err) {
    console.error("Create share error:", err);
    res.status(500).json({ error: err.message || "分享创建失败" });
  }
});

app.get("/api/share/:shareId", async (req, res) => {
  try {
    const shareId = String(req.params.shareId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    if (!shareId) {
      return res.status(404).json({ error: "分享链接不存在或已失效" });
    }
    const snap = await db.collection("sharedCalculations").doc(shareId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "分享链接不存在或已失效" });
    }
    const record = snap.data();
    if (!record || record.expiresAt < Date.now()) {
      return res.status(404).json({ error: "分享链接不存在或已失效" });
    }
    res.json({ id: snap.id, ...record });
  } catch (err) {
    console.error("Fetch share error:", err);
    res.status(500).json({ error: err.message || "分享读取失败" });
  }
});

app.post("/api/calculate-energy", async (req, res) => {
  try {
    const { gender, birthYear, birthMonth, birthDay, birthHour, province, city, targetYear, targetMonth, targetDay, targetHour } = req.body;

    if (!gender || !birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: "请填写完整的信息" });
    }

    const systemInstruction = `你是一位精通现代心理学和中国传统八字命理的“能量美学测算家”。你的测算调性如同高级生活馆或无印良品(MUJI)风格：温暖、沉静、回归本真、富含诗意与留白，绝对排斥玄学宿命论、迷信恐吓。

最核心的要求：所有输出的文案（包括 description 和各项 detail）必须极度精简、凝练，如古人批八字的口诀或短文，一语中的，但又要融入现代心理学的美感。不要有任何多余的废话和长篇大论。句子结构紧凑。

请根据用户输入的信息，结合他们想要测算的具体流时、流日、流月、流年，严格执行“极度精简”的输出标准，返回JSON。
各时段副标题(subtitle)直接体现时间（如 "${targetYear || "当年"}年", "${targetMonth || "当月"}月"）。
各个维度的运势分析(detail)要求10-30字以内精简准确。

只输出一个合法JSON对象，不要Markdown，不要解释。JSON结构必须为：
{
  "dayMaster": "甲木命主",
  "bazi": "戊寅 | 庚申 | 甲辰 | 辛未",
  "periods": {
    "yearly": { "title": "流年", "subtitle": "2026年", "description": "...", "score": 80, "aspects": [{"name":"事业","status":"稳中见进","detail":"..."}] },
    "monthly": { "title": "流月", "subtitle": "6月", "description": "...", "score": 80, "aspects": [{"name":"事业","status":"稳中见进","detail":"..."}] },
    "daily": { "title": "流日", "subtitle": "8日", "description": "...", "score": 80, "aspects": [{"name":"事业","status":"稳中见进","detail":"..."}] },
    "hourly": { "title": "流时", "subtitle": "子时", "description": "...", "score": 80, "aspects": [{"name":"事业","status":"稳中见进","detail":"..."}] }
  }
}`;

    const prompt = `请立刻进行能量美学测算。
性别：${gender}
出生公历：${birthYear}年${birthMonth}月${birthDay}日 ${birthHour !== undefined ? birthHour + "点" : "未知"}
地区：${province}-${city}

需要测算的目标时间段：
- 流年：${targetYear || "当年"}年
- 流月：${targetMonth || "当月"}月
- 流日：${targetDay || "当日"}日
- 流时：${targetHour || "当前时辰"}`;

    let response;
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        response = await generateWithDeepSeek([
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ]);
        break;
      } catch (err) {
        retries--;
        const isUnavailable = err.name === "AbortError" || err.status === 408 || err.status === 429 || err.status >= 500;
        if (isUnavailable && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw err;
        }
      }
    }

    res.json(response);
  } catch (err) {
    console.error("Calculate energy error:", err);
    let errorMessage = err.message || "能量调谐失败，请稍后重试";
    if (err.name === "AbortError" || err.status === 503 || errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
      errorMessage = "目前测算宇宙能量的人数较多，请稍后重试～";
    } else if (err.status === 401 || err.status === 403) {
      errorMessage = "AI接口密钥未配置或无权限，请联系管理员检查环境变量。";
    } else if (err.status === 429 || errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "今日的公共能量接口调用次数已超限，请稍候再试或联系管理员升级配额。";
    }
    res.status(500).json({ error: errorMessage });
  }
});

exports.api = onRequest({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "512MiB",
  concurrency: 80,
  maxInstances: 20,
  secrets: ["OPENAI_API_KEY"]
}, app);
