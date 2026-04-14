const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("레지나 서버 정상 작동 중");
});

app.post("/reading", (req, res) => {
  const { question } = req.body;

  res.json({
    result: `질문: ${question}에 대한 리딩 결과입니다.`
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
