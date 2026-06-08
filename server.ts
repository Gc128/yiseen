import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const localShares = new Map<string, any>();

app.use(express.json({ limit: "64kb" }));

type DeepSeekMessage = { role: "system" | "user"; content: string };

const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 45000);

function getAIKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or DEEPSEEK_API_KEY is missing. Please set it in your server environment.");
  }
  return apiKey;
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateEnergyResult(data: any) {
  if (!isObject(data) || typeof data.dayMaster !== "string" || typeof data.bazi !== "string" || !isObject(data.periods)) {
    throw new Error("AI返回格式不完整");
  }

  for (const key of ["yearly", "monthly", "daily", "hourly"]) {
    const period = data.periods[key];
    if (!isObject(period) || typeof period.title !== "string" || typeof period.subtitle !== "string" || typeof period.description !== "string" || typeof period.score !== "number" || !Array.isArray(period.aspects)) {
      throw new Error(`AI返回缺少${key}周期数据`);
    }
    period.score = Math.max(0, Math.min(100, Math.round(period.score)));
    period.aspects = period.aspects.slice(0, 8).map((aspect: any) => ({
      name: normalizeAspectName(aspect?.name),
      status: String(aspect?.status || "平稳"),
      detail: aspect?.detail ? String(aspect.detail) : ""
    }));
  }

  return data;
}

function normalizeAspectName(name: unknown) {
  const value = String(name || "综合").trim();
  if (value === "情感" || value === "爱情" || value === "关系") return "感情";
  if (value === "工作" || value === "学业") return "事业";
  if (value === "财富" || value === "金钱") return "财运";
  if (value === "身体") return "健康";
  return value;
}

function extractJson(text: string) {
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

async function generateWithDeepSeek(messages: DeepSeekMessage[]) {
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
      const message = (() => {
        try {
          return JSON.parse(bodyText)?.error?.message || bodyText;
        } catch {
          return bodyText;
        }
      })();
      const error: any = new Error(message || `DeepSeek API error ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const body = JSON.parse(bodyText);
    const content = body?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI没有返回有效的能量结果");
    }
    return validateEnergyResult(extractJson(content));
  } finally {
    clearTimeout(timeout);
  }
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/api/share", (req, res) => {
  try {
    const { userInput, result, targetTimes } = req.body || {};
    if (!isObject(userInput) || !isObject(result) || !isObject(targetTimes)) {
      return res.status(400).json({ error: "分享数据不完整" });
    }

    const validResult = validateEnergyResult(result);
    const shareId = randomUUID().replace(/-/g, "").slice(0, 20);
    const record = {
      id: shareId,
      shareId,
      userInput,
      targetYear: targetTimes.targetYear || null,
      targetMonth: targetTimes.targetMonth || null,
      targetDay: targetTimes.targetDay || null,
      targetHour: targetTimes.targetHour || null,
      bazi: validResult.bazi || "",
      dayMaster: validResult.dayMaster || "",
      periods: validResult.periods || {},
      score: validResult.periods?.yearly?.score || 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365
    };
    localShares.set(shareId, record);
    res.json({ shareId });
  } catch (err: any) {
    console.error("Create share error:", err);
    res.status(500).json({ error: err.message || "分享创建失败" });
  }
});

app.get("/api/share/:shareId", (req, res) => {
  const shareId = String(req.params.shareId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const record = localShares.get(shareId);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(404).json({ error: "分享链接不存在或已失效" });
  }
  res.json(record);
});

// Psychological Energy Astrological calculation API
app.post("/api/calculate-energy", async (req, res) => {
  try {
    const { gender, birthYear, birthMonth, birthDay, birthHour, province, city, targetYear, targetMonth, targetDay, targetHour } = req.body;

    if (!gender || !birthYear || !birthMonth || !birthDay) {
      return res.status(400).json({ error: "请填写完整的信息" });
    }

    const systemInstruction = `你是一位精通现代心理学和中国传统八字命理的“能量美学测算家”。...你的测算调性如同高级生活馆或无印良品(MUJI)风格：温暖、沉静、回归本真、富含诗意与留白，绝对排斥玄学宿命论、迷信恐吓。

最核心的要求：所有输出的文案（包括 description 和各项 detail）必须极度精简、凝练，如古人批八字的口诀或短文，一语中的，但又要融入现代心理学的美感。不要有任何多余的废话和长篇大论。句子结构紧凑。

格式参考示例：
示例1："命局中食伤 (火) 与财星 (土) 皆旺，意味着您天性聪慧，富有才华与表现欲。但八字缺金 (官杀)，官星不透，在纪律、规则面前容易感到束缚，需自我鞭策方能掌权。"
示例2："乙木身弱，喜水来滋养，木来帮扶，最忌火来耗身，土来重压，金来砍伐。"

请根据用户输入的信息，结合他们想要测算的具体流时、流日、流月、流年，严格执行“极度精简”的输出标准，返回JSON。
各时段副标题(subtitle)直接体现时间（如 "${targetYear || '当年'}年", "${targetMonth || '当月'}月"）。
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
}
`;

    const prompt = `请立刻进行能量美学测算。
性别：${gender}
出生公历：${birthYear}年${birthMonth}月${birthDay}日 ${birthHour !== undefined ? birthHour + '点' : '未知'}
地区：${province}-${city}

需要测算的目标时间段：
- 流年：${targetYear || '当年'}年
- 流月：${targetMonth || '当月'}月
- 流日：${targetDay || '当日'}日
- 流时：${targetHour || '当前时辰'}`;

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
      } catch (err: any) {
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
  } catch (err: any) {
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

// Configure Vite or Serve static files
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Yiseen Server] running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error("Failed to start server:", err);
});
