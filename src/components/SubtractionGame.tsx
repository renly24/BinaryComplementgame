"use client";
import { useState, useCallback } from "react";

type Bits = 4 | 8;

function randomBinary(bits: Bits): string {
  const max = (1 << bits) - 1;
  return Math.floor(Math.random() * (max + 1))
    .toString(2)
    .padStart(bits, "0");
}

function onesComp(bin: string): string {
  return bin
    .split("")
    .map((b) => (b === "0" ? "1" : "0"))
    .join("");
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

function twosComp(bin: string): string {
  const ones = onesComp(bin);
  const { result } = addBinary(ones, "1".padStart(ones.length, "0").slice(-ones.length).replace(/^./, "0").replace(/.$/, "1"));
  // simpler: add 1 bit by bit
  let carry = 1;
  const arr = ones.split("").reverse().map((b) => {
    const s = parseInt(b) + carry;
    carry = s >> 1;
    return (s & 1).toString();
  });
  return arr.reverse().join("").slice(-bin.length);
}

type Step = "ones" | "twos" | "add" | "result";

interface Problem {
  bits: Bits;
  minuend: string;
  subtrahend: string;
}

function generateProblem(bits: Bits): Problem {
  // ensure minuend > subtrahend so result is positive
  const max = (1 << bits) - 1;
  let a: number, b: number;
  do {
    a = Math.floor(Math.random() * (max + 1));
    b = Math.floor(Math.random() * (max + 1));
  } while (a <= b || b === 0);
  return {
    bits,
    minuend: a.toString(2).padStart(bits, "0"),
    subtrahend: b.toString(2).padStart(bits, "0"),
  };
}

interface StepState {
  ones: string;
  twos: string;
  addResult: string;
  finalAnswer: string;
}

interface StepStatus {
  ones: "idle" | "correct" | "wrong";
  twos: "idle" | "correct" | "wrong";
  add: "idle" | "correct" | "wrong";
}

function BitDisplay({
  value,
  highlight = false,
}: {
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-1 justify-center">
      {value.split("").map((bit, i) => (
        <div
          key={i}
          className={`w-9 h-10 flex items-center justify-center rounded-md text-lg font-mono font-bold border-2 transition-colors ${
            highlight
              ? "bg-yellow-50 border-yellow-300 text-yellow-800"
              : "bg-gray-50 border-gray-200 text-gray-700"
          }`}
        >
          {bit}
        </div>
      ))}
    </div>
  );
}

function BitInput({
  bits,
  value,
  onChange,
  disabled,
  status,
  onEnter,
}: {
  bits: number;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  status: "idle" | "correct" | "wrong";
  onEnter?: () => void;
}) {
  const borderColor =
    status === "correct"
      ? "border-green-400 bg-green-50"
      : status === "wrong"
      ? "border-red-400 bg-red-50"
      : "border-gray-300 focus-within:border-blue-400";

  return (
    <div className={`flex gap-1 justify-center p-2 rounded-lg border-2 ${borderColor}`}>
      {Array.from({ length: bits }).map((_, i) => (
        <input
          key={i}
          type="text"
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/[^01]/g, "");
            const arr = value.padEnd(bits, " ").split("");
            arr[i] = v || " ";
            const next = arr.join("");
            onChange(next);
            if (v && i < bits - 1) {
              const el = document.getElementById(`bit-${i + 1}`);
              el?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              const el = document.getElementById(`bit-${i - 1}`);
              el?.focus();
            }
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          id={`bit-${i}`}
          className="w-9 h-10 text-center text-lg font-mono font-bold rounded-md border border-gray-200 outline-none focus:border-blue-400 disabled:opacity-50 bg-transparent"
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: "idle" | "correct" | "wrong" }) {
  if (status === "idle") return null;
  return (
    <span
      className={`text-sm font-bold px-2 py-0.5 rounded-full ${
        status === "correct"
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {status === "correct" ? "✓ 正解" : "✗ 不正解"}
    </span>
  );
}

export default function SubtractionGame() {
  const [bits, setBits] = useState<Bits>(4);
  const [problem, setProblem] = useState<Problem>(() => generateProblem(4));
  const [stepState, setStepState] = useState<StepState>({
    ones: "",
    twos: "",
    addResult: "",
    finalAnswer: "",
  });
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    ones: "idle",
    twos: "idle",
    add: "idle",
  });
  const [currentStep, setCurrentStep] = useState<Step>("ones");
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  const correctOnes = onesComp(problem.subtrahend);
  const correctTwos = twosComp(problem.subtrahend);
  const { result: rawSum, carry: hasCarry } = addBinary(problem.minuend, correctTwos);
  const correctAnswer = rawSum;
  const expectedDecimal =
    parseInt(problem.minuend, 2) - parseInt(problem.subtrahend, 2);

  const reset = useCallback(
    (newBits?: Bits) => {
      const b = newBits ?? bits;
      const p = generateProblem(b);
      setProblem(p);
      setStepState({ ones: "", twos: "", addResult: "", finalAnswer: "" });
      setStepStatus({ ones: "idle", twos: "idle", add: "idle" });
      setCurrentStep("ones");
      setDone(false);
    },
    [bits]
  );

  const changeBits = (b: Bits) => {
    setBits(b);
    reset(b);
  };

  const checkOnes = () => {
    const val = stepState.ones.replace(/ /g, "0");
    const correct = val === correctOnes;
    setStepStatus((s) => ({ ...s, ones: correct ? "correct" : "wrong" }));
    if (correct) setCurrentStep("twos");
  };

  const checkTwos = () => {
    const val = stepState.twos.replace(/ /g, "0");
    const correct = val === correctTwos;
    setStepStatus((s) => ({ ...s, twos: correct ? "correct" : "wrong" }));
    if (correct) setCurrentStep("add");
  };

  const checkAdd = () => {
    const val = stepState.addResult.replace(/ /g, "0");
    const correct = val === correctAnswer;
    setStepStatus((s) => ({ ...s, add: correct ? "correct" : "wrong" }));
    if (correct) {
      setCurrentStep("result");
      setDone(true);
      setScore((s) => s + 1);
      setTotal((t) => t + 1);
    } else {
      setTotal((t) => t + 1);
    }
  };

  const skipStep = (step: Step) => {
    if (step === "ones") {
      setStepState((s) => ({ ...s, ones: correctOnes }));
      setStepStatus((st) => ({ ...st, ones: "correct" }));
      setCurrentStep("twos");
    } else if (step === "twos") {
      setStepState((s) => ({ ...s, twos: correctTwos }));
      setStepStatus((st) => ({ ...st, twos: "correct" }));
      setCurrentStep("add");
    } else if (step === "add") {
      setStepState((s) => ({ ...s, addResult: correctAnswer }));
      setStepStatus((st) => ({ ...st, add: "correct" }));
      setCurrentStep("result");
      setDone(true);
    }
  };

  const stepActive = (s: Step) => currentStep === s;
  const stepComplete = (s: Step): boolean => {
    if (s === "ones") return stepStatus.ones === "correct";
    if (s === "twos") return stepStatus.twos === "correct";
    if (s === "add") return stepStatus.add === "correct";
    return done;
  };

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-gray-50 rounded-xl p-4">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-gray-600">ビット数:</span>
          {([4, 8] as Bits[]).map((b) => (
            <button
              key={b}
              onClick={() => changeBits(b)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                bits === b
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {b}ビット
            </button>
          ))}
        </div>
        <div className="text-sm font-semibold text-gray-700">
          スコア: <span className="text-blue-600">{score}</span> / {total}
        </div>
        <button
          onClick={() => reset()}
          className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          新しい問題
        </button>
      </div>

      {/* Problem statement */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
        <p className="text-center text-gray-500 text-sm mb-4 font-medium">
          2の補数を使って次の引き算を計算してください
        </p>
        <div className="flex items-center justify-center gap-6 text-2xl font-mono">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">被減数 (minuend)</div>
            <BitDisplay value={problem.minuend} />
            <div className="text-xs text-gray-500 mt-1">= {parseInt(problem.minuend, 2)}</div>
          </div>
          <div className="text-gray-400 text-3xl font-bold">−</div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">減数 (subtrahend)</div>
            <BitDisplay value={problem.subtrahend} highlight />
            <div className="text-xs text-gray-500 mt-1">= {parseInt(problem.subtrahend, 2)}</div>
          </div>
          <div className="text-gray-400 text-3xl font-bold">=</div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">答え</div>
            {done ? (
              <>
                <BitDisplay value={correctAnswer} />
                <div className="text-xs text-gray-500 mt-1">= {expectedDecimal}</div>
              </>
            ) : (
              <div className="flex gap-1">
                {Array.from({ length: bits }).map((_, i) => (
                  <div key={i} className="w-9 h-10 flex items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-gray-300 text-lg font-mono">
                    ?
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {/* Step 1: 1's complement */}
        <div
          className={`border-2 rounded-xl p-5 transition-all ${
            stepComplete("ones")
              ? "border-green-300 bg-green-50"
              : stepActive("ones")
              ? "border-blue-300 bg-blue-50"
              : "border-gray-200 bg-gray-50 opacity-60"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                stepComplete("ones")
                  ? "bg-green-500 text-white"
                  : "bg-blue-500 text-white"
              }`}
            >
              1
            </span>
            <h3 className="font-semibold text-gray-800">減数の1の補数を求める</h3>
            <StatusBadge status={stepStatus.ones} />
          </div>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-mono bg-white px-1 rounded">{problem.subtrahend}</span>
            の全ビットを反転させてください
          </p>
          {stepComplete("ones") ? (
            <BitDisplay value={correctOnes} />
          ) : (
            <div className="space-y-3">
              <BitInput
                bits={bits}
                value={stepState.ones}
                onChange={(v) => setStepState((s) => ({ ...s, ones: v }))}
                disabled={!stepActive("ones")}
                status={stepStatus.ones}
                onEnter={checkOnes}
              />
              {stepStatus.ones === "wrong" && (
                <p className="text-sm text-red-600 text-center">
                  正解: <span className="font-mono font-bold">{correctOnes}</span>
                </p>
              )}
              <div className="flex justify-center gap-2">
                <button
                  onClick={checkOnes}
                  disabled={!stepActive("ones")}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  確認
                </button>
                <button
                  onClick={() => skipStep("ones")}
                  disabled={!stepActive("ones")}
                  className="px-4 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
                >
                  答えを見る
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: 2's complement */}
        <div
          className={`border-2 rounded-xl p-5 transition-all ${
            stepComplete("twos")
              ? "border-green-300 bg-green-50"
              : stepActive("twos")
              ? "border-blue-300 bg-blue-50"
              : "border-gray-200 bg-gray-50 opacity-60"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                stepComplete("twos")
                  ? "bg-green-500 text-white"
                  : stepActive("twos")
                  ? "bg-blue-500 text-white"
                  : "bg-gray-400 text-white"
              }`}
            >
              2
            </span>
            <h3 className="font-semibold text-gray-800">2の補数を求める（1の補数 + 1）</h3>
            <StatusBadge status={stepStatus.twos} />
          </div>
          <p className="text-sm text-gray-600 mb-3">
            1の補数{" "}
            <span className="font-mono bg-white px-1 rounded">
              {stepComplete("ones") ? correctOnes : "???"}
            </span>{" "}
            に1を加えてください
          </p>
          {stepComplete("twos") ? (
            <BitDisplay value={correctTwos} />
          ) : (
            <div className="space-y-3">
              <BitInput
                bits={bits}
                value={stepState.twos}
                onChange={(v) => setStepState((s) => ({ ...s, twos: v }))}
                disabled={!stepActive("twos")}
                status={stepStatus.twos}
                onEnter={checkTwos}
              />
              {stepStatus.twos === "wrong" && (
                <p className="text-sm text-red-600 text-center">
                  正解: <span className="font-mono font-bold">{correctTwos}</span>
                </p>
              )}
              <div className="flex justify-center gap-2">
                <button
                  onClick={checkTwos}
                  disabled={!stepActive("twos")}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  確認
                </button>
                <button
                  onClick={() => skipStep("twos")}
                  disabled={!stepActive("twos")}
                  className="px-4 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
                >
                  答えを見る
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Add */}
        <div
          className={`border-2 rounded-xl p-5 transition-all ${
            stepComplete("add")
              ? "border-green-300 bg-green-50"
              : stepActive("add")
              ? "border-blue-300 bg-blue-50"
              : "border-gray-200 bg-gray-50 opacity-60"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                stepComplete("add")
                  ? "bg-green-500 text-white"
                  : stepActive("add")
                  ? "bg-blue-500 text-white"
                  : "bg-gray-400 text-white"
              }`}
            >
              3
            </span>
            <h3 className="font-semibold text-gray-800">
              被減数 + 2の補数 を計算する
            </h3>
            <StatusBadge status={stepStatus.add} />
          </div>
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-4 text-right font-mono text-gray-400"></span>
              <BitDisplay value={problem.minuend} />
              <span className="text-gray-400 text-xs">({parseInt(problem.minuend, 2)})</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-4 text-right font-mono text-gray-500 font-bold">+</span>
              <BitDisplay value={stepComplete("twos") ? correctTwos : "?".repeat(bits)} />
              <span className="text-gray-400 text-xs">
                {stepComplete("twos") ? `(${parseInt(correctTwos, 2)})` : ""}
              </span>
            </div>
            <div className="border-t border-gray-300 pt-2">
              <p className="text-xs text-gray-500 mb-1 text-center">
                {hasCarry
                  ? "※ キャリー（最上位ビットからの桁上がり）が出ます → 無視してください"
                  : "※ キャリーなし"}
              </p>
            </div>
          </div>
          {stepComplete("add") ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-3">
                {hasCarry && (
                  <span className="text-sm text-orange-600 font-mono bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                    キャリー: 1 → 無視
                  </span>
                )}
                <BitDisplay value={correctAnswer} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-xs text-gray-500 mb-1">
                {bits}ビットの結果のみを入力（キャリーは除く）
              </div>
              <BitInput
                bits={bits}
                value={stepState.addResult}
                onChange={(v) => setStepState((s) => ({ ...s, addResult: v }))}
                disabled={!stepActive("add")}
                status={stepStatus.add}
                onEnter={checkAdd}
              />
              {stepStatus.add === "wrong" && (
                <p className="text-sm text-red-600 text-center">
                  正解: <span className="font-mono font-bold">{correctAnswer}</span>
                </p>
              )}
              <div className="flex justify-center gap-2">
                <button
                  onClick={checkAdd}
                  disabled={!stepActive("add")}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  確認
                </button>
                <button
                  onClick={() => skipStep("add")}
                  disabled={!stepActive("add")}
                  className="px-4 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
                >
                  答えを見る
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        {done && (
          <div className="border-2 border-green-400 bg-green-50 rounded-xl p-5 text-center space-y-3">
            <div className="text-3xl">🎉</div>
            <h3 className="text-lg font-bold text-green-700">完成！</h3>
            <div className="text-gray-700 space-y-1">
              <p className="font-mono text-lg">
                {problem.minuend}₂ − {problem.subtrahend}₂ ={" "}
                <span className="text-green-700 font-bold">{correctAnswer}₂</span>
              </p>
              <p className="text-gray-500">
                ({parseInt(problem.minuend, 2)} − {parseInt(problem.subtrahend, 2)} ={" "}
                <span className="font-semibold text-green-700">{expectedDecimal}</span>)
              </p>
            </div>
            <button
              onClick={() => reset()}
              className="px-6 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
            >
              次の問題 →
            </button>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-purple-50 rounded-xl p-4 text-sm text-purple-800 space-y-1">
        <p className="font-semibold">なぜ引き算が加算でできるのか？</p>
        <p>
          N ビットで A − B を計算するとき、B の2の補数は 2^N − B です。
          A + (2^N − B) = A − B + 2^N となり、最上位ビットへのキャリーが 2^N
          に対応するため、それを捨てれば A − B が得られます。
        </p>
      </div>
    </div>
  );
}
