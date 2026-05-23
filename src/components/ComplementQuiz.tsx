"use client";
import { useState, useCallback } from "react";

type Difficulty = 4 | 8;
type ComplementType = "ones" | "twos";

function randomBinary(bits: Difficulty): string {
  const max = (1 << bits) - 1;
  const val = Math.floor(Math.random() * (max + 1));
  return val.toString(2).padStart(bits, "0");
}

function onesComplement(bin: string): string {
  return bin
    .split("")
    .map((b) => (b === "0" ? "1" : "0"))
    .join("");
}

function twosComplement(bin: string): string {
  const ones = onesComplement(bin);
  let carry = 1;
  const result = ones
    .split("")
    .reverse()
    .map((bit) => {
      const sum = parseInt(bit) + carry;
      carry = sum >> 1;
      return (sum & 1).toString();
    })
    .reverse()
    .join("");
  return result.slice(-bin.length);
}

function binToDec(bin: string): number {
  return parseInt(bin, 2);
}

type QuizState = "answering" | "correct" | "wrong";

export default function ComplementQuiz() {
  const [bits, setBits] = useState<Difficulty>(4);
  const [complementType, setComplementType] = useState<ComplementType>("twos");
  const [current, setCurrent] = useState(() => randomBinary(4));
  const [input, setInput] = useState("");
  const [state, setState] = useState<QuizState>("answering");
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const correct =
    complementType === "twos" ? twosComplement(current) : onesComplement(current);

  const next = useCallback(() => {
    setCurrent(randomBinary(bits));
    setInput("");
    setState("answering");
    setShowHint(false);
  }, [bits]);

  const check = () => {
    const normalized = input.padStart(bits, "0");
    const isCorrect = normalized === correct;
    setState(isCorrect ? "correct" : "wrong");
    setTotal((t) => t + 1);
    if (isCorrect) setScore((s) => s + 1);
  };

  const changeBits = (b: Difficulty) => {
    setBits(b);
    setCurrent(randomBinary(b));
    setInput("");
    setState("answering");
    setShowHint(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && state === "answering" && input.length > 0) check();
    if (e.key === "Enter" && state !== "answering") next();
  };

  return (
    <div className="space-y-6">
      {/* Settings bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-gray-50 rounded-xl p-4">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-gray-600">ビット数:</span>
          {([4, 8] as Difficulty[]).map((b) => (
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
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-gray-600">補数の種類:</span>
          {(["ones", "twos"] as ComplementType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setComplementType(t);
                setInput("");
                setState("answering");
              }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                complementType === t
                  ? "bg-purple-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t === "ones" ? "1の補数" : "2の補数"}
            </button>
          ))}
        </div>
        <div className="text-sm font-semibold text-gray-700">
          スコア: <span className="text-blue-600">{score}</span> / {total}
        </div>
      </div>

      {/* Problem card */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 space-y-6 text-center">
        <p className="text-gray-500 text-sm font-medium">
          次の{bits}ビット2進数の<span className="text-purple-600 font-bold">{complementType === "ones" ? "1の補数" : "2の補数"}</span>を求めてください
        </p>

        {/* Binary number display */}
        <div className="flex justify-center gap-2">
          {current.split("").map((bit, i) => (
            <div
              key={i}
              className="w-12 h-14 flex items-center justify-center bg-blue-50 border-2 border-blue-200 rounded-lg text-2xl font-mono font-bold text-blue-700"
            >
              {bit}
            </div>
          ))}
        </div>

        <p className="text-gray-400 text-sm">
          (10進数: <span className="text-gray-700 font-semibold">{binToDec(current)}</span>)
        </p>

        {/* Answer input */}
        {state === "answering" && (
          <div className="space-y-4">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                const v = e.target.value.replace(/[^01]/g, "").slice(0, bits);
                setInput(v);
              }}
              onKeyDown={handleKeyDown}
              placeholder={`${bits}ビットの2進数を入力`}
              className="w-full max-w-xs mx-auto block text-center font-mono text-xl border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex justify-center gap-3">
              <button
                onClick={check}
                disabled={input.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                答え合わせ
              </button>
              <button
                onClick={() => setShowHint(!showHint)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                {showHint ? "ヒントを隠す" : "ヒントを見る"}
              </button>
            </div>

            {showHint && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-left max-w-sm mx-auto">
                {complementType === "ones" ? (
                  <>
                    <p className="font-semibold text-yellow-800 mb-1">1の補数の求め方:</p>
                    <p className="text-yellow-700">各ビットを反転させます（0→1, 1→0）</p>
                    <p className="font-mono text-yellow-900 mt-2">
                      {current} → {current.split("").map((b) => (b === "0" ? "?" : "?")).join("")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-yellow-800 mb-1">2の補数の求め方:</p>
                    <ol className="text-yellow-700 list-decimal list-inside space-y-1">
                      <li>全ビットを反転（1の補数を求める）</li>
                      <li>結果に1を加える</li>
                    </ol>
                    <p className="font-mono text-yellow-900 mt-2">
                      {current} → 反転 → +1 = ?
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {state !== "answering" && (
          <div className="space-y-4">
            <div
              className={`rounded-xl p-4 ${
                state === "correct"
                  ? "bg-green-50 border-2 border-green-300"
                  : "bg-red-50 border-2 border-red-300"
              }`}
            >
              <p
                className={`text-lg font-bold ${
                  state === "correct" ? "text-green-700" : "text-red-700"
                }`}
              >
                {state === "correct" ? "✓ 正解！" : "✗ 不正解"}
              </p>
              {state === "wrong" && (
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  <p>
                    あなたの答え:{" "}
                    <span className="font-mono font-bold text-red-600">
                      {input.padStart(bits, "0")}
                    </span>
                  </p>
                  <p>
                    正解:{" "}
                    <span className="font-mono font-bold text-green-600">{correct}</span>
                    {" "}(10進数: {binToDec(correct)})
                  </p>
                  {complementType === "twos" && (
                    <div className="mt-3 text-xs text-gray-500 bg-white rounded-lg p-3 space-y-1">
                      <p className="font-semibold text-gray-600">解説:</p>
                      <p>
                        {current} の1の補数:{" "}
                        <span className="font-mono text-purple-600">{onesComplement(current)}</span>
                      </p>
                      <p>
                        +1 ={" "}
                        <span className="font-mono text-green-600">{correct}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={next}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              次の問題 →
            </button>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">
          {complementType === "ones" ? "1の補数とは" : "2の補数とは"}
        </p>
        {complementType === "ones" ? (
          <p>全ビットを反転したもの。元の数と足すと全ビットが1になります。</p>
        ) : (
          <p>
            1の補数に1を加えたもの。コンピュータで負の数を表現するために使われます。
            元の数と足すと桁溢れ（キャリー）が発生し、結果は0になります。
          </p>
        )}
      </div>
    </div>
  );
}
