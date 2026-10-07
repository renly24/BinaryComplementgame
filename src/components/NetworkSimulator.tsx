"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// ---------- モデル ----------

type Side = "client" | "server";
type Layer = "app" | "transport" | "internet" | "link";
type Phase = "request" | "response";
type PartKind = "eth" | "ip" | "tcp" | "data" | "fcs";

const LAYERS: { id: Layer; name: string; osi: string; protocol: string; color: string }[] = [
  { id: "app", name: "アプリケーション層", osi: "OSI 第5〜7層", protocol: "HTTP", color: "#1e88e5" },
  { id: "transport", name: "トランスポート層", osi: "OSI 第4層", protocol: "TCP", color: "#43a047" },
  { id: "internet", name: "インターネット層", osi: "OSI 第3層", protocol: "IP", color: "#fb8c00" },
  { id: "link", name: "ネットワークインタフェース層", osi: "OSI 第1〜2層", protocol: "イーサネット", color: "#8e24aa" },
];

const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<
  Layer,
  (typeof LAYERS)[number]
>;

const PART_STYLE: Record<PartKind, { label: string; color: string }> = {
  eth: { label: "Eth", color: LAYER_BY_ID.link.color },
  ip: { label: "IP", color: LAYER_BY_ID.internet.color },
  tcp: { label: "TCP", color: LAYER_BY_ID.transport.color },
  data: { label: "データ", color: LAYER_BY_ID.app.color },
  fcs: { label: "FCS", color: LAYER_BY_ID.link.color },
};

const HOST = {
  client: { name: "ブラウザ（PC）", icon: "💻", ip: "192.168.1.10", mac: "AA:AA:AA:11:11:11", port: 50000 },
  server: { name: "Webサーバ", icon: "🖥️", ip: "192.168.1.20", mac: "BB:BB:BB:22:22:22", port: 80 },
} as const;

const MSS = 1460;
const HTML_BYTES = 3500;
const REQUEST_BYTES = 120;

interface Unit {
  /** セグメント番号（分割されていない場合は null） */
  no: number | null;
  parts: PartKind[];
  bytes: number;
  seq: number;
  checked?: boolean;
}

interface Step {
  phase: Phase;
  where: { side: Side; layer: Layer } | "wire";
  title: string;
  description: string;
  units: Unit[];
  /** 詳細表で強調するヘッダ */
  focus?: PartKind;
  checks?: string[];
  /** ケーブル上での到着順（セグメント番号） */
  arrival?: number[];
}

const HEADERS_ALL: PartKind[] = ["eth", "ip", "tcp", "data", "fcs"];
const HEADERS_IP: PartKind[] = ["ip", "tcp", "data"];
const HEADERS_TCP: PartKind[] = ["tcp", "data"];
const DATA_ONLY: PartKind[] = ["data"];

function segments(total: number): { bytes: number; seq: number }[] {
  const result: { bytes: number; seq: number }[] = [];
  for (let offset = 0; offset < total; offset += MSS) {
    result.push({ bytes: Math.min(MSS, total - offset), seq: offset + 1 });
  }
  return result;
}

function withParts(units: Unit[], parts: PartKind[], checked = false): Unit[] {
  return units.map((u) => ({ ...u, parts, checked }));
}

function buildSteps(): Step[] {
  const req: Unit[] = [{ no: null, parts: DATA_ONLY, bytes: REQUEST_BYTES, seq: 1 }];
  const html: Unit[] = [{ no: null, parts: DATA_ONLY, bytes: HTML_BYTES, seq: 1 }];
  const split: Unit[] = segments(HTML_BYTES).map((s, i) => ({ no: i + 1, parts: DATA_ONLY, ...s }));
  const arrival = [1, 3, 2];
  const arrived = arrival.map((no) => split[no - 1]);
  const s = HOST.server;
  const c = HOST.client;

  return [
    // ---- リクエスト（ブラウザ → サーバ） ----
    {
      phase: "request",
      where: { side: "client", layer: "app" },
      title: "HTTPリクエストを作る",
      description:
        "ブラウザに URL を入力すると、アプリケーション層の HTTP が「index.html をください」というリクエスト（GET /index.html）を作ります。",
      units: req,
      focus: "data",
    },
    {
      phase: "request",
      where: { side: "client", layer: "transport" },
      title: "TCPヘッダを付ける",
      description:
        "リクエストは小さい（120バイト）ので分割は不要です。TCP ヘッダを付けます。TCP ヘッダに書かれる“あて先”はポート番号です。送信元はブラウザ用のポート（50000）、宛先は Web サーバのポート（80番 = HTTP）です。",
      units: withParts(req, HEADERS_TCP),
      focus: "tcp",
    },
    {
      phase: "request",
      where: { side: "client", layer: "internet" },
      title: "IPヘッダを付ける",
      description: `どのコンピュータに届けるかを示す IP アドレスを IP ヘッダに書きます（送信元 ${c.ip} → 宛先 ${s.ip}）。TCPヘッダ付きのデータが、ここで「IPパケット」になります。`,
      units: withParts(req, HEADERS_IP),
      focus: "ip",
    },
    {
      phase: "request",
      where: { side: "client", layer: "link" },
      title: "イーサネットヘッダを付けて送信",
      description:
        "隣の機器に届けるための MAC アドレスをイーサネットヘッダに、誤り検出用の FCS を末尾に付けて「フレーム」にします。最後は 0 と 1 の電気信号としてケーブルに送り出します。",
      units: withParts(req, HEADERS_ALL),
      focus: "eth",
    },
    {
      phase: "request",
      where: "wire",
      title: "ケーブルを流れる",
      description: "フレームは 0 と 1 の信号としてケーブルを流れ、Web サーバに届きます。",
      units: withParts(req, HEADERS_ALL),
      arrival: [0],
    },
    {
      phase: "request",
      where: { side: "server", layer: "link" },
      title: "宛先MACアドレスを確認",
      description:
        "受け取ったら、下の層から順に「自分あてか」を確認してヘッダを外していきます。まずイーサネットヘッダの宛先 MAC アドレスを確認します。",
      units: withParts(req, HEADERS_ALL, true),
      focus: "eth",
      checks: [`宛先MAC ${s.mac} ＝ 自分の MAC アドレス → 受け取る`, "FCS で誤りなし → イーサネットヘッダと FCS を外す"],
    },
    {
      phase: "request",
      where: { side: "server", layer: "internet" },
      title: "宛先IPアドレスを確認",
      description: "IP ヘッダの宛先 IP アドレスが自分のものかを確認し、IP ヘッダを外します。",
      units: withParts(req, HEADERS_IP, true),
      focus: "ip",
      checks: [`宛先IP ${s.ip} ＝ 自分の IP アドレス → IPヘッダを外す`],
    },
    {
      phase: "request",
      where: { side: "server", layer: "transport" },
      title: "TCPヘッダの宛先ポートを確認",
      description:
        "TCP ヘッダの宛先ポート番号を見て、どのアプリケーションに渡すかを決めます。80番なので Web サーバのソフトウェアに渡します。",
      units: withParts(req, HEADERS_TCP, true),
      focus: "tcp",
      checks: [`宛先ポート ${s.port} → Webサーバソフト（HTTP）に渡す`, `送信元ポート ${c.port} → 返事はこのポートあてに送る`],
    },
    {
      phase: "request",
      where: { side: "server", layer: "app" },
      title: "リクエストを受け取る",
      description: "Web サーバが HTTP リクエスト（GET /index.html）を受け取りました。次は返事（レスポンス）を送ります。",
      units: req,
      focus: "data",
    },

    // ---- レスポンス（サーバ → ブラウザ） ----
    {
      phase: "response",
      where: { side: "server", layer: "app" },
      title: "HTTPレスポンスを作る",
      description: `Web サーバは「200 OK」と index.html の中身をまとめた HTTP レスポンスを作ります。大きさは ${HTML_BYTES.toLocaleString()} バイトです。`,
      units: html,
      focus: "data",
    },
    {
      phase: "response",
      where: { side: "server", layer: "transport" },
      title: "データを分割する（セグメント化）",
      description: `一度に送れるデータの大きさには上限（MSS = ${MSS} バイト）があります。${HTML_BYTES.toLocaleString()} バイトのデータを ${split.length} つに分割します。`,
      units: split,
      focus: "data",
    },
    {
      phase: "response",
      where: { side: "server", layer: "transport" },
      title: "それぞれにTCPヘッダを付ける",
      description:
        "分割したそれぞれに TCP ヘッダを付けます。ポート番号（送信元 80 → 宛先 50000）に加えて、シーケンス番号（データの何バイト目からか）を書いておくことで、受け取った側が元の順番に並べ直せます。",
      units: withParts(split, HEADERS_TCP),
      focus: "tcp",
    },
    {
      phase: "response",
      where: { side: "server", layer: "internet" },
      title: "IPヘッダを付ける",
      description: `それぞれに IP ヘッダ（送信元 ${s.ip} → 宛先 ${c.ip}）を付け、${split.length} 個の IP パケットになります。`,
      units: withParts(split, HEADERS_IP),
      focus: "ip",
    },
    {
      phase: "response",
      where: { side: "server", layer: "link" },
      title: "イーサネットヘッダを付けて送信",
      description: "それぞれをフレームにして、0 と 1 の信号として順番に送り出します。",
      units: withParts(split, HEADERS_ALL),
      focus: "eth",
    },
    {
      phase: "response",
      where: "wire",
      title: "ケーブルを流れる（順番が入れ替わることも）",
      description:
        "インターネットでは、パケットが別々の経路を通るなどして、送った順番どおりに届くとは限りません。ここでは ①→③→② の順に届きました。",
      units: withParts(arrived, HEADERS_ALL),
      arrival,
    },
    {
      phase: "response",
      where: { side: "client", layer: "link" },
      title: "宛先MACアドレスを確認",
      description: "届いたフレームごとに、宛先 MAC アドレスと FCS を確認してイーサネットヘッダを外します。",
      units: withParts(arrived, HEADERS_ALL, true),
      focus: "eth",
      checks: [`宛先MAC ${c.mac} ＝ 自分の MAC アドレス → 受け取る`],
    },
    {
      phase: "response",
      where: { side: "client", layer: "internet" },
      title: "宛先IPアドレスを確認",
      description: "IP ヘッダの宛先 IP アドレスを確認して、IP ヘッダを外します。",
      units: withParts(arrived, HEADERS_IP, true),
      focus: "ip",
      checks: [`宛先IP ${c.ip} ＝ 自分の IP アドレス → IPヘッダを外す`],
    },
    {
      phase: "response",
      where: { side: "client", layer: "transport" },
      title: "TCPヘッダを確認して並べ替える",
      description:
        "TCP ヘッダの宛先ポート番号でどのアプリあてかを確認します。さらにシーケンス番号を見て、届いた順（①③②）ではなく元の順番（①②③）に並べ替えます。",
      units: withParts(split, HEADERS_TCP, true),
      focus: "tcp",
      checks: [
        `宛先ポート ${c.port} → ブラウザに渡すデータ`,
        `シーケンス番号 ${split.map((u) => u.seq).join(" → ")} の順に並べ替え`,
        "受け取った分は確認応答（ACK）でサーバに知らせる",
      ],
    },
    {
      phase: "response",
      where: { side: "client", layer: "transport" },
      title: "データを統合する",
      description: `TCP ヘッダを外し、並べ替えたデータをつなげて、元の ${HTML_BYTES.toLocaleString()} バイトのデータに戻します。`,
      units: html,
      focus: "data",
    },
    {
      phase: "response",
      where: { side: "client", layer: "app" },
      title: "ブラウザに表示する",
      description:
        "ブラウザが HTTP レスポンス（200 OK と HTML）を受け取り、HTML を読み取って画面に表示します。これで 1 往復のやり取りが完了です。",
      units: html,
      focus: "data",
    },
  ];
}

const STEPS = buildSteps();

function headerRows(kind: PartKind, phase: Phase, unit: Unit): [string, string][] {
  const src = phase === "request" ? HOST.client : HOST.server;
  const dst = phase === "request" ? HOST.server : HOST.client;
  switch (kind) {
    case "eth":
      return [
        ["宛先MACアドレス", dst.mac],
        ["送信元MACアドレス", src.mac],
      ];
    case "ip":
      return [
        ["送信元IPアドレス", src.ip],
        ["宛先IPアドレス", dst.ip],
      ];
    case "tcp":
      return [
        ["送信元ポート番号", String(src.port)],
        ["宛先ポート番号", String(dst.port)],
        ["シーケンス番号", String(unit.seq)],
      ];
    case "data":
      return [
        [
          "内容",
          phase === "request"
            ? "GET /index.html HTTP/1.1"
            : unit.no
              ? `レスポンスの ${unit.seq}〜${unit.seq + unit.bytes - 1} バイト目`
              : "HTTP/1.1 200 OK ＋ HTML",
        ],
        ["大きさ", `${unit.bytes.toLocaleString()} バイト`],
      ];
    case "fcs":
      return [["誤り検出用の値", "（受信側で計算して照合）"]];
  }
}

// ---------- 表示部品 ----------

const CIRCLED = ["①", "②", "③", "④", "⑤"];

function LayerStack({ side, step }: { side: Side; step: Step }) {
  const host = HOST[side];
  const active = step.where !== "wire" && step.where.side === side ? step.where.layer : null;
  const sending = (step.phase === "request") === (side === "client");

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography textAlign="center" fontWeight={700} mb={1}>
        {host.icon} {host.name}
      </Typography>
      <Typography textAlign="center" variant="caption" color="text.secondary" display="block" mb={1}>
        {sending ? "送信 ⬇ ヘッダを付ける" : "受信 ⬆ ヘッダを外す"}
      </Typography>
      <Stack spacing={0.75}>
        {LAYERS.map((layer) => {
          const isActive = active === layer.id;
          return (
            <Box
              key={layer.id}
              sx={{
                border: 2,
                borderColor: layer.color,
                borderRadius: 2,
                px: 1,
                py: 0.75,
                bgcolor: isActive ? layer.color : "background.paper",
                color: isActive ? "#fff" : "text.primary",
                boxShadow: isActive ? 4 : 0,
                transform: isActive ? "scale(1.04)" : "none",
                transition: "all 0.3s",
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: "0.7rem", sm: "0.85rem" } }}>
                {layer.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: { xs: "0.62rem", sm: "0.72rem" } }}>
                {layer.protocol}・{layer.osi}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

const travelRight = keyframes`
  from { left: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { left: calc(100% - 28px); opacity: 0; }
`;
const travelLeft = keyframes`
  from { left: calc(100% - 28px); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { left: 0%; opacity: 0; }
`;

function Wire({ step, stepIndex }: { step: Step; stepIndex: number }) {
  const toRight = step.phase === "request";
  const active = step.where === "wire";
  return (
    <Box sx={{ width: { xs: 56, sm: 120 }, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", pb: 1 }}>
      <Typography variant="caption" textAlign="center" color="text.secondary" mb={0.5}>
        ケーブル
      </Typography>
      <Box sx={{ position: "relative", height: 36 }}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 4,
            mt: "-2px",
            borderRadius: 2,
            bgcolor: active ? LAYER_BY_ID.link.color : "grey.400",
          }}
        />
        {active &&
          step.arrival!.map((no, i) => (
            <Box
              key={`${stepIndex}-${i}`}
              sx={{
                position: "absolute",
                top: 4,
                width: 28,
                height: 28,
                borderRadius: 1,
                bgcolor: LAYER_BY_ID.link.color,
                color: "#fff",
                fontSize: "0.8rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                animation: `${toRight ? travelRight : travelLeft} 1.6s ease-in-out ${i * 0.7}s infinite`,
              }}
            >
              {no === 0 ? "📦" : CIRCLED[no - 1]}
            </Box>
          ))}
      </Box>
      <Typography variant="caption" textAlign="center" fontSize="1.2rem" color={active ? LAYER_BY_ID.link.color : "grey.400"}>
        {toRight ? "➡" : "⬅"}
      </Typography>
    </Box>
  );
}

function UnitBar({ unit, selected, onSelect }: { unit: Unit; selected: boolean; onSelect: () => void }) {
  const dataWidth = Math.max(18, (unit.bytes / HTML_BYTES) * 100);
  return (
    <Box
      onClick={onSelect}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 0.75,
        borderRadius: 2,
        cursor: "pointer",
        outline: selected ? 2 : 0,
        outlineColor: "primary.main",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography sx={{ width: 28, textAlign: "center", fontWeight: 700 }}>
        {unit.no ? CIRCLED[unit.no - 1] : "📦"}
      </Typography>
      <Box sx={{ display: "flex", flex: 1, minWidth: 0, height: 34 }}>
        {unit.parts.map((p) => {
          const st = PART_STYLE[p];
          const isData = p === "data";
          return (
            <Box
              key={p}
              sx={{
                bgcolor: st.color,
                color: "#fff",
                flex: isData ? `0 1 ${dataWidth}%` : "0 0 auto",
                minWidth: isData ? 72 : 40,
                px: 0.75,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                borderRight: "2px solid #fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {isData ? `データ ${unit.bytes.toLocaleString()}B` : st.label}
            </Box>
          );
        })}
      </Box>
      {unit.checked && <CheckCircleIcon color="success" fontSize="small" />}
    </Box>
  );
}

// ---------- 本体 ----------

export default function NetworkSimulator() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(0);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const unit = step.units[Math.min(selected, step.units.length - 1)];

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
    setSelected(0);
  };

  useEffect(() => {
    if (!playing || isLast) return;
    const timer = setTimeout(() => {
      setIndex(index + 1);
      setSelected(0);
      if (index + 1 === STEPS.length - 1) setPlaying(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [playing, index, isLast]);

  const location =
    step.where === "wire"
      ? "ケーブル"
      : `${HOST[step.where.side].name}・${LAYER_BY_ID[step.where.layer].name}`;
  const detailKinds = unit.parts.filter((p) => p !== "fcs");

  return (
    <Stack spacing={2}>
      {/* 全体図 */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} mb={2} justifyContent="center" flexWrap="wrap" useFlexGap>
            <Chip
              label="① リクエスト：ブラウザ → サーバ"
              color={step.phase === "request" ? "primary" : "default"}
              variant={step.phase === "request" ? "filled" : "outlined"}
            />
            <Chip
              label="② レスポンス：サーバ → ブラウザ"
              color={step.phase === "response" ? "secondary" : "default"}
              variant={step.phase === "response" ? "filled" : "outlined"}
            />
          </Stack>
          <Box sx={{ display: "flex", alignItems: "stretch", gap: { xs: 0.5, sm: 2 } }}>
            <LayerStack side="client" step={step} />
            <Wire step={step} stepIndex={index} />
            <LayerStack side="server" step={step} />
          </Box>
        </CardContent>
      </Card>

      {/* 説明 */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            ステップ {index + 1} / {STEPS.length}　|　{location}
          </Typography>
          <LinearProgress variant="determinate" value={((index + 1) / STEPS.length) * 100} sx={{ my: 1, borderRadius: 1 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {step.title}
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            {step.description}
          </Typography>
          {step.checks && (
            <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderColor: "success.main", bgcolor: "#f1f8e9" }}>
              {step.checks.map((c) => (
                <Stack key={c} direction="row" spacing={1} alignItems="center" py={0.25}>
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="body2" fontWeight={600}>
                    {c}
                  </Typography>
                </Stack>
              ))}
            </Paper>
          )}

          <Stack direction="row" spacing={1} mt={2} justifyContent="center" flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} disabled={index === 0} onClick={() => go(index - 1)}>
              戻る
            </Button>
            <Button
              variant="contained"
              color={playing ? "warning" : "success"}
              startIcon={playing ? <PauseIcon /> : <PlayArrowIcon />}
              onClick={() => {
                if (isLast) go(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? "一時停止" : "自動再生"}
            </Button>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} disabled={isLast} onClick={() => go(index + 1)}>
              次へ
            </Button>
            <Button
              variant="text"
              startIcon={<ReplayIcon />}
              onClick={() => {
                setPlaying(false);
                go(0);
              }}
            >
              最初から
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* データの中身 */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography fontWeight={700} gutterBottom>
            📦 いまのデータ（{step.units.length > 1 ? `${step.units.length}個に分割` : "1個"}）
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            クリックすると、そのデータのヘッダの中身を下に表示します
          </Typography>
          <Stack spacing={0.5}>
            {step.units.map((u, i) => (
              <UnitBar key={`${index}-${i}`} unit={u} selected={u === unit} onSelect={() => setSelected(i)} />
            ))}
          </Stack>

          <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
            {(["eth", "ip", "tcp", "data"] as PartKind[]).map((p) => (
              <Stack key={p} direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: PART_STYLE[p].color }} />
                <Typography variant="caption">
                  {p === "eth" ? "イーサネットヘッダ / FCS" : p === "data" ? "データ（HTTP）" : `${PART_STYLE[p].label}ヘッダ`}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              gap: 1.5,
            }}
          >
            {detailKinds.map((kind) => {
              const focused = step.focus === kind;
              const color = PART_STYLE[kind].color;
              return (
                <Paper
                  key={kind}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderWidth: focused ? 3 : 1,
                    borderColor: focused ? color : "divider",
                    boxShadow: focused ? 3 : 0,
                  }}
                >
                  <Typography variant="body2" fontWeight={700} sx={{ color }} mb={0.5}>
                    {kind === "eth" ? "イーサネットヘッダ" : kind === "data" ? "データ（HTTP）" : `${PART_STYLE[kind].label}ヘッダ`}
                    {focused && " ← 注目"}
                  </Typography>
                  {headerRows(kind, step.phase, unit).map(([k, v]) => (
                    <Stack key={k} direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        {k}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "monospace" }}>
                        {v}
                      </Typography>
                    </Stack>
                  ))}
                </Paper>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
