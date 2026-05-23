"use client";
import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";

type Difficulty = 4 | 8;
type ComplementType = "ones" | "twos";
type QuizState = "answering" | "correct" | "wrong";

function randomBinary(bits: Difficulty): string {
  const max = (1 << bits) - 1;
  return Math.floor(Math.random() * (max + 1))
    .toString(2)
    .padStart(bits, "0");
}

function onesComplement(bin: string): string {
  return bin.split("").map((b) => (b === "0" ? "1" : "0")).join("");
}

function twosComplement(bin: string): string {
  const ones = onesComplement(bin);
  let carry = 1;
  const arr = ones.split("").reverse().map((b) => {
    const s = parseInt(b) + carry;
    carry = s >> 1;
    return (s & 1).toString();
  });
  return arr.reverse().join("").slice(-bin.length);
}

function BitCell({ value, color = "primary" }: { value: string; color?: "primary" | "warning" }) {
  const colors = {
    primary: { bg: "#e3f2fd", border: "#90caf9", text: "#1565c0" },
    warning: { bg: "#fff8e1", border: "#ffe082", text: "#f57f17" },
  };
  const c = colors[color];
  return (
    <Box
      sx={{
        width: 44,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: 1.5,
        fontFamily: "monospace",
        fontSize: "1.4rem",
        fontWeight: 700,
        color: c.text,
      }}
    >
      {value}
    </Box>
  );
}

export default function ComplementQuiz() {
  const [bits, setBits] = useState<Difficulty>(4);
  const [complementType, setComplementType] = useState<ComplementType>("twos");
  const [current, setCurrent] = useState(() => randomBinary(4));
  const [input, setInput] = useState("");
  const [quizState, setQuizState] = useState<QuizState>("answering");
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const correct =
    complementType === "twos" ? twosComplement(current) : onesComplement(current);

  const next = useCallback(() => {
    setCurrent(randomBinary(bits));
    setInput("");
    setQuizState("answering");
    setShowHint(false);
  }, [bits]);

  const check = () => {
    const normalized = input.padStart(bits, "0");
    const isCorrect = normalized === correct;
    setQuizState(isCorrect ? "correct" : "wrong");
    setTotal((t) => t + 1);
    if (isCorrect) setScore((s) => s + 1);
  };

  const changeBits = (b: Difficulty) => {
    setBits(b);
    setCurrent(randomBinary(b));
    setInput("");
    setQuizState("answering");
    setShowHint(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (quizState === "answering" && input.length > 0) check();
      else if (quizState !== "answering") next();
    }
  };

  return (
    <Stack spacing={3}>
      {/* Settings bar */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" fontWeight={500}>ビット数:</Typography>
            <ButtonGroup size="small" variant="outlined">
              {([4, 8] as Difficulty[]).map((b) => (
                <Button
                  key={b}
                  onClick={() => changeBits(b)}
                  variant={bits === b ? "contained" : "outlined"}
                >
                  {b}ビット
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" fontWeight={500}>補数:</Typography>
            <ButtonGroup size="small" variant="outlined" color="secondary">
              {(["ones", "twos"] as ComplementType[]).map((t) => (
                <Button
                  key={t}
                  onClick={() => { setComplementType(t); setInput(""); setQuizState("answering"); }}
                  variant={complementType === t ? "contained" : "outlined"}
                >
                  {t === "ones" ? "1の補数" : "2の補数"}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
          <Chip
            label={`スコア: ${score} / ${total}`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      </Paper>

      {/* Problem card */}
      <Card variant="outlined" sx={{ borderWidth: 2 }}>
        <CardContent sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            次の{bits}ビット2進数の
            <Typography component="span" color="secondary.main" fontWeight={700}>
              {" "}{complementType === "ones" ? "1の補数" : "2の補数"}
            </Typography>
            を求めてください
          </Typography>

          {/* Binary display */}
          <Stack direction="row" spacing={0.75} justifyContent="center" my={3}>
            {current.split("").map((bit, i) => (
              <BitCell key={i} value={bit} />
            ))}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            (10進数:{" "}
            <Typography component="span" variant="caption" fontWeight={700} color="text.primary">
              {parseInt(current, 2)}
            </Typography>
            )
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Input area */}
          {quizState === "answering" && (
            <Stack spacing={2} alignItems="center">
              <TextField
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^01]/g, "").slice(0, bits))}
                onKeyDown={handleKeyDown}
                placeholder={`${bits}ビットの2進数を入力 (0と1のみ)`}
                inputProps={{ style: { textAlign: "center", fontFamily: "monospace", fontSize: "1.2rem", letterSpacing: "0.2em" } }}
                sx={{ maxWidth: 300 }}
                autoFocus
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={check}
                  disabled={input.length === 0}
                  size="large"
                >
                  答え合わせ
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowHint(!showHint)}
                >
                  {showHint ? "ヒントを隠す" : "ヒントを見る"}
                </Button>
              </Stack>

              <Collapse in={showHint}>
                <Alert severity="warning" sx={{ textAlign: "left", maxWidth: 360 }}>
                  <AlertTitle>
                    {complementType === "ones" ? "1の補数の求め方" : "2の補数の求め方"}
                  </AlertTitle>
                  {complementType === "ones" ? (
                    <Typography variant="body2">
                      各ビットを反転させます（0→1, 1→0）
                    </Typography>
                  ) : (
                    <Box component="ol" sx={{ pl: 2, m: 0 }}>
                      <li><Typography variant="body2">全ビットを反転（1の補数を求める）</Typography></li>
                      <li><Typography variant="body2">結果に1を加える</Typography></li>
                    </Box>
                  )}
                </Alert>
              </Collapse>
            </Stack>
          )}

          {/* Result */}
          {quizState !== "answering" && (
            <Stack spacing={2} alignItems="center">
              <Alert
                severity={quizState === "correct" ? "success" : "error"}
                sx={{ width: "100%", maxWidth: 400, textAlign: "left" }}
              >
                <AlertTitle>{quizState === "correct" ? "✓ 正解！" : "✗ 不正解"}</AlertTitle>
                {quizState === "wrong" && (
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      あなたの答え:{" "}
                      <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700, color: "error.main" }}>
                        {input.padStart(bits, "0")}
                      </Box>
                    </Typography>
                    <Typography variant="body2">
                      正解:{" "}
                      <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700, color: "success.main" }}>
                        {correct}
                      </Box>
                      {" "}(= {parseInt(correct, 2)})
                    </Typography>
                    {complementType === "twos" && (
                      <Box sx={{ mt: 1, p: 1.5, bgcolor: "background.default", borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" fontWeight={700} mb={0.5}>
                          解説:
                        </Typography>
                        <Typography variant="caption" display="block" fontFamily="monospace">
                          {current} の1の補数:{" "}
                          <Box component="span" color="secondary.main" fontWeight={700}>
                            {onesComplement(current)}
                          </Box>
                        </Typography>
                        <Typography variant="caption" display="block" fontFamily="monospace">
                          +1 ={" "}
                          <Box component="span" color="success.main" fontWeight={700}>
                            {correct}
                          </Box>
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                )}
              </Alert>
              <Button variant="contained" onClick={next} size="large">
                次の問題 →
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Alert severity="info">
        <AlertTitle>{complementType === "ones" ? "1の補数とは" : "2の補数とは"}</AlertTitle>
        <Typography variant="body2">
          {complementType === "ones"
            ? "全ビットを反転したもの。元の数と足すと全ビットが1になります。"
            : "1の補数に1を加えたもの。コンピュータで負の数を表現するために使われます。元の数と足すとキャリーが発生し、結果は0になります。"}
        </Typography>
      </Alert>
    </Stack>
  );
}
