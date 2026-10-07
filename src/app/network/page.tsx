import type { Metadata } from "next";
import Link from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import NetworkSimulator from "@/components/NetworkSimulator";

export const metadata: Metadata = {
  title: "ブラウザとWebサーバの通信シミュレータ",
  description: "SNSへの画像投稿を例に、TCP/IPの4つの層でデータの分割・統合とヘッダの確認を学ぶ",
};

export default function NetworkPage() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            🌐 ブラウザとWebサーバの通信
          </Typography>
          <Typography variant="body2" color="text.secondary">
            SNSに画像を投稿するとき、データがどう分割・確認・統合されるかをTCP/IPの4つの層で見てみよう
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
