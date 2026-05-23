"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import ComplementQuiz from "@/components/ComplementQuiz";
import SubtractionGame from "@/components/SubtractionGame";

type TabValue = "quiz" | "subtraction";

export default function Home() {
  const [tab, setTab] = useState<TabValue>("quiz");

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box textAlign="center" mb={4}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            2進数 補数ゲーム
          </Typography>
          <Typography variant="body2" color="text.secondary">
            2進数の補数と、補数を使った引き算を学ぼう
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ bgcolor: "background.paper", borderRadius: 3, boxShadow: 1, mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v: TabValue) => setTab(v)}
            variant="fullWidth"
            sx={{ borderRadius: 3 }}
          >
            <Tab value="quiz" label="🎯 補数クイズ" sx={{ fontWeight: 600, fontSize: "0.95rem" }} />
            <Tab value="subtraction" label="➗ 補数で引き算" sx={{ fontWeight: 600, fontSize: "0.95rem" }} />
          </Tabs>
        </Box>

        {/* Content */}
        {tab === "quiz" ? <ComplementQuiz /> : <SubtractionGame />}
      </Container>
    </Box>
  );
}
