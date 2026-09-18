import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import OpenAI from "openai";
import {
  AskTutorBody,
  AskTutorResponse,
  CheckSecurityHeadersBody,
  CheckSecurityHeadersResponse,
  CreateExamBody,
  CreateExamResponse,
  CreateQuestionBody,
  CreateQuestionResponse,
  GenerateQuestionsBody,
  GenerateQuestionsResponse,
  GetCurrentUserResponse,
  GetDashboardSummaryResponse,
  GetExamsQueryParams,
  GetExamsResponse,
  GetQuestionsQueryParams,
  GetQuestionsResponse,
  GetPublicQuestionsQueryParams,
  GetPublicQuestionsResponse,
  GetSecurityCvesQueryParams,
  GetSecurityCvesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type Exam = {
  id: number;
  title: string;
  subject: string;
  questionCount: number;
  durationMinutes: number;
  price: number;
  status: "Published" | "Draft" | "Private";
  attempts: number;
};

type Question = {
  id: number;
  prompt: string;
  subject: string;
  type: "Multiple Choice" | "True/False" | "Theory";
  difficulty: "Easy" | "Medium" | "Hard";
  usageCount: number;
  source: string;
};

const exams: Exam[] = [
  { id: 1, title: "Physics: Mechanics Mastery", subject: "Physics", questionCount: 50, durationMinutes: 45, price: 4500, status: "Published", attempts: 248 },
  { id: 2, title: "Mathematics: Algebra Drill", subject: "Mathematics", questionCount: 40, durationMinutes: 35, price: 0, status: "Published", attempts: 512 },
  { id: 3, title: "Chemistry: Organic Chemistry", subject: "Chemistry", questionCount: 50, durationMinutes: 50, price: 3000, status: "Published", attempts: 184 },
  { id: 4, title: "English Language: WAEC Practice", subject: "English", questionCount: 60, durationMinutes: 55, price: 0, status: "Published", attempts: 729 },
];

const questions: Question[] = [
  { id: 1, prompt: "A car accelerates uniformly from rest at 3 m/s² for 8 seconds. What is its final velocity?", subject: "Physics", type: "Multiple Choice", difficulty: "Medium", usageCount: 42, source: "XADON core bank" },
  { id: 2, prompt: "Which organelle is responsible for aerobic respiration in a eukaryotic cell?", subject: "Biology", type: "Multiple Choice", difficulty: "Easy", usageCount: 68, source: "XADON core bank" },
  { id: 3, prompt: "Explain how changing concentration affects the equilibrium position of a reversible reaction.", subject: "Chemistry", type: "Theory", difficulty: "Hard", usageCount: 17, source: "Teacher review queue" },
  { id: 4, prompt: "If 2x + 7 = 19, find the value of x.", subject: "Mathematics", type: "Multiple Choice", difficulty: "Easy", usageCount: 95, source: "XADON core bank" },
  { id: 5, prompt: "The passive voice is used when the action is more important than the actor.", subject: "English", type: "True/False", difficulty: "Medium", usageCount: 31, source: "WAEC skills practice" },
];

const nextId = (items: { id: number }[]) => Math.max(0, ...items.map((item) => item.id)) + 1;

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

async function getCurrentUser(req: Request) {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const user = await clerkClient.users.getUser(userId);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "XADON learner";
  return {
    id: Number.parseInt(user.id.replace(/\D/g, "").slice(-8) || "1", 10),
    name,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    role: "student" as const,
    streak: 4,
  };
}

router.get("/auth/me", async (req, res): Promise<void> => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    res.json(GetCurrentUserResponse.parse(user));
  } catch (error) {
    req.log.error({ error }, "Failed to load current Clerk user");
    res.status(401).json({ error: "Authentication could not be verified" });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.sendStatus(204);
});

router.get("/dashboard/summary", requireAuth, (_req, res): void => {
  res.json(GetDashboardSummaryResponse.parse({
    questions: questions.length + 127,
    exams: exams.length,
    accuracy: 78,
    studyMinutes: 286,
    streak: 4,
    recentActivity: [
      { id: "activity-1", label: "Completed Algebra Drill", detail: "38 / 40 correct", time: "2 hours ago" },
      { id: "activity-2", label: "Reviewed a Physics explanation", detail: "Mechanics", time: "Yesterday" },
      { id: "activity-3", label: "Kept your daily streak", detail: "4 days in a row", time: "Yesterday" },
    ],
  }));
});

router.get("/exams", requireAuth, (req, res): void => {
  const parsed = GetExamsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const search = parsed.data.search?.toLowerCase();
  const subject = parsed.data.subject?.toLowerCase();
  const filtered = exams.filter((exam) =>
    (!search || exam.title.toLowerCase().includes(search)) &&
    (!subject || exam.subject.toLowerCase().includes(subject)),
  );
  res.json(GetExamsResponse.parse(filtered));
});

router.post("/exams", requireAuth, (req, res): void => {
  const parsed = CreateExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const exam: Exam = {
    id: nextId(exams),
    title: parsed.data.title,
    subject: parsed.data.subject,
    durationMinutes: parsed.data.durationMinutes,
    price: parsed.data.price ?? 0,
    questionCount: 0,
    status: "Draft",
    attempts: 0,
  };
  exams.unshift(exam);
  res.status(201).json(CreateExamResponse.parse(exam));
});

router.get("/questions", requireAuth, (req, res): void => {
  const parsed = GetQuestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const search = parsed.data.search?.toLowerCase();
  const subject = parsed.data.subject?.toLowerCase();
  const filtered = questions
    .filter((question) =>
      (!search || question.prompt.toLowerCase().includes(search)) &&
      (!subject || question.subject.toLowerCase().includes(subject)) &&
      (!parsed.data.difficulty || question.difficulty === parsed.data.difficulty),
    )
    .slice(0, parsed.data.limit ?? 50);
  res.json(GetQuestionsResponse.parse(filtered));
});

router.post("/questions", requireAuth, (req, res): void => {
  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const question: Question = {
    id: nextId(questions),
    prompt: parsed.data.prompt,
    subject: parsed.data.subject,
    type: parsed.data.type,
    difficulty: parsed.data.difficulty,
    usageCount: 0,
    source: parsed.data.source ?? "Workspace author",
  };
  questions.unshift(question);
  res.status(201).json(CreateQuestionResponse.parse(question));
});

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

router.get("/public/questions", async (req, res): Promise<void> => {
  const parsed = GetPublicQuestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const amount = parsed.data.amount ?? 12;
  const url = new URL("https://opentdb.com/api.php");
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("type", "multiple");
  if (parsed.data.category) url.searchParams.set("category", parsed.data.category);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      res.status(502).json({ error: "Public question source is unavailable" });
      return;
    }
    const body = (await response.json()) as { results?: Array<{ question: string; category: string; difficulty: string; correct_answer: string; incorrect_answers: string[] }> };
    const result = (body.results ?? []).map((item, index) => ({
      id: `opentdb-${index}-${Buffer.from(item.question).toString("base64url").slice(0, 10)}`,
      prompt: decodeHtml(item.question),
      category: decodeHtml(item.category),
      difficulty: item.difficulty,
      options: [...item.incorrect_answers, item.correct_answer].map(decodeHtml).sort(),
      answer: decodeHtml(item.correct_answer),
    }));
    res.json(GetPublicQuestionsResponse.parse(result));
  } catch (error) {
    req.log.error({ error }, "Public question provider failed");
    res.status(502).json({ error: "Public question source is unavailable" });
  }
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function askOpenAI(instructions: string): Promise<string> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_completion_tokens: 1200,
    messages: [
      { role: "system", content: "You are a patient secondary-school tutor. Explain clearly, use Nigerian curriculum context where useful, and never help with unauthorized access, exploitation, credential theft, or evasion." },
      { role: "user", content: instructions },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

router.post("/ai/tutor", requireAuth, async (req, res): Promise<void> => {
  const parsed = AskTutorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const answer = await askOpenAI(`Subject: ${parsed.data.subject}. Level: ${parsed.data.level ?? "secondary school"}. Student question: ${parsed.data.prompt}\n\nGive a concise explanation, one worked example, and one quick check question.`);
    res.json(AskTutorResponse.parse({ answer, sources: ["OpenAI tutor · teacher review recommended"], mode: "AI-assisted · review recommended" }));
  } catch (error) {
    req.log.error({ error }, "AI tutor request failed");
    res.status(502).json({ error: "The AI tutor is unavailable. Check the server AI configuration." });
  }
});

router.post("/ai/generate", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const raw = await askOpenAI(`Create exactly ${parsed.data.count} multiple-choice question drafts for ${parsed.data.subject}, topic ${parsed.data.topic}, difficulty ${parsed.data.difficulty}. Return only valid JSON with this shape: {"questions":[{"prompt":"...","answer":"...","explanation":"...","distractors":["...","...","..."]}]}.`);
    const json = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as { questions?: unknown[] };
    res.json(GenerateQuestionsResponse.parse(json.questions ?? []));
  } catch (error) {
    req.log.error({ error }, "AI question generation failed");
    res.status(502).json({ error: "Question generation is unavailable. Try again after checking the server AI configuration." });
  }
});

router.get("/security/cves", async (req, res): Promise<void> => {
  const parsed = GetSecurityCvesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
  url.searchParams.set("resultsPerPage", String(parsed.data.limit ?? 10));
  if (parsed.data.keyword) url.searchParams.set("keywordSearch", parsed.data.keyword);
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      res.status(502).json({ error: "CVE source is unavailable" });
      return;
    }
    const body = (await response.json()) as { vulnerabilities?: Array<{ cve: { id: string; published?: string; descriptions?: Array<{ lang: string; value: string }>; metrics?: { cvssMetricV31?: Array<{ cvssData?: { baseSeverity?: string } }> } } }> };
    const result = (body.vulnerabilities ?? []).map(({ cve }) => ({
      id: cve.id,
      summary: cve.descriptions?.find((item) => item.lang === "en")?.value ?? "No summary supplied",
      severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity ?? "Unknown",
      published: cve.published?.slice(0, 10) ?? "Unknown",
    }));
    res.json(GetSecurityCvesResponse.parse(result));
  } catch (error) {
    req.log.error({ error }, "CVE provider failed");
    res.status(502).json({ error: "CVE source is unavailable" });
  }
});

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1" || host === "169.254.169.254") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

router.post("/security/headers", requireAuth, async (req, res): Promise<void> => {
  const parsed = CheckSecurityHeadersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const target = new URL(parsed.data.url);
    if (!["http:", "https:"].includes(target.protocol) || isPrivateHost(target.hostname)) {
      res.status(400).json({ error: "Only public HTTP(S) domains are allowed." });
      return;
    }
    const response = await fetch(target, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
    const checks = [
      ["Strict-Transport-Security", "Use HTTPS with a strict transport policy."],
      ["Content-Security-Policy", "Define a Content Security Policy to reduce script injection risk."],
      ["X-Content-Type-Options", "Set nosniff to prevent MIME sniffing."],
      ["Referrer-Policy", "Limit referrer leakage across origins."],
      ["Permissions-Policy", "Disable browser capabilities the site does not need."],
      ["X-Frame-Options", "Prevent untrusted framing or use frame-ancestors in CSP."],
    ].map(([name, recommendation]) => ({ name, present: response.headers.has(name), recommendation }));
    const score = Math.round((checks.filter((item) => item.present).length / checks.length) * 100);
    res.json(CheckSecurityHeadersResponse.parse({
      url: target.toString(),
      score,
      checks,
      note: "This read-only audit checks response headers only. Use it on domains you own or are authorized to assess.",
    }));
  } catch (error) {
    req.log.error({ error }, "Header audit failed");
    res.status(502).json({ error: "The target did not return a readable response." });
  }
});

export default router;