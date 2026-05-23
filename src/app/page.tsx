"use client";
import { useState } from "react";
import ComplementQuiz from "@/components/ComplementQuiz";
import SubtractionGame from "@/components/SubtractionGame";

type Tab = "quiz" | "subtraction";

export default function Home() {
  const [tab, setTab] = useState<Tab>("quiz");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            2進数 補数ゲーム
          </h1>
          <p className="text-gray-500 text-sm">
            2進数の補数と、補数を使った引き算を学ぼう
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-6">
          <button
            onClick={() => setTab("quiz")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              tab === "quiz"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            🎯 補数クイズ
          </button>
          <button
            onClick={() => setTab("subtraction")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              tab === "subtraction"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            ➗ 補数で引き算
          </button>
        </div>

        {/* Content */}
        <div>
          {tab === "quiz" ? <ComplementQuiz /> : <SubtractionGame />}
        </div>
      </div>
    </div>
  );
}
