const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODE_GUIDE = {
  short: "한 문단으로 짧고 핵심적으로 작성하세요.",
  standard: "여러 문단으로 상황, 감정, 현실 흐름을 균형 있게 작성하세요.",
  deep: "질문을 세부 포인트로 나눠 깊이 있게 여러 문단으로 답하고 마지막에 총평을 작성하세요.",
};

app.get("/", (req, res) => {
  res.send("레지나 서버 정상 작동 중");
});

app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

app.post("/reading", async (req, res) => {
  try {
    const {
      question,
      mode = "standard",
      cards = [],
      spread = "",
      extra = "",
    } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY 환경변수가 설정되지 않았어요.",
      });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        ok: false,
        error: "question은 필수 문자열이에요.",
      });
    }

    if (!Object.prototype.hasOwnProperty.call(MODE_GUIDE, mode)) {
      return res.status(400).json({
        ok: false,
        error: "mode는 short | standard | deep 중 하나여야 해요.",
      });
    }

    if (!Array.isArray(cards)) {
      return res.status(400).json({
        ok: false,
        error: "cards는 문자열 배열이어야 해요.",
      });
    }

    const systemPrompt = [
      "당신은 레지나타로썰의 한국어 타로 리딩 보조 엔진입니다.",
      "반드시 '내담자님' 호칭을 사용하고, 전체 문장은 '~요' 존댓말로 작성하세요.",
      "위로보다 정리와 결정에 초점을 두세요.",
      "감정 해석과 현실 흐름을 함께 설명하세요.",
      "카드 이름은 결과 문장에 직접 나열하거나 인용하지 마세요.",
      "단순 키워드 나열이나 사전식 해석은 금지합니다.",
      "불안만 키우는 단정적 예언은 피하고, 실행 가능한 조언을 포함하세요.",
      "결과는 반드시 한국어 평문으로만 응답하세요.",
      `출력 형식 규칙: ${MODE_GUIDE[mode]}`,
      mode === "short"
        ? "반드시 한 문단으로만 답하세요."
        : "문단을 자연스럽게 나누어 읽기 쉽게 답하세요.",
      mode === "deep"
        ? "마지막에는 반드시 '총평:'으로 시작하는 종합 정리를 붙이세요."
        : "마지막에는 자연스럽게 핵심 조언을 정리하세요.",
    ].join(" ");

    const userPrompt = [
      `질문: ${question}`,
      `모드: ${mode}`,
      `카드 목록(해석 참고용, 결과에 이름 직접 노출 금지): ${cards.join(", ") || "없음"}`,
      `스프레드: ${spread || "없음"}`,
      `추가 상황: ${extra || "없음"}`,
      mode === "deep"
        ? "요청: 핵심 질문을 세부 질문들로 나눠 각각 답한 뒤 마지막에 총평을 작성하세요."
        : "요청: 질문 맥락에 맞는 자연스러운 상담형 리딩을 작성하세요.",
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const result = completion.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.status(502).json({
        ok: false,
        error: "리딩 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
      });
    }

    return res.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("/reading error:", error);

    return res.status(500).json({
      ok: false,
      error: "서버 오류가 발생했어요.",
      detail: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
