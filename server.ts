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
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const DEEPSEEK_FALLBACK_MODEL = process.env.DEEPSEEK_FALLBACK_MODEL || "deepseek-v4-flash";
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

function isTransientAIError(err: any) {
  const message = String(err?.message || "");
  return err?.name === "AbortError"
    || err?.status === 408
    || err?.status === 429
    || err?.status >= 500
    || message.includes("503")
    || message.includes("high demand")
    || message.includes("UNAVAILABLE");
}

async function generateWithDeepSeek(messages: DeepSeekMessage[], model = DEEPSEEK_MODEL) {
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
        model,
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

    const systemInstruction = `你是一位精通中国传统八字、节气历法与现代心理学表达的“能量美学测算家”。你的调性像高级生活馆或无印良品(MUJI)：温暖、沉静、准确、留白，绝不制造恐吓、宿命论或迷信焦虑。

推演规则必须更严谨：
1. 用户输入为公历生日，按北京时间/中国常用时区理解；出生地用于辅助地域语境，不要编造经纬度。
2. 八字以年柱、月柱、日柱、时柱为基础；年柱以立春前后为岁首意识，月柱以节气月令为核心，时柱按出生小时落入十二时辰。
3. 先判断日主、月令旺衰、五行偏枯、十神结构，再看流年、流月、流日、流时的层层作用。
4. 流年看全年大势，流月看阶段主题，流日看当天触发点，流时看短时情绪与行动窗口。四层不能互相矛盾，要逐层收束。
5. 若历法细节无法百分百确定，表达为“倾向”“宜”“需留意”，不要假装绝对精确。

文案要求：
- 语言简洁但不要过少，像专业命理师的短札，不要口水话。
- 每个 period.description 写2-3个短句或短段，使用“\\n\\n”分隔也可以；总长度约45-90个汉字。
- 每个 aspect.detail 写20-45个汉字，给出明确原因和行动建议。
- status 保持4-6个字，aspect 固定优先输出：事业、财运、感情、健康。
- score 必须结合喜忌、冲合刑害、旺衰与目标时间强弱给出，不要全部集中在同一分数。

格式参考：
示例1："食伤透而财星动，才华有出口，适合把想法落成作品。\\n\\n但火土偏燥，推进时需留余地，避免因急而失衡。"
示例2："乙木身弱，喜水木滋扶。遇火则才华外放，遇土则压力成形，遇金则规则感增强。"

请根据用户输入的信息，结合他们想要测算的具体流时、流日、流月、流年，返回结构化JSON。
各时段副标题(subtitle)直接体现时间（如 "${targetYear || '当年'}年", "${targetMonth || '当月'}月"）。

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

    const prompt = `请按“排盘依据 -> 旺衰喜忌 -> 流年/月/日/时作用”的顺序在心中推演，但最终只输出JSON。
性别：${gender}
出生公历：${birthYear}年${birthMonth}月${birthDay}日 ${birthHour !== undefined ? birthHour + '点' : '未知'}
地区：${province}-${city}

需要测算的目标时间段：
- 流年：${targetYear || '当年'}年
- 流月：${targetMonth || '当月'}月
- 流日：${targetDay || '当日'}日
- 流时：${targetHour || '当前时辰'}

请保证每个周期的description有2-3个短句/短段，简洁但有判断依据；四个方面至少包含事业、财运、感情、健康。`;

    const messages: DeepSeekMessage[] = [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ];
    const models = Array.from(new Set([DEEPSEEK_MODEL, DEEPSEEK_FALLBACK_MODEL].filter(Boolean)));
    let response;
    let lastError: any;

    for (const model of models) {
      let retries = model === DEEPSEEK_MODEL ? 2 : 1;
      let delay = 800;

      while (retries > 0) {
        try {
          response = await generateWithDeepSeek(messages, model);
          break;
        } catch (err: any) {
          lastError = err;
          retries--;
          if (isTransientAIError(err) && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          break;
        }
      }

      if (response) break;
      if (lastError && !isTransientAIError(lastError)) throw lastError;
    }

    if (!response) throw lastError || new Error("AI没有返回有效的能量结果");

    res.json(response);
  } catch (err: any) {
    console.error("Calculate energy error:", err);
    let errorMessage = err.message || "能量调谐失败，请稍后重试";
    if (err.name === "AbortError" || err.status === 503 || errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
       errorMessage = "当前主模型响应繁忙，备用模型也未能完成，请稍后重试。";
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
