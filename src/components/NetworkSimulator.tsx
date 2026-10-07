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
  { id: "app", name: "アプリケーション層", osi: "OSI 第5〜7層", protocol: "HTTPS", color: "#1e88e5" },
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
  client: { name: "Webブラウザ", note: "SNSで画像をアップロードする", ip: "192.168.1.10", mac: "AA:AA:AA:11:11:11", port: 50000 },
  server: { name: "Webサーバ", note: "SNSの画像を保存・表示する", ip: "192.168.1.20", mac: "BB:BB:BB:22:22:22", port: 443 },
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
  const arrival = [3, 1, 2];
  const arrived = arrival.map((no) => split[no - 1]);
  const reply: Unit[] = [{ no: null, parts: DATA_ONLY, bytes: RESPONSE_BYTES, seq: 1 }];
  const s = HOST.server;
  const c = HOST.client;

  return [
    // ---- 画像のアップロード（ブラウザ → サーバ） ----
    {
      phase: "request",
      where: { side: "client", layer: "app" },
      title: "画像を投稿する",
      description: `SNS の画面で写真を選んで「投稿」を押すと、アプリケーション層の HTTPS（暗号化された HTTP）が「この画像を保存してください」というリクエスト（POST /upload ＋ 画像データ）を作ります。画像の大きさは ${IMAGE_BYTES.toLocaleString()} バイトです（説明のため、とても小さな画像にしています）。`,
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
        "切り分けたそれぞれに TCP ヘッダを付けます。TCP ヘッダの“あて先”はポート番号で、送信元はブラウザのポート（50000）、宛先は Web サーバの HTTPS のポート（443）です。さらにシーケンス番号（画像の何バイト目からか）を書いておくので、受け取った側は元の順番に並べ直せます。",
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
        "パケットは別々の経路を通ることがあるので、送った順番どおりに届くとは限りません。ここでは ③→①→② の順に届きました。画像の切れ端がバラバラの順番で届いた状態です。",
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
        "TCP ヘッダの宛先ポート番号を見て、どのアプリケーションに渡すかを決めます。さらにシーケンス番号を見て、届いた順（③①②）ではなく元の順番（①②③）に画像の切れ端を並べ替えます。",
      units: withParts(split, HEADERS_TCP, true),
      focus: "tcp",
      checks: [
        `宛先ポート ${s.port} → HTTPS の Web サービスに渡すデータ`,
        `シーケンス番号 ${split.map((u) => u.seq).join(" → ")} の順に並べ替え`,
        "受け取った分は確認応答（ACK）でブラウザに知らせる",
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
      description: "Web サーバが HTTPS のリクエスト（POST /upload）と画像を受け取り、保存しました。次は「投稿できました」という返事（レスポンス）を送ります。",
      units: image,
      focus: "data",
    },

    // ---- 返事（サーバ → ブラウザ） ----
    {
      phase: "response",
      where: { side: "server", layer: "app" },
      title: "「投稿完了」の返事を作る",
      description: `Web サーバは「201 Created（投稿できました）」という HTTPS のレスポンスを作ります。大きさは ${RESPONSE_BYTES} バイトです。`,
      units: reply,
      focus: "data",
    },
    {
      phase: "response",
      where: { side: "server", layer: "transport" },
      title: "TCPヘッダを付ける（分割は不要）",
      description: `返事は ${RESPONSE_BYTES} バイトと小さいので、分割せずにそのまま TCP ヘッダを付けます。今度は送信元ポート 443 → 宛先ポート 50000 です。`,
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
      description: "返事のフレームがブラウザに向かって流れていきます。",
      units: withParts(reply, HEADERS_ALL),
      arrival: [0],
    },
    {
      phase: "response",
      where: { side: "client", layer: "link" },
      title: "宛先MACアドレスを確認",
      description: "ブラウザ側のコンピュータは宛先 MAC アドレスと FCS を確認して、イーサネットヘッダを外します。",
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
      description: "宛先ポート番号 50000 を見て、この返事をブラウザに渡します。",
      units: withParts(reply, HEADERS_TCP, true),
      focus: "tcp",
      checks: [`宛先ポート ${c.port} → ブラウザに渡す`],
    },
    {
      phase: "response",
      where: { side: "client", layer: "app" },
      title: "「投稿しました」と表示",
      description:
        "ブラウザが HTTPS のレスポンス（201 Created）を受け取り、画面に「投稿しました」と表示します。これで画像のアップロードが完了です。",
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
const PIECES = segments(IMAGE_BYTES).map((s, i): Unit => ({ no: i + 1, parts: DATA_ONLY, ...s }));
const ARRIVAL = STEPS.find((s) => s.phase === "request" && s.arrival)!.arrival!;

// ---------- 層の表（送信側・層の説明・受信側） ----------

const ORDER: Layer[] = ["app", "transport", "internet", "link"];
const WIRE_POS = 4;

const LAYER_INFO: Record<Layer, { role: string; protocols: string }> = {
  app: { role: "アプリケーションごとに決まったプロトコルを使う。", protocols: "HTTP・HTTPS（Webページ）、SMTP・POP・IMAP（電子メール）" },
  transport: { role: "どのアプリケーションあてかを見分け、通信の信頼性を決める。", protocols: "TCP、UDP" },
  internet: { role: "宛先のコンピュータまでデータを届ける。", protocols: "IP" },
  link: { role: "ケーブルや電波など、物理的な通信の仕様を決める。", protocols: "イーサネット、Wi-Fi" },
};

const COLUMN = {
  client: { color: "#e57399", bg: "#f8d7e3" },
  server: { color: "#5aa9dc", bg: "#d4eaf8" },
} as const;

const CELL_BG = "#fffbea";
const TCP_BLUE = "#1565c0";
const IP_GREEN = "#2e9d3e";

function senderOf(phase: Phase): Side {
  return phase === "request" ? "client" : "server";
}

/** 1 回のやり取りの中での位置（送信側 0〜3、ケーブル 4、受信側 5〜8） */
function cellPos(side: Side, layer: Layer, phase: Phase): number {
  const i = ORDER.indexOf(layer);
  return side === senderOf(phase) ? i : WIRE_POS + 1 + (3 - i);
}

function stepPos(step: Step): number {
  return step.where === "wire" ? WIRE_POS : cellPos(step.where.side, step.where.layer, step.phase);
}

function Pill({ label }: { label: string }) {
  return (
    <Box
      component="span"
      sx={{ bgcolor: "#7e57c2", color: "#fff", borderRadius: 99, px: 1.25, py: 0.1, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}
    >
      {label}
    </Box>
  );
}

function Strip({ unit }: { unit: Unit }) {
  const { a, b } = sliceOf(unit);
  return <Box sx={{ width: { xs: 22, sm: 44 }, height: 26, flexShrink: 0, ...photoSlice(a, b) }} />;
}

function Reply() {
  return (
    <Box sx={{ bgcolor: "#fff", border: "1px solid #bbb", px: 0.75, height: 26, display: "flex", alignItems: "center", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      201 投稿完了
    </Box>
  );
}

/** パケットの小さな絵：[IP][TCP 番号][中身] */
function MiniPacket({ unit, phase, ip, tcp }: { unit: Unit | null; phase: Phase; ip?: "on" | "removed"; tcp?: "on" | "removed" }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      {ip && (
        <Box
          sx={{
            height: 26,
            px: 0.5,
            display: "flex",
            alignItems: "center",
            fontSize: "0.62rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
            ...(ip === "on"
              ? { bgcolor: IP_GREEN, color: "#fff" }
              : { border: `2px dashed ${IP_GREEN}`, color: IP_GREEN, opacity: 0.7 }),
          }}
        >
          IP
        </Box>
      )}
      {tcp && (
        <Box
          sx={{
            width: { xs: 18, sm: 24 },
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: { xs: "0.7rem", sm: "0.8rem" },
            color: "#fff",
            bgcolor: tcp === "on" ? TCP_BLUE : "#78909c",
          }}
        >
          {unit?.no ?? "1"}
        </Box>
      )}
      {phase === "request" && unit ? <Strip unit={unit} /> : <Reply />}
    </Box>
  );
}

function PacketRow({ units, phase, ip, tcp }: { units: (Unit | null)[]; phase: Phase; ip?: "on" | "removed"; tcp?: "on" | "removed" }) {
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="center">
      {units.map((u, i) => (
        <MiniPacket key={i} unit={u} phase={phase} ip={ip} tcp={tcp} />
      ))}
    </Stack>
  );
}

function Photo({ width = 150 }: { width?: number }) {
  return <Box sx={{ width, maxWidth: "100%", aspectRatio: "3 / 2", borderRadius: 1, boxShadow: 1, ...photoSlice(0, 1) }} />;
}

const flow = keyframes`
  from { stroke-dashoffset: 40; }
  to { stroke-dashoffset: 0; }
`;

function Waveform({ active }: { active: boolean }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 200 36"
      sx={{
        width: "100%",
        maxWidth: 200,
        height: 36,
        "& path": active ? { strokeDasharray: "8 2", animation: `${flow} 0.8s linear infinite` } : {},
      }}
    >
      <path d="M0 28 H40 V8 H70 V28 H90 V8 H140 V28 H200" fill="none" stroke="#7b1fa2" strokeWidth="3" />
    </Box>
  );
}

/** 受信側トランスポート層：届いた順 → 番号順に並べ替え */
function ReorderView() {
  const n = PIECES.length;
  const x = (slot: number) => ((slot + 0.5) / n) * 300;
  return (
    <Box sx={{ width: "100%", maxWidth: 300 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, justifyItems: "center" }}>
        {PIECES.map((u) => (
          <MiniPacket key={u.no} unit={u} phase="request" tcp="removed" />
        ))}
      </Box>
      <Box component="svg" viewBox="0 0 300 30" preserveAspectRatio="none" sx={{ width: "100%", height: 30, display: "block" }}>
        {ARRIVAL.map((no, j) => (
          <line key={no} x1={x(j)} y1={28} x2={x(no - 1)} y2={2} stroke="#333" strokeWidth={2} />
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, justifyItems: "center" }}>
        {ARRIVAL.map((no) => (
          <MiniPacket key={no} unit={PIECES[no - 1]} phase="request" tcp="on" />
        ))}
      </Box>
    </Box>
  );
}

function cellContent(role: "sender" | "receiver", layer: Layer, phase: Phase, active: boolean): { text: string; visual: React.ReactNode } {
  const up = phase === "request";
  const reply = [null];
  if (role === "sender") {
    switch (layer) {
      case "app":
        return { text: up ? "画像データをトランスポート層へ送る。" : "「投稿完了」の返事をトランスポート層へ送る。", visual: up ? <Photo /> : <Reply /> };
      case "transport":
        return {
          text: up
            ? "データをパケットに分割する。TCPヘッダに番号とポート番号を記録し、インターネット層へ送る。"
            : "小さいので分割しない。TCPヘッダにポート番号を記録し、インターネット層へ送る。",
          visual: <PacketRow units={up ? PIECES : reply} phase={phase} tcp="on" />,
        };
      case "internet":
        return {
          text: "宛先と送信元のIPアドレスをIPヘッダに記録し、ネットワークインタフェース層へ送る。",
          visual: <PacketRow units={up ? PIECES : reply} phase={phase} ip="on" tcp="on" />,
        };
      case "link":
        return { text: "ネットワークへ信号として送り出す。", visual: <Waveform active={active} /> };
    }
  }
  switch (layer) {
    case "link":
      return { text: "ネットワーク上の信号を受け取り、自分あてのものを取り込む。", visual: <Waveform active={active} /> };
    case "internet":
      return {
        text: "自分あてのパケットを受け取り、IPヘッダを取り除いてトランスポート層へ送る。",
        visual: <PacketRow units={up ? ARRIVAL.map((no) => PIECES[no - 1]) : reply} phase={phase} ip="removed" tcp="on" />,
      };
    case "transport":
      return up
        ? { text: "TCPヘッダの番号をもとに並べ替えて復元し、TCPヘッダを取り除く。", visual: <ReorderView /> }
        : { text: "TCPヘッダのポート番号で渡す先を確認し、TCPヘッダを取り除く。", visual: <PacketRow units={reply} phase={phase} tcp="removed" /> };
    case "app":
      return up
        ? { text: "画像データを受け取り、保存・表示する。", visual: <Photo /> }
        : { text: "返事を受け取り、「投稿しました」と表示する。", visual: <Reply /> };
  }
}

function SideCell({ side, layer, step }: { side: Side; layer: Layer; step: Step }) {
  const role = side === senderOf(step.phase) ? "sender" : "receiver";
  const pos = cellPos(side, layer, step.phase);
  const cur = stepPos(step);
  const state = pos < cur ? "done" : pos === cur ? "active" : "pending";
  const { text, visual } = cellContent(role, layer, step.phase, state === "active");
  const color = LAYER_BY_ID[layer].color;

  return (
    <Box
      sx={{
        bgcolor: state === "active" ? "#fff1bf" : CELL_BG,
        borderLeft: `3px solid ${COLUMN[side].color}`,
        borderRight: `3px solid ${COLUMN[side].color}`,
        p: { xs: 0.75, sm: 1.25 },
        position: "relative",
        boxShadow: state === "active" ? `inset 0 0 0 3px ${color}` : "none",
        transition: "box-shadow 0.3s",
        minWidth: 0,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} mb={1}>
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.8rem", lineHeight: 1.5 }}>
          {text}
        </Typography>
        <Pill label={LAYER_BY_ID[layer].protocol === "イーサネット" ? "信号" : LAYER_BY_ID[layer].protocol} />
      </Stack>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          opacity: state === "pending" ? 0.25 : 1,
          filter: state === "pending" ? "grayscale(1)" : "none",
          transition: "opacity 0.4s",
        }}
      >
        {visual}
      </Box>
    </Box>
  );
}

const travelRight = keyframes`
  from { left: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { left: calc(100% - 26px); opacity: 0; }
`;
const travelLeft = keyframes`
  from { left: calc(100% - 26px); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { left: 0%; opacity: 0; }
`;

function CenterCell({ layer, step, stepIndex }: { layer: Layer; step: Step; stepIndex: number }) {
  const info = LAYER_INFO[layer];
  const l = LAYER_BY_ID[layer];
  const isLink = layer === "link";
  const toRight = step.phase === "request";
  const onWire = step.where === "wire";
  return (
    <Box sx={{ p: 1.25, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.75, minWidth: 0 }}>
      <Typography fontWeight={700} sx={{ color: l.color, fontSize: "1rem" }}>
        {l.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>
        {l.osi}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
        {info.role}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
        <Box component="span" sx={{ border: "1px solid #555", px: 0.5, mr: 0.5 }}>
          代表的なプロトコル
        </Box>
        {info.protocols}
      </Typography>
      {isLink && (
        <Box sx={{ position: "relative", height: 30, mt: 0.5 }}>
          <Box sx={{ position: "absolute", top: 13, left: 0, right: 0, height: 4, bgcolor: "#e53950", borderRadius: 2 }} />
          <Box
            sx={{
              position: "absolute",
              top: 5,
              [toRight ? "right" : "left"]: -4,
              width: 0,
              height: 0,
              borderTop: "10px solid transparent",
              borderBottom: "10px solid transparent",
              [toRight ? "borderLeft" : "borderRight"]: "14px solid #e53950",
            }}
          />
          {onWire &&
            step.arrival!.map((no, i) => (
              <Box
                key={`${stepIndex}-${i}`}
                sx={{
                  position: "absolute",
                  top: 2,
                  width: 26,
                  height: 26,
                  borderRadius: 1,
                  bgcolor: TCP_BLUE,
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
                {no === 0 ? "✉" : no}
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
}

const ROW_SX = {
  display: "grid",
  gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr)" },
  "& > .center": { gridColumn: { xs: "1 / -1", md: "auto" }, order: { xs: -1, md: 0 } },
} as const;

function LayerTable({ step, stepIndex }: { step: Step; stepIndex: number }) {
  const sender = senderOf(step.phase);
  return (
    <Box sx={{ borderRadius: 2, overflow: "hidden", border: "1px solid #ddd", bgcolor: CELL_BG }}>
      {/* 見出し */}
      <Box sx={ROW_SX}>
        {(["client", "center", "server"] as const).map((key) =>
          key === "center" ? (
            <Box key={key} className="center" sx={{ display: { xs: "none", md: "block" } }} />
          ) : (
            <Box key={key} sx={{ bgcolor: COLUMN[key].bg, border: `3px solid ${COLUMN[key].color}`, borderBottomWidth: 0, p: 1, textAlign: "center" }}>
              <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap>
                <Box component="span" sx={{ bgcolor: "#fff", borderRadius: 99, px: 1.25, fontSize: "0.75rem", fontWeight: 700 }}>
                  {key === sender ? "送信側 ⬇" : "受信側 ⬆"}
                </Box>
                <Typography fontWeight={700}>{HOST[key].name}</Typography>
              </Stack>
              <Typography variant="caption" fontWeight={600}>
                {HOST[key].note}
              </Typography>
            </Box>
          ),
        )}
      </Box>
      {ORDER.map((layer) => (
        <Box key={layer} sx={{ ...ROW_SX, borderTop: "1px solid #999" }}>
          <SideCell side="client" layer={layer} step={step} />
          <Box className="center">
            <CenterCell layer={layer} step={step} stepIndex={stepIndex} />
          </Box>
          <SideCell side="server" layer={layer} step={step} />
        </Box>
      ))}
    </Box>
  );
}

// ---------- データの中身 ----------

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
      : `${HOST[step.where.side].name}・${LAYER_BY_ID[step.where.layer].name}`;
  const detailKinds = unit.parts.filter((p) => p !== "fcs");

  return (
    <Stack spacing={2}>
      {/* 層の表と説明（横並び） */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2.1fr) minmax(0, 1fr)" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1} mb={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="① 画像をアップロード：ブラウザ → サーバ"
                color={step.phase === "request" ? "primary" : "default"}
                variant={step.phase === "request" ? "filled" : "outlined"}
              />
              <Chip
                size="small"
                label="② 返事：サーバ → ブラウザ"
                color={step.phase === "response" ? "secondary" : "default"}
                variant={step.phase === "response" ? "filled" : "outlined"}
              />
            </Stack>
            <LayerTable step={step} stepIndex={index} />
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, position: { lg: "sticky" }, top: { lg: 16 } }}>
          <CardContent>
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

            <Stack direction="row" spacing={1} pt={2} justifyContent="center" flexWrap="wrap" useFlexGap>
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
                      {p === "eth" ? "イーサネットヘッダ / FCS" : p === "data" ? "データ（HTTPS）" : `${PART_STYLE[p].label}ヘッダ`}
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
                      {kind === "eth" ? "イーサネットヘッダ" : kind === "data" ? "データ（HTTPS）" : `${PART_STYLE[kind].label}ヘッダ`}
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
