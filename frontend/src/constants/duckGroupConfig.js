import {
  YAMAHA_CMD_LABELS,
  VMIX_FN_LABELS,
  yamahaCmdNeedsMix,
  yamahaCmdNeedsChannel,
} from "./ruleConfig";

export { YAMAHA_CMD_LABELS, VMIX_FN_LABELS, yamahaCmdNeedsMix, yamahaCmdNeedsChannel };

export const DEFAULT_DUCK_MEMBER = {
  monitor_channel: 1,
  threshold: -4000,
  release_threshold: -5000,
  action_target: "yamaha",
  yamaha_command: "InCh/Fader/Smooth",
  yamaha_channel: 10,
  yamaha_mix: 0,
  vmix_function: null,
  vmix_target_input: null,
  parameter_value: "-2500",
};

export const LISTEN_COPY_FIELDS = ["monitor_channel", "threshold", "release_threshold"];

export const LISTEN_FIELD_LABELS = {
  monitor_channel: "Mic Channel",
  threshold: "Attack (dB×100)",
  release_threshold: "Release (dB×100)",
};

export const DEFAULT_DUCK_ACTION = {
  action_target: "yamaha",
  yamaha_command: "InCh/Fader/Smooth",
  yamaha_channel: 10,
  yamaha_mix: 0,
  vmix_function: null,
  vmix_target_input: null,
  parameter_value: "-2500",
  sort_order: 0,
};

export const MEMBER_COPY_FIELDS = [
  "monitor_channel",
  "threshold",
  "release_threshold",
  "attack_ms",
  "release_ms",
];

export const MEMBER_FIELD_LABELS = {
  monitor_channel: "Mic Ch",
  threshold: "Thr",
  release_threshold: "Rel Thr",
  attack_ms: "Atk ms",
  release_ms: "Rel ms",
};

export const DEFAULT_DUCK_GROUP_FORM = {
  name: "",
  is_active: true,
  silence_timeout_ms: 3000,
  sort_order: 0,
  members: [
    {
      monitor_channel: 1,
      threshold: -4000,
      release_threshold: -5000,
      attack_ms: 700,
      release_ms: 700,
      sort_order: 0,
      actions: [{ ...DEFAULT_DUCK_ACTION }],
    },
  ],
};

export const DEFAULT_MULTI_FADE = "700,700";

function parseFadeMs(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseMultiFade(parameterValue) {
  const parts = String(parameterValue || DEFAULT_MULTI_FADE).split(",");
  const attack = parseFadeMs(parts[0], 700);
  const release = parseFadeMs(parts[1], attack);
  return { attack, release };
}

export function formatMultiFade(attack, release) {
  return `${attack || 700},${release || attack || 700}`;
}

export function meterLevelToWidth(level) {
  if (level == null || level <= -32768) return 0;
  const db = level / 100;
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export function meterLevelToColor(level, threshold = -4000) {
  if (level == null) return "#334155";
  if (level >= threshold) return "#22c55e";
  if (level >= threshold - 1000) return "#eab308";
  return "#475569";
}

export function formatMemberAction(m) {
  if (m.action_target === "vmix") {
    return `${m.vmix_function || "SetVolume"} → ${m.parameter_value}`;
  }
  const parts = [m.yamaha_command?.split("/").pop() || "Level", `Ch${m.yamaha_channel}`];
  if (m.yamaha_mix) parts.push(`Mx${m.yamaha_mix}`);
  parts.push(m.parameter_value);
  return parts.join(" · ");
}
