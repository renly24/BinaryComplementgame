"use client";
import { useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

type Bits = 4 | 8;
type Step = "ones" | "twos" | "add" | "done";
type StepStatus = "idle" | "correct" | "wrong";

interface Problem {
  bits: Bits;
  minuend: string;
  subtrahend: string;
}

function randomBinary(bits: Bits): string {
  const max = (1 << bits) - 1;
  return Math.floor(Math.random() * (max + 1)).toString(2).padStart(bits, "0");
}

function onesComp(bin: string): string {
  return bin.split("").map((b) => (b === "0" ? "1" : "0")).join("");
}

function twosComp(bin: string): string {
  const ones = onesComp(bin);
  let carry = 1;
  const arr = ones.split("").reverse().map((b) => {
    const s = parseInt(b) + carry;
    carry = s >> 1;
    return (s & 1).toString();
  });
  return arr.reverse().join("").slice(-bin.length);
}

function addBinary(a: string, b: string): { result: string; carry: boolean } {
  const bits = Math.max(a.length, b.length);
  const pa = a.padStart(bits, "0");
  const pb = b.padStart(bits, "0");
  let carry = 0;
  let result = "";
  for (let i = bits - 1; i >= 0; i--) {
    const sum = parseInt(pa[i]) + parseInt(pb[i]) + carry;
    result = (sum & 1).toString() + result;
    carry = sum >> 1;
  }
  return { result, carry: carry === 1 };
}

function generateProblem(bits: Bits): Problem {
  const max = (1 << bits) - 1;
  let a: number, b: number;
  do {
    a = Math.floor(Math.random() * (max + 1));
    b = Math.floor(Math.random() * max) + 1;
  } while (a <= b);
  return {
    bits,
    minuend: a.toString(2).padStart(bits, "0"),
    subtrahend: b.toString(2).padStart(bits, "0"),
  };
}

/* ---- Bit display (read-only) ---- */
function BitRow({ value, color = "default" }: { value: string; color?: "blue" | "orange" | "green" | "default" }) {
  const palette = {
    blue:    { bg: "#e3f2fd", border: "#90caf9", text: "#1565c0" },
    orange:  { bg: "#fff8e1", border: "#ffe082", text: "#e65100" },
    green:   { bg: "#e8f5e9", border: "#a5d6a7", text: "#1b5e20" },
    default: { bg: "#f5f5f5", border: "#bdbdbd", text: "#424242" },
  };
  const c = palette[color];
  return (
    <Stack direction="row" spacing={0.5} justifyContent="center">
      {value.split("").map((bit, i) => (
        <Box
          key={i}
          sx={{
            width: 40, height: 46,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: c.bg, border: `2px solid ${c.border}`,
            borderRadius: 1.5, fontFamily: "monospace",
            fontSize: "1.25rem", fontWeight: 700, color: c.text,
          }}
        >
          {bit}
        </Box>
      ))}
    </Stack>
  );
}

/* ---- Bit input (interactive, cell-by-cell) ---- */
function BitInput({
  bits, value, onChange, disabled, status, onEnter,
}: {
  bits: number; value: string; onChange: (v: string) => void;
  disabled: boolean; status: StepStatus; onEnter?: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const borderColor = status === "correct" ? "#4caf50" : status === "wrong" ? "#f44336" : "#90caf9";
  const bg = status === "correct" ? "#e8f5e9" : status === "wrong" ? "#ffebee" : "#e3f2fd";

  return (
    <Stack direction="row" spacing={0.5} justifyContent="center"
      sx={{ p: 1, border: `2px solid ${borderColor}`, borderRadius: 2, backgroundColor: bg, transition: "all 0.2s" }}>
      {Array.from({ length: bits }).map((_, i) => (
        <Box
          key={i}
          component="input"
          type="text"
          maxLength={1}
          value={value[i] === " " || value[i] === undefined ? "" : value[i]}
          disabled={disabled}
          ref={(el: HTMLInputElement | null) => { refs.current[i] = el; }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = e.target.value.replace(/[^01]/g, "");
            const arr = value.padEnd(bits, " ").split("");
            arr[i] = v || " ";
            onChange(arr.join(""));
            if (v && i < bits - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace" && !value[i]?.trim() && i > 0) {
              refs.current[i - 1]?.focus();
            }
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          sx={{
            width: 40, height: 46, textAlign: "center",
            fontFamily: "monospace", fontSize: "1.25rem", fontWeight: 700,
            border: "1px solid #bdbdbd", borderRadius: 1,
            outline: "none", background: "transparent",
            "&:focus": { borderColor: "#1976d2" },
            "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
          }}
        />
      ))}
    </Stack>
  );
}

/* ---- Step panel ---- */
function StepPanel({
  number, title, active, complete, status, children,
}: {
  number: number; title: string;
  active: boolean; complete: boolean; status: StepStatus;
  children: React.ReactNode;
}) {
  const borderColor = complete ? "#4caf50" : active ? "#1976d2" : "#e0e0e0";
  const bgColor = complete ? "#f1f8e9" : active ? "#e3f2fd" : "#fafafa";

  return (
    <Paper
      variant="outlined"
      sx={{
        border: `2px solid ${borderColor}`, backgroundColor: bgColor,
        p: 2.5, opacity: !active && !complete ? 0.55 : 1,
        transition: "all 0.3s",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
        {complete
          ? <CheckCircleIcon color="success" />
          : <RadioButtonUncheckedIcon color={active ? "primary" : "disabled"} />}
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {status !== "idle" && (
          <Chip
            label={status === "correct" ? "✓ 正解" : "✗ 不正解"}
            size="small"
            color={status === "correct" ? "success" : "error"}
          />
        )}
      </Stack>
      {children}
    </Paper>
  );
}

export default function SubtractionGame() {
  const [bits, setBits] = useState<Bits>(4);
  const [problem, setProblem] = useState<Problem>(() => generateProblem(4));
  const [inputs, setInputs] = useState({ ones: "", twos: "", add: "" });
  const [statuses, setStatuses] = useState<Record<"ones" | "twos" | "add", StepStatus>>({
    ones: "idle", twos: "idle", add: "idle",
  });
  const [step, setStep] = useState<Step>("ones");
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  const correctOnes = onesComp(problem.subtrahend);
  const correctTwos = twosComp(problem.subtrahend);
  const { result: correctAdd, carry: hasCarry } = addBinary(problem.minuend, correctTwos);
  const expectedDec = parseInt(problem.minuend, 2) - parseInt(problem.subtrahend, 2);

  const reset = useCallback((newBits?: Bits) => {
    const b = newBits ?? bits;
    setProblem(generateProblem(b));
    setInputs({ ones: "", twos: "", add: "" });
    setStatuses({ ones: "idle", twos: "idle", add: "idle" });
    setStep("ones");
  }, [bits]);

  const changeBits = (b: Bits) => { setBits(b); reset(b); };

  const check = (which: "ones" | "twos" | "add") => {
    const val = inputs[which].replace(/ /g, "0").padStart(bits, "0");
    const expected = which === "ones" ? correctOnes : which === "twos" ? correctTwos : correctAdd;
    const ok = val === expected;
    setStatuses((s) => ({ ...s, [which]: ok ? "correct" : "wrong" }));
    if (ok) {
      if (which === "ones") setStep("twos");
      else if (which === "twos") setStep("add");
      else { setStep("done"); setScore((s) => s + 1); setTotal((t) => t + 1); }
    } else {
      if (which === "add") setTotal((t) => t + 1);
    }
  };

  const reveal = (which: "ones" | "twos" | "add") => {
    const expected = which === "ones" ? correctOnes : which === "twos" ? correctTwos : correctAdd;
    setInputs((s) => ({ ...s, [which]: expected }));
    setStatuses((s) => ({ ...s, [which]: "correct" }));
    if (which === "ones") setStep("twos");
    else if (which === "twos") setStep("add");
    else setStep("done");
  };

  const isActive = (s: Step) => step === s;
  const isComplete = (s: Step): boolean => {
    if (s === "ones") return statuses.ones === "correct";
    if (s === "twos") return statuses.twos === "correct";
    if (s === "add") return statuses.add === "correct";
    return step === "done";
  };

  return (
    <Stack spacing={3}>
      {/* Settings */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" fontWeight={500}>ビット数:</Typography>
            <ButtonGroup size="small">
              {([4, 8] as Bits[]).map((b) => (
                <Button key={b} onClick={() => changeBits(b)} variant={bits === b ? "contained" : "outlined"}>
                  {b}ビット
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
          <Chip label={`スコア: ${score} / ${total}`} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          <Button variant="outlined" size="small" onClick={() => reset()}>新しい問題</Button>
        </Stack>
      </Paper>

      {/* Problem statement */}
      <Card variant="outlined" sx={{ borderWidth: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={2} fontWeight={500}>
            2の補数を使って次の引き算を計算してください
          </Typography>
          <Stack direction="row" spacing={3} justifyContent="center" alignItems="flex-start" flexWrap="wrap">
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="caption" color="text.secondary">被減数 (A)</Typography>
              <BitRow value={problem.minuend} color="blue" />
              <Typography variant="caption">= {parseInt(problem.minuend, 2)}</Typography>
            </Stack>
            <Typography variant="h4" color="text.secondary" sx={{ pt: 1.5 }}>−</Typography>
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="caption" color="text.secondary">減数 (B)</Typography>
              <BitRow value={problem.subtrahend} color="orange" />
              <Typography variant="caption">= {parseInt(problem.subtrahend, 2)}</Typography>
            </Stack>
            <Typography variant="h4" color="text.secondary" sx={{ pt: 1.5 }}>=</Typography>
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="caption" color="text.secondary">答え</Typography>
              {step === "done"
                ? <><BitRow value={correctAdd} color="green" /><Typography variant="caption">= {expectedDec}</Typography></>
                : (
                  <Stack direction="row" spacing={0.5}>
                    {Array.from({ length: bits }).map((_, i) => (
                      <Box key={i} sx={{ width: 40, height: 46, border: "2px dashed #bdbdbd", borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", color: "#bdbdbd", fontFamily: "monospace", fontSize: "1.25rem" }}>?</Box>
                    ))}
                  </Stack>
                )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Step 1 */}
      <StepPanel number={1} title="① 減数(B)の1の補数を求める" active={isActive("ones")} complete={isComplete("ones")} status={statuses.ones}>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          <Box component="span" sx={{ fontFamily: "monospace", bgcolor: "background.paper", px: 0.5, borderRadius: 0.5, border: "1px solid #e0e0e0" }}>{problem.subtrahend}</Box>
          {" "}の全ビットを反転させてください（0↔1）
        </Typography>
        {isComplete("ones") ? (
          <BitRow value={correctOnes} color="green" />
        ) : (
          <Stack spacing={1.5} alignItems="center">
            <BitInput bits={bits} value={inputs.ones} onChange={(v) => setInputs((s) => ({ ...s, ones: v }))}
              disabled={!isActive("ones")} status={statuses.ones} onEnter={() => check("ones")} />
            {statuses.ones === "wrong" && (
              <Typography variant="caption" color="error">正解: <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{correctOnes}</Box></Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" disabled={!isActive("ones")} onClick={() => check("ones")}>確認</Button>
              <Button variant="outlined" size="small" color="inherit" disabled={!isActive("ones")} onClick={() => reveal("ones")}>答えを見る</Button>
            </Stack>
          </Stack>
        )}
      </StepPanel>

      {/* Step 2 */}
      <StepPanel number={2} title="② 2の補数を求める（1の補数 + 1）" active={isActive("twos")} complete={isComplete("twos")} status={statuses.twos}>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          1の補数{" "}
          <Box component="span" sx={{ fontFamily: "monospace", bgcolor: "background.paper", px: 0.5, borderRadius: 0.5, border: "1px solid #e0e0e0" }}>
            {isComplete("ones") ? correctOnes : "???"}
          </Box>
          {" "}に1を加えてください
        </Typography>
        {isComplete("twos") ? (
          <BitRow value={correctTwos} color="green" />
        ) : (
          <Stack spacing={1.5} alignItems="center">
            <BitInput bits={bits} value={inputs.twos} onChange={(v) => setInputs((s) => ({ ...s, twos: v }))}
              disabled={!isActive("twos")} status={statuses.twos} onEnter={() => check("twos")} />
            {statuses.twos === "wrong" && (
              <Typography variant="caption" color="error">正解: <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{correctTwos}</Box></Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" disabled={!isActive("twos")} onClick={() => check("twos")}>確認</Button>
              <Button variant="outlined" size="small" color="inherit" disabled={!isActive("twos")} onClick={() => reveal("twos")}>答えを見る</Button>
            </Stack>
          </Stack>
        )}
      </StepPanel>

      {/* Step 3 */}
      <StepPanel number={3} title="③ A + 2の補数 を計算する" active={isActive("add")} complete={isComplete("add")} status={statuses.add}>
        <Stack spacing={1} mb={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ width: 16, textAlign: "right" }}></Typography>
            <BitRow value={problem.minuend} color="blue" />
            <Typography variant="caption" color="text.secondary">({parseInt(problem.minuend, 2)})</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={700} sx={{ width: 16, textAlign: "right" }}>+</Typography>
            <BitRow value={isComplete("twos") ? correctTwos : "?".repeat(bits)} color={isComplete("twos") ? "green" : "default"} />
            {isComplete("twos") && <Typography variant="caption" color="text.secondary">({parseInt(correctTwos, 2)})</Typography>}
          </Stack>
          <Divider />
          {hasCarry && (
            <Typography variant="caption" color="warning.main" textAlign="center">
              ※ 最上位ビットからキャリー（桁上がり）が出ます → <strong>無視してください</strong>
            </Typography>
          )}
        </Stack>
        {isComplete("add") ? (
          <Stack alignItems="center" spacing={1}>
            {hasCarry && <Chip label="キャリー: 1 → 無視" size="small" color="warning" variant="outlined" />}
            <BitRow value={correctAdd} color="green" />
          </Stack>
        ) : (
          <Stack spacing={1.5} alignItems="center">
            <Typography variant="caption" color="text.secondary">{bits}ビット分の結果を入力（キャリー除く）</Typography>
            <BitInput bits={bits} value={inputs.add} onChange={(v) => setInputs((s) => ({ ...s, add: v }))}
              disabled={!isActive("add")} status={statuses.add} onEnter={() => check("add")} />
            {statuses.add === "wrong" && (
              <Typography variant="caption" color="error">正解: <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{correctAdd}</Box></Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" disabled={!isActive("add")} onClick={() => check("add")}>確認</Button>
              <Button variant="outlined" size="small" color="inherit" disabled={!isActive("add")} onClick={() => reveal("add")}>答えを見る</Button>
            </Stack>
          </Stack>
        )}
      </StepPanel>

      {/* Done */}
      {step === "done" && (
        <Alert severity="success" icon={false} sx={{ textAlign: "center" }}>
          <AlertTitle sx={{ fontSize: "1.2rem" }}>🎉 完成！</AlertTitle>
          <Typography variant="h6" fontFamily="monospace">
            {problem.minuend}₂ − {problem.subtrahend}₂ ={" "}
            <Box component="span" color="success.dark" fontWeight={700}>{correctAdd}₂</Box>
          </Typography>
          <Typography color="text.secondary">
            ({parseInt(problem.minuend, 2)} − {parseInt(problem.subtrahend, 2)} ={" "}
            <Box component="span" fontWeight={700}>{expectedDec}</Box>)
          </Typography>
          <Box mt={2}>
            <Button variant="contained" color="success" onClick={() => reset()}>次の問題 →</Button>
          </Box>
        </Alert>
      )}

      {/* Info */}
      <Alert severity="info">
        <AlertTitle>なぜ引き算が加算でできるのか？</AlertTitle>
        <Typography variant="body2">
          Nビットで A − B を計算するとき、Bの2の補数は 2ᴺ − B です。
          A + (2ᴺ − B) = A − B + 2ᴺ となり、最上位ビットへのキャリーが 2ᴺ に対応するため、
          それを捨てれば A − B が得られます。
        </Typography>
      </Alert>
    </Stack>
  );
}
