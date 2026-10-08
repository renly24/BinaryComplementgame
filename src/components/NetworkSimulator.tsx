"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
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
  client: { name: "スマホ（SNSアプリ）", short: "スマホ", icon: "📱", ip: "192.168.1.10", mac: "AA:AA:AA:11:11:11", port: 50000 },
  server: { name: "Webサーバ（SNS）", short: "Webサーバ", icon: "🖥️", ip: "192.168.1.20", mac: "BB:BB:BB:22:22:22", port: 80 },
} as const;

const MSS = 1460;
/** 説明のため、画像はとても小さいサイズにしている */
const IMAGE_BYTES = 4000;
const RESPONSE_BYTES = 200;

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
  /** 受信側で「ヘッダに書かれた宛先」と「自分のアドレス」を見比べる */
  compare?: { label: string; header: string; mine: string; result: string };
  /** ケーブル上での到着順（セグメント番号。0 は分割なし） */
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
  const image: Unit[] = [{ no: null, parts: DATA_ONLY, bytes: IMAGE_BYTES, seq: 1 }];
  const split: Unit[] = segments(IMAGE_BYTES).map((s, i) => ({ no: i + 1, parts: DATA_ONLY, ...s }));
  const arrival = [1, 3, 2];
  const arrived = arrival.map((no) => split[no - 1]);
  const reply: Unit[] = [{ no: null, parts: DATA_ONLY, bytes: RESPONSE_BYTES, seq: 1 }];
  const s = HOST.server;
  const c = HOST.client;

  return [
    // ---- 画像のアップロード（スマホ → SNSサーバ） ----
    {
      phase: "request",
      where: { side: "client", layer: "app" },
      title: "画像を投稿する",
      description: `SNSアプリで写真を選んで「投稿」を押すと、アプリケーション層の HTTP が「この画像を保存してください」というリクエスト（POST /upload ＋ 画像データ）を作ります。画像の大きさは ${IMAGE_BYTES.toLocaleString()} バイトです（説明のため、とても小さな画像にしています）。`,
      units: image,
      focus: "data",
    },
    {
      phase: "request",
      where: { side: "client", layer: "transport" },
      title: "画像を分割する（セグメント化）",
      description: `一度に送れるデータの大きさには上限（MSS = ${MSS.toLocaleString()} バイト）があります。そのため、画像を ${split.length} つに切り分けます。写真をハサミで切って、何通かの封筒に分けて送るイメージです。`,
      units: split,
      focus: "data",
    },
    {
      phase: "request",
      where: { side: "client", layer: "transport" },
      title: "それぞれにTCPヘッダを付ける",
      description:
        "切り分けたそれぞれに TCP ヘッダを付けます。TCP ヘッダの“あて先”はポート番号で、送信元はアプリのポート（50000）、宛先は Web サーバの Web サービスのポート（80）です。さらにシーケンス番号（画像の何バイト目からか）を書いておくので、受け取った側は元の順番に並べ直せます。",
      units: withParts(split, HEADERS_TCP),
      focus: "tcp",
    },
    {
      phase: "request",
      where: { side: "client", layer: "internet" },
      title: "IPヘッダを付ける",
      description: `どのコンピュータに届けるかを示す IP アドレス（送信元 ${c.ip} → 宛先 ${s.ip}）を IP ヘッダに書きます。${split.length} 個の「IPパケット」ができました。`,
      units: withParts(split, HEADERS_IP),
      focus: "ip",
    },
    {
      phase: "request",
      where: { side: "client", layer: "link" },
      title: "イーサネットヘッダを付けて送信",
      description:
        "隣の機器に届けるための MAC アドレスをイーサネットヘッダに、誤り検出用の FCS を末尾に付けて「フレーム」にします。最後は 0 と 1 の信号として順番に送り出します。",
      units: withParts(split, HEADERS_ALL),
      focus: "eth",
    },
    {
      phase: "request",
      where: "wire",
      title: "ネットワークを流れる（順番が入れ替わることも）",
      description:
        "パケットは別々の経路を通ることがあるので、送った順番どおりに届くとは限りません。ここでは ①→③→② の順に届きました。画像の切れ端がバラバラの順番で届いた状態です。",
      units: withParts(arrived, HEADERS_ALL),
      arrival,
    },
    {
      phase: "request",
      where: { side: "server", layer: "link" },
      title: "宛先MACアドレスを確認",
      description:
        "受け取ったら、下の層から順に「自分あてか」を確認してヘッダを外していきます。まずフレームごとに宛先 MAC アドレスと FCS を確認します。",
      units: withParts(arrived, HEADERS_ALL, true),
      focus: "eth",
      compare: { label: "MACアドレス", header: s.mac, mine: s.mac, result: "自分あてなので受け取る" },
      checks: ["FCS で誤りなし → イーサネットヘッダと FCS を外す"],
    },
    {
      phase: "request",
      where: { side: "server", layer: "internet" },
      title: "宛先IPアドレスを確認",
      description: "IP ヘッダの宛先 IP アドレスが自分のものかを確認し、IP ヘッダを外します。",
      units: withParts(arrived, HEADERS_IP, true),
      focus: "ip",
      compare: { label: "IPアドレス", header: s.ip, mine: s.ip, result: "自分あてなので IPヘッダを外す" },
    },
    {
      phase: "request",
      where: { side: "server", layer: "transport" },
      title: "TCPヘッダを確認して並べ替える",
      description:
        "TCP ヘッダの宛先ポート番号を見て、どのアプリケーションに渡すかを決めます。さらにシーケンス番号を見て、届いた順（①③②）ではなく元の順番（①②③）に画像の切れ端を並べ替えます。",
      units: withParts(split, HEADERS_TCP, true),
      focus: "tcp",
      compare: { label: "ポート番号", header: String(s.port), mine: `${s.port}（Webサービス）`, result: "Webサービスに渡すデータ" },
      checks: [
        `シーケンス番号 ${split.map((u) => u.seq).join(" → ")} の順に並べ替え`,
        "受け取った分は確認応答（ACK）でスマホに知らせる",
      ],
    },
    {
      phase: "request",
      where: { side: "server", layer: "transport" },
      title: "画像を統合する",
      description: `TCP ヘッダを外し、並べ替えた切れ端をつなげて、元の ${IMAGE_BYTES.toLocaleString()} バイトの画像に戻します。`,
      units: image,
      focus: "data",
    },
    {
      phase: "request",
      where: { side: "server", layer: "app" },
      title: "画像を受け取って保存",
      description: "Web サーバが HTTP リクエスト（POST /upload）と画像を受け取り、保存しました。次は「投稿できました」という返事（レスポンス）を送ります。",
      units: image,
      focus: "data",
    },

    // ---- 返事（SNSサーバ → スマホ） ----
    {
      phase: "response",
      where: { side: "server", layer: "app" },
      title: "「投稿完了」の返事を作る",
      description: `Web サーバは「201 Created（投稿できました）」という HTTP レスポンスを作ります。大きさは ${RESPONSE_BYTES} バイトです。`,
      units: reply,
      focus: "data",
    },
    {
      phase: "response",
      where: { side: "server", layer: "transport" },
      title: "TCPヘッダを付ける（分割は不要）",
      description: `返事は ${RESPONSE_BYTES} バイトと小さいので、分割せずにそのまま TCP ヘッダを付けます。今度は送信元ポート 80 → 宛先ポート 50000 です。`,
      units: withParts(reply, HEADERS_TCP),
      focus: "tcp",
    },
    {
      phase: "response",
      where: { side: "server", layer: "internet" },
      title: "IPヘッダを付ける",
      description: `IP ヘッダ（送信元 ${s.ip} → 宛先 ${c.ip}）を付けます。行きとは送信元と宛先が入れ替わっています。`,
      units: withParts(reply, HEADERS_IP),
      focus: "ip",
    },
    {
      phase: "response",
      where: { side: "server", layer: "link" },
      title: "イーサネットヘッダを付けて送信",
      description: "フレームにして、0 と 1 の信号として送り出します。",
      units: withParts(reply, HEADERS_ALL),
      focus: "eth",
    },
    {
      phase: "response",
      where: "wire",
      title: "ネットワークを流れる",
      description: "返事のフレームがスマホに向かって流れていきます。",
      units: withParts(reply, HEADERS_ALL),
      arrival: [0],
    },
    {
      phase: "response",
      where: { side: "client", layer: "link" },
      title: "宛先MACアドレスを確認",
      description: "スマホは宛先 MAC アドレスと FCS を確認して、イーサネットヘッダを外します。",
      units: withParts(reply, HEADERS_ALL, true),
      focus: "eth",
      compare: { label: "MACアドレス", header: c.mac, mine: c.mac, result: "自分あてなので受け取る" },
    },
    {
      phase: "response",
      where: { side: "client", layer: "internet" },
      title: "宛先IPアドレスを確認",
      description: "IP ヘッダの宛先 IP アドレスを確認して、IP ヘッダを外します。",
      units: withParts(reply, HEADERS_IP, true),
      focus: "ip",
      compare: { label: "IPアドレス", header: c.ip, mine: c.ip, result: "自分あてなので IPヘッダを外す" },
    },
    {
      phase: "response",
      where: { side: "client", layer: "transport" },
      title: "TCPヘッダの宛先ポートを確認",
      description: "宛先ポート番号 50000 を見て、この返事を SNS アプリに渡します。",
      units: withParts(reply, HEADERS_TCP, true),
      focus: "tcp",
      compare: { label: "ポート番号", header: String(c.port), mine: `${c.port}（SNSアプリ）`, result: "SNSアプリに渡す" },
    },
    {
      phase: "response",
      where: { side: "client", layer: "app" },
      title: "「投稿しました」と表示",
      description:
        "SNS アプリが HTTP レスポンス（201 Created）を受け取り、画面に「投稿しました」と表示します。これで画像のアップロードが完了です。",
      units: reply,
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
        ["宛先MAC", dst.mac],
        ["送信元MAC", src.mac],
      ];
    case "ip":
      return [
        ["送信元IP", src.ip],
        ["宛先IP", dst.ip],
      ];
    case "tcp":
      return [
        ["送信元ポート", String(src.port)],
        ["宛先ポート", String(dst.port)],
        ["シーケンス番号", String(unit.seq)],
      ];
    case "data":
      return [
        [
          "内容",
          phase === "response"
            ? "HTTP/1.1 201 Created"
            : unit.no
              ? `画像の ${unit.seq.toLocaleString()}〜${(unit.seq + unit.bytes - 1).toLocaleString()} バイト目`
              : "POST /upload ＋ 画像（photo.jpg）",
        ],
        ["大きさ", `${unit.bytes.toLocaleString()} バイト`],
      ];
    case "fcs":
      return [["誤り検出用の値", "（受信側で計算して照合）"]];
  }
}

// ---------- 画像（例えの写真） ----------

const PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" preserveAspectRatio="none">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fa3e0"/><stop offset="1" stop-color="#bfe3f7"/></linearGradient></defs>
<rect width="300" height="200" fill="url(#s)"/>
<circle cx="230" cy="48" r="22" fill="#ffd54f"/>
<path d="M0 130 L70 60 L120 110 L170 50 L240 125 L300 90 L300 200 L0 200 Z" fill="#5d8a5e"/>
<path d="M150 72 L170 50 L188 70 Z M55 75 L70 60 L84 74 Z" fill="#ffffff"/>
<path d="M0 150 Q150 135 300 150 L300 200 L0 200 Z" fill="#2e7dbf"/>
<path d="M0 175 Q150 165 300 178 L300 200 L0 200 Z" fill="#c8a165"/>
</svg>`;
const PHOTO_URL = `url("data:image/svg+xml,${encodeURIComponent(PHOTO_SVG)}")`;

/** 画像の a〜b（0〜1 の割合）の横帯を背景として表示するスタイル */
function photoSlice(a: number, b: number) {
  const h = b - a;
  return {
    backgroundImage: PHOTO_URL,
    backgroundRepeat: "no-repeat",
    backgroundSize: `100% ${100 / h}%`,
    backgroundPosition: `0 ${h >= 1 ? 0 : (a / (1 - h)) * 100}%`,
  };
}

function sliceOf(unit: Unit) {
  return { a: (unit.seq - 1) / IMAGE_BYTES, b: (unit.seq - 1 + unit.bytes) / IMAGE_BYTES };
}

const CIRCLED = ["①", "②", "③", "④", "⑤"];

function PhotoView({ step }: { step: Step }) {
  const pieces = step.units.filter((u) => u.no !== null);
  const done = step.phase === "response";
  const caption = done
    ? "Webサーバに保存された画像"
    : pieces.length === 0
      ? step.where !== "wire" && step.where.side === "server"
        ? "元どおりにつながった画像"
        : "投稿する画像（photo.jpg）"
      : step.where === "wire"
        ? "届いた順番（バラバラ）"
        : "切り分けた画像";

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        📷 {caption}
      </Typography>
      <Box sx={{ width: "100%", maxWidth: 170, position: "relative" }}>
        {pieces.length === 0 ? (
          <Box sx={{ aspectRatio: "3 / 2", borderRadius: 1.5, boxShadow: 2, ...photoSlice(0, 1) }} />
        ) : (
          <Stack spacing={0.5}>
            {pieces.map((u) => {
              const { a, b } = sliceOf(u);
              return (
                <Box
                  key={u.no}
                  sx={{
                    position: "relative",
                    aspectRatio: `3 / ${2 * (b - a)}`,
                    borderRadius: 1,
                    boxShadow: 2,
                    outline: "2px dashed #fff",
                    outlineOffset: -3,
                    transition: "all 0.4s",
                    ...photoSlice(a, b),
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      left: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      borderRadius: 1,
                      px: 0.75,
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {CIRCLED[u.no! - 1]}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
        {done && (
          <Chip
            icon={<CheckCircleIcon />}
            label="保存済み"
            color="success"
            size="small"
            sx={{ position: "absolute", top: 8, left: 8 }}
          />
        )}
      </Box>
    </Box>
  );
}

// ---------- 表示部品 ----------

function LayerStack({ side, step }: { side: Side; step: Step }) {
  const host = HOST[side];
  const active = step.where !== "wire" && step.where.side === side ? step.where.layer : null;
  const sending = (step.phase === "request") === (side === "client");

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography textAlign="center" fontWeight={700} mb={0.5} sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }}>
        {host.icon} {host.name}
      </Typography>
      <Typography textAlign="center" variant="caption" color="text.secondary" display="block" mb={0.75}>
        {sending ? "送信 ⬇ ヘッダを付ける" : "受信 ⬆ ヘッダを外す"}
      </Typography>
      <Box
        sx={{
          mb: 1,
          px: 1,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: "#eceff1",
          border: "2px solid #90a4ae",
        }}
      >
        <Typography sx={{ fontSize: { xs: "0.62rem", sm: "0.72rem" }, fontWeight: 700, color: "#455a64", mb: 0.25 }}>
          🪪 自分のアドレス
        </Typography>
        {(
          [
            ["transport", "ポート", String(host.port)],
            ["internet", "IP", host.ip],
            ["link", "MAC", host.mac],
          ] as [Layer, string, string][]
        ).map(([layer, label, value]) => {
          const color = LAYER_BY_ID[layer].color;
          const lit = active === layer;
          return (
            <Stack
              key={layer}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              columnGap={0.5}
              sx={{
                borderRadius: 1,
                px: 0.5,
                bgcolor: lit ? "#fff59d" : "transparent",
                outline: lit ? `2px solid ${color}` : "none",
                transition: "all 0.3s",
              }}
            >
              <Typography sx={{ fontSize: { xs: "0.6rem", sm: "0.72rem" }, fontWeight: 700, color }}>
                {label}
                {lit && (
                  <Box component="span" sx={{ ml: 0.5, color: "text.secondary", fontWeight: 600 }}>
                    {sending ? "→ ヘッダに記入" : "← ヘッダと照合"}
                  </Box>
                )}
              </Typography>
              <Typography sx={{ fontSize: { xs: "0.62rem", sm: "0.75rem" }, fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                {value}
              </Typography>
            </Stack>
          );
        })}
      </Box>
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
                py: 0.4,
                bgcolor: isActive ? layer.color : "background.paper",
                color: isActive ? "#fff" : "text.primary",
                boxShadow: isActive ? 4 : 0,
                transform: isActive ? "scale(1.04)" : "none",
                transition: "all 0.3s",
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: "0.7rem", sm: "0.82rem" } }}>
                {layer.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: { xs: "0.62rem", sm: "0.7rem" } }}>
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
    <Box sx={{ width: { xs: 52, sm: 96 }, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", pb: 1 }}>
      <Typography variant="caption" textAlign="center" color="text.secondary" mb={0.5}>
        ネットワーク
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
              {no === 0 ? "✉️" : CIRCLED[no - 1]}
            </Box>
          ))}
      </Box>
      <Typography variant="caption" textAlign="center" fontSize="1.2rem" color={active ? LAYER_BY_ID.link.color : "grey.400"}>
        {toRight ? "➡" : "⬅"}
      </Typography>
    </Box>
  );
}

function UnitBar({ unit, phase, selected, onSelect }: { unit: Unit; phase: Phase; selected: boolean; onSelect: () => void }) {
  const isImage = phase === "request";
  const dataWidth = Math.max(18, (unit.bytes / IMAGE_BYTES) * 100);
  const { a, b } = sliceOf(unit);
  return (
    <Box
      onClick={onSelect}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 0.5,
        borderRadius: 2,
        cursor: "pointer",
        outline: selected ? 2 : 0,
        outlineColor: "primary.main",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography sx={{ width: 28, textAlign: "center", fontWeight: 700 }}>
        {unit.no ? CIRCLED[unit.no - 1] : isImage ? "🖼️" : "✉️"}
      </Typography>
      <Box sx={{ display: "flex", flex: 1, minWidth: 0, height: 30 }}>
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
                minWidth: isData ? 84 : 40,
                px: 0.75,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                borderRight: "2px solid #fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                ...(isData && isImage ? photoSlice(a, b) : {}),
              }}
            >
              <Box
                component="span"
                sx={isData && isImage ? { bgcolor: "rgba(0,0,0,0.55)", px: 0.75, borderRadius: 0.5 } : undefined}
              >
                {isData ? `${isImage ? "画像" : "返事"} ${unit.bytes.toLocaleString()}B` : st.label}
              </Box>
            </Box>
          );
        })}
      </Box>
      {unit.checked && <CheckCircleIcon color="success" fontSize="small" />}
    </Box>
  );
}

function CompareBox({ compare }: { compare: NonNullable<Step["compare"]> }) {
  const box = (icon: string, title: string, value: string, bg: string, border: string) => (
    <Box sx={{ flex: 1, minWidth: 0, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: bg, border }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "text.secondary" }}>
        {icon} {title}
      </Typography>
      <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: { xs: "0.8rem", sm: "0.9rem" }, overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
  return (
    <Paper variant="outlined" sx={{ mt: 1, p: 1, borderColor: "success.main" }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {box("✉️", `ヘッダに書かれた宛先${compare.label}`, compare.header, "#fff", "2px solid #bdbdbd")}
        <Typography fontWeight={700} fontSize="1.4rem" color="success.main">
          ＝
        </Typography>
        {box("🪪", `自分の${compare.label}`, compare.mine, "#eceff1", "2px solid #90a4ae")}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" mt={0.75}>
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="body2" fontWeight={700}>
          一致 → {compare.result}
        </Typography>
      </Stack>
    </Paper>
  );
}

/** 各ステップで高さが変わらないよう、最も高くなるステップに合わせた最小の高さ（px） */
const TOP_MIN_MD = 545;
const TOP_MIN_LG = 455;
const DATA_MIN_XS = 632;
const DATA_MIN_MD = 320;
const DATA_MIN_LG = 280;

const MAX_UNITS = Math.max(...STEPS.map((s) => s.units.length));
const DETAIL_KINDS: PartKind[] = ["eth", "ip", "tcp", "data"];

function senderOf(phase: Phase): Side {
  return phase === "request" ? "client" : "server";
}

// ---------- プレイヤー（操作バー） ----------

const SPEEDS = [0.5, 1, 2] as const;
const BASE_INTERVAL = 4000;
const REPLY_START = STEPS.findIndex((s) => s.phase === "response");

interface PlayerProps {
  index: number;
  playing: boolean;
  speed: number;
  onSeek: (index: number) => void;
  onTogglePlay: () => void;
  onSpeed: () => void;
}

function PlayerBar({ index, playing, speed, onSeek, onTogglePlay, onSpeed }: PlayerProps) {
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const split = (REPLY_START / (STEPS.length - 1)) * 100;
  const iconSx = { color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" } };

  return (
    <Box
      sx={{
        position: "sticky",
        bottom: { xs: 8, sm: 12 },
        zIndex: 10,
        bgcolor: "#1d2330",
        color: "#fff",
        borderRadius: 3,
        boxShadow: 8,
        px: { xs: 1.5, sm: 2.5 },
        pt: 0.5,
        pb: 0.5,
      }}
    >
      {/* シークバー */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography sx={{ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", minWidth: 44, opacity: 0.8 }}>
          {index + 1} / {STEPS.length}
        </Typography>
        <Slider
          aria-label="ステップ"
          value={index + 1}
          min={1}
          max={STEPS.length}
          step={1}
          marks
          onChange={(_, v) => onSeek((v as number) - 1)}
          sx={{
            color: step.phase === "request" ? "#64b5f6" : "#ce93d8",
            height: 6,
            py: 1,
            "& .MuiSlider-rail": {
              opacity: 1,
              background: `linear-gradient(90deg, rgba(100,181,246,0.35) 0 ${split}%, rgba(206,147,216,0.35) ${split}% 100%)`,
            },
            "& .MuiSlider-mark": { bgcolor: "rgba(255,255,255,0.5)", width: 2, height: 6 },
            "& .MuiSlider-thumb": { width: 16, height: 16, bgcolor: "#fff" },
          }}
        />
      </Stack>
      <Box sx={{ position: "relative", height: 16, ml: { xs: "56px", sm: "60px" }, mt: -0.5 }}>
        <Typography sx={{ position: "absolute", left: 0, fontSize: "0.65rem", color: "#90caf9", whiteSpace: "nowrap" }}>
          ① 画像をアップロード
        </Typography>
        <Typography sx={{ position: "absolute", left: `${split}%`, fontSize: "0.65rem", color: "#e1bee7", whiteSpace: "nowrap" }}>
          ② 返事
        </Typography>
      </Box>

      {/* ボタンとタイトル */}
      <Stack direction="row" alignItems="center" spacing={{ xs: 0, sm: 0.5 }} mt={0.25}>
        <IconButton aria-label="最初から" title="最初から" onClick={() => onSeek(0)} disabled={index === 0} sx={iconSx}>
          <SkipPreviousIcon />
        </IconButton>
        <IconButton aria-label="戻る" title="戻る（←キー）" onClick={() => onSeek(index - 1)} disabled={index === 0} sx={iconSx}>
          <NavigateBeforeIcon  />
        </IconButton>
        <IconButton
          aria-label={playing ? "一時停止" : "自動再生"}
          title={playing ? "一時停止" : isLast ? "もう一度再生" : "自動再生"}
          onClick={onTogglePlay}
          size="small"
          sx={{ bgcolor: "#fff", color: "#1d2330", mx: 0.5, p: 0.75, "&:hover": { bgcolor: "#e3e8ef" } }}
        >
          {playing ? <PauseIcon  /> : isLast ? <ReplayIcon  /> : <PlayArrowIcon  />}
        </IconButton>
        <IconButton aria-label="次へ" title="次へ（→キー）" onClick={() => onSeek(index + 1)} disabled={isLast} sx={iconSx}>
          <NavigateNextIcon  />
        </IconButton>
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            ml: 1,
            fontWeight: 700,
            fontSize: { xs: "0.8rem", sm: "0.95rem" },
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {step.title}
        </Typography>
        <Button
          size="small"
          onClick={onSpeed}
          title="自動再生の速さ"
          sx={{ color: "#fff", border: "1px solid rgba(255,255,255,0.4)", minWidth: 0, px: 1, textTransform: "none", fontVariantNumeric: "tabular-nums" }}
        >
          {speed}x
        </Button>
      </Stack>
    </Box>
  );
}

// ---------- 本体 ----------

export default function NetworkSimulator() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(0);
  const [speed, setSpeed] = useState<number>(1);

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
    }, BASE_INTERVAL / speed);
    return () => clearTimeout(timer);
  }, [playing, index, isLast, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=slider]")) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else return;
      setSelected(0);
      setPlaying(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const location =
    step.where === "wire"
      ? "ネットワーク"
      : `${HOST[step.where.side].short}・${LAYER_BY_ID[step.where.layer].name}`;
  const receiving = step.where !== "wire" && step.where.side !== senderOf(step.phase);

  return (
    <Stack spacing={2}>
      {/* 全体図と説明（横並び） */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(0, 1fr)" },
          gap: 2,
          alignItems: "stretch",
          // ステップごとに高さが変わって下のカードが動かないよう、最も長いステップに合わせる
          minHeight: { md: TOP_MIN_MD, lg: TOP_MIN_LG },
        }}
      >
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1} mb={2} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="① 画像をアップロード：スマホ → Webサーバ"
                color={step.phase === "request" ? "primary" : "default"}
                variant={step.phase === "request" ? "filled" : "outlined"}
              />
              <Chip
                size="small"
                label="② 返事：Webサーバ → スマホ"
                color={step.phase === "response" ? "secondary" : "default"}
                variant={step.phase === "response" ? "filled" : "outlined"}
              />
            </Stack>
            <Box sx={{ display: "flex", alignItems: "stretch", gap: { xs: 0.5, sm: 1 } }}>
              <LayerStack side="client" step={step} />
              <Wire step={step} stepIndex={index} />
              <LayerStack side="server" step={step} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, display: "flex", flexDirection: "column" }}>
          <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              ステップ {index + 1} / {STEPS.length}　|　{location}
            </Typography>
            <Typography variant="h6" fontWeight={700} mb={0.5} sx={{ fontSize: "1.1rem" }}>
              {step.title}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-start">
              <Typography variant="body2" sx={{ lineHeight: 1.7, fontSize: "0.92rem", flex: 1, minWidth: 0 }}>
                {step.description}
              </Typography>
              <Box sx={{ width: { xs: 150, sm: 150 }, flexShrink: 0 }}>
                <PhotoView step={step} />
              </Box>
            </Stack>
            {step.compare && <CompareBox compare={step.compare} />}
            {step.checks && (
              <Paper variant="outlined" sx={{ mt: 1, p: 1, borderColor: "success.main", bgcolor: "#f1f8e9" }}>
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

          </CardContent>
        </Card>
      </Box>

      {/* データの中身（高さ固定） */}
      <Card sx={{ borderRadius: 3, minHeight: { xs: DATA_MIN_XS, md: DATA_MIN_MD, lg: DATA_MIN_LG } }}>
        <CardContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(0, 1fr)" },
              gap: 2,
            }}
          >
            <Box>
              <Typography fontWeight={700}>
                📦 いまのデータ（{step.units.length > 1 ? `${step.units.length}個に分割` : "1個"}）
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                クリックすると、そのデータのヘッダの中身を表示します
              </Typography>
              <Stack spacing={0.5}>
                {step.units.map((u, i) => (
                  <UnitBar key={`${index}-${i}`} unit={u} phase={step.phase} selected={u === unit} onSelect={() => setSelected(i)} />
                ))}
                {/* 行数が変わっても高さが変わらないよう、空き行を確保する */}
                {Array.from({ length: MAX_UNITS - step.units.length }, (_, i) => (
                  <Box key={`blank-${i}`} sx={{ height: 38 }} />
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
            </Box>

            <Box>
              <Typography fontWeight={700}>✉️ ヘッダに書かれている内容</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                選んだデータに付いているヘッダです（上の「🪪 自分のアドレス」とは別のものです）
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              {DETAIL_KINDS.map((kind) => {
                const present = unit.parts.includes(kind);
                const focused = present && step.focus === kind;
                const color = PART_STYLE[kind].color;
                return (
                  <Paper
                    key={kind}
                    variant="outlined"
                    sx={{
                      px: 1,
                      py: 0.75,
                      borderWidth: focused ? 3 : 1,
                      borderColor: focused ? color : "divider",
                      borderStyle: present ? "solid" : "dashed",
                      boxShadow: focused ? 3 : 0,
                      opacity: present ? 1 : 0.45,
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} sx={{ color, fontSize: "0.82rem" }} mb={0.25}>
                      {kind === "eth" ? "イーサネットヘッダ" : kind === "data" ? "データ（HTTP）" : `${PART_STYLE[kind].label}ヘッダ`}
                      {focused && " ← 注目"}
                      {!present && (
                        <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
                          {receiving ? "（外した）" : "（まだ付いていない）"}
                        </Box>
                      )}
                    </Typography>
                    {headerRows(kind, step.phase, unit).map(([k, v]) => (
                      <Stack
                        key={k}
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "baseline" }}
                        columnGap={1}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.7rem", sm: "0.8rem" }, whiteSpace: "nowrap" }}>
                          {k}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "monospace", fontSize: { xs: "0.72rem", sm: "0.8rem" }, textAlign: { sm: "right" }, overflowWrap: "anywhere" }}>
                          {present ? v : "—"}
                        </Typography>
                      </Stack>
                    ))}
                  </Paper>
                );
              })}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <PlayerBar
        index={index}
        playing={playing}
        speed={speed}
        onSeek={(i) => {
          setPlaying(false);
          go(i);
        }}
        onTogglePlay={() => {
          if (isLast) go(0);
          setPlaying((p) => !p);
        }}
        onSpeed={() => setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])}
      />
    </Stack>
  );
}
