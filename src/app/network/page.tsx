import type { Metadata } from "next";
import Link from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import NetworkSimulator from "@/components/NetworkSimulator";

export const metadata: Metadata = {
  title: "ブラウザとWebサーバの通信シミュレータ",
  description: "TCP/IPの4つの層で、データの分割・統合とヘッダの確認を視覚的に学ぶ",
};

export default function NetworkPage() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}>
      <Container maxWidth="md">
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            🌐 ブラウザとWebサーバの通信
          </Typography>
          <Typography variant="body2" color="text.secondary">
            TCP/IPの4つの層で、データの分割・統合とヘッダの確認を見てみよう
          </Typography>
          <Typography variant="body2" mt={1}>
            <Link href="/">← 2進数 補数ゲームへ</Link>
          </Typography>
        </Box>
        <NetworkSimulator />
      </Container>
    </Box>
  );
}
