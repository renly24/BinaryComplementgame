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
      checks: [`宛先MAC ${s.mac} ＝ 自分の MAC アドレス → 受け取る`, "FCS で誤りなし → イーサネットヘッダと FCS を外す"],
    },
    {
      phase: "request",
      where: { side: "server", layer: "internet" },
      title: "宛先IPアドレスを確認",
      description: "IP ヘッダの宛先 IP アドレスが自分のものかを確認し、IP ヘッダを外します。",
      units: withParts(arrived, HEADERS_IP, true),
      focus: "ip",
      checks: [`宛先IP ${s.ip} ＝ 自分の IP アドレス → IPヘッダを外す`],
    },
    {
      phase: "request",
      where: { side: "server", layer: "transport" },
      title: "TCPヘッダを確認して並べ替える",
      description:
        "TCP ヘッダの宛先ポート番号を見て、どのアプリケーションに渡すかを決めます。さらにシーケンス番号を見て、届いた順（①③②）ではなく元の順番（①②③）に画像の切れ端を並べ替えます。",
      units: withParts(split, HEADERS_TCP, true),
      focus: "tcp",
      checks: [
        `宛先ポート ${s.port} → SNSの Web サービスに渡すデータ`,
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
      checks: [`宛先MAC ${c.mac} ＝ 自分の MAC アドレス → 受け取る`],
    },
    {
      phase: "response",
      where: { side: "client", layer: "internet" },
      title: "宛先IPアドレスを確認",
      description: "IP ヘッダの宛先 IP アドレスを確認して、IP ヘッダを外します。",
      units: withParts(reply, HEADERS_IP, true),
      focus: "ip",
      checks: [`宛先IP ${c.ip} ＝ 自分の IP アドレス → IPヘッダを外す`],
    },
    {
      phase: "response",
      where: { side: "client", layer: "transport" },
      title: "TCPヘッダの宛先ポートを確認",
      description: "宛先ポート番号 50000 を見て、この返事を SNS アプリに渡します。",
      units: withParts(reply, HEADERS_TCP, true),
      focus: "tcp",
      checks: [`宛先ポート ${c.port} → SNSアプリに渡す`],
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
        📷 画像のようす：{caption}
      </Typography>
      <Box sx={{ width: "100%", maxWidth: 260, position: "relative" }}>
        {pieces.length === 0 ? (
          <Box sx={{ aspectRatio: "3 / 2", borderRadius: 1.5, boxShadow: 2, ...photoSlice(0, 1) }} />
        ) : (
          <Stack spacing={0.75}>
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
          bgcolor: "grey.50",
          border: 1,
          borderColor: "divider",
        }}
      >
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
              sx={{ borderRadius: 1, px: 0.5, bgcolor: lit ? color : "transparent", color: lit ? "#fff" : "text.primary", transition: "all 0.3s" }}
            >
              <Typography sx={{ fontSize: { xs: "0.6rem", sm: "0.72rem" }, fontWeight: 700, color: lit ? "#fff" : color }}>
                {label}
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
                py: 0.75,
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
        {unit.no ? CIRCLED[unit.no - 1] : isImage ? "🖼️" : "✉️"}
      </Typography>
      <Box sx={{ display: "flex", flex: 1, minWidth: 0, height: 38 }}>
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
    }, 4000);
    return () => clearTimeout(timer);
  }, [playing, index, isLast]);

  const location =
    step.where === "wire"
      ? "ネットワーク"
      : `${HOST[step.where.side].short}・${LAYER_BY_ID[step.where.layer].name}`;
  const detailKinds = unit.parts.filter((p) => p !== "fcs");

  return (
    <Stack spacing={2}>
      {/* 全体図と説明（横並び） */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(0, 1fr)" },
          gap: 2,
          alignItems: "stretch",
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
            <Typography variant="caption" color="text.secondary">
              ステップ {index + 1} / {STEPS.length}　|　{location}
            </Typography>
            <LinearProgress variant="determinate" value={((index + 1) / STEPS.length) * 100} sx={{ my: 1, borderRadius: 1 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              {step.title}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, fontSize: "0.95rem" }}>
              {step.description}
            </Typography>
            {step.checks && (
              <Paper variant="outlined" sx={{ mt: 1.5, p: 1.25, borderColor: "success.main", bgcolor: "#f1f8e9" }}>
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

            <Box sx={{ mt: 1.5 }}>
              <PhotoView step={step} />
            </Box>

            <Stack direction="row" spacing={1} mt="auto" pt={2} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} disabled={index === 0} onClick={() => go(index - 1)}>
                戻る
              </Button>
              <Button
                size="small"
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
              <Button size="small" variant="contained" endIcon={<ArrowForwardIcon />} disabled={isLast} onClick={() => go(index + 1)}>
                次へ
              </Button>
              <Button
                size="small"
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
      </Box>

      {/* データの中身 */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(0, 1fr)" },
              gap: 2,
            }}
          >
            <Box>
              <Typography fontWeight={700} gutterBottom>
                📦 いまのデータ（{step.units.length > 1 ? `${step.units.length}個に分割` : "1個"}）
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                クリックすると、そのデータのヘッダの中身が表示されます
              </Typography>
              <Stack spacing={0.5}>
                {step.units.map((u, i) => (
                  <UnitBar key={`${index}-${i}`} unit={u} phase={step.phase} selected={u === unit} onSelect={() => setSelected(i)} />
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

            <Stack spacing={1.25}>
              {detailKinds.map((kind) => {
                const focused = step.focus === kind;
                const color = PART_STYLE[kind].color;
                return (
                  <Paper
                    key={kind}
                    variant="outlined"
                    sx={{
                      p: 1.25,
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
                        <Typography variant="body2" fontWeight={600} textAlign="right" sx={{ fontFamily: "monospace" }}>
                          {v}
                        </Typography>
                      </Stack>
                    ))}
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
