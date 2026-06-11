/** Full command/event maps — do not change command path strings */

export const VMIX_EVENT_INFO = {
  TransitionIn:
    "Fires when this input goes LIVE (Program output). Use to apply audio changes the instant a scene cuts on-air.",
  TransitionOut:
    "Fires when this input leaves LIVE. Use to restore or mute levels as a scene cuts off-air.",
  InputPreview:
    "Fires when this input is placed in PREVIEW (next-up slot). Great for pre-loading audio before the cut.",
  OverlayIn:
    "Fires when an overlay layer (lower-third, logo) activates. Use to duck music for an announcement.",
  OverlayOut:
    "Fires when an overlay layer is deactivated. Use to restore audio after the overlay disappears.",
  AudioOn:
    "Fires when an input's audio is un-muted. Detected via the vMix XML API poller.",
  AudioOff:
    "Fires when an input's audio is muted. Detected via the vMix XML API poller.",
  VideoPlay:
    "Fires when a video clip starts playing. Use to auto-duck music while the video rolls.",
  VideoPause:
    "Fires when a video clip pauses or finishes. Use to restore music after the video ends.",
  TimeRemaining:
    "Fires when a playing video reaches a specific time remaining (e.g. 1 minute before finish).",
};

export const VMIX_EVENT_LABELS = {
  TransitionIn: "TransitionIn — Goes LIVE",
  TransitionOut: "TransitionOut — Leaves LIVE",
  InputPreview: "InputPreview — Enters PREVIEW",
  OverlayIn: "OverlayIn — Overlay ON",
  OverlayOut: "OverlayOut — Overlay OFF",
  AudioOn: "AudioOn — Audio Unmuted",
  AudioOff: "AudioOff — Audio Muted",
  VideoPlay: "VideoPlay — Video Starts",
  VideoPause: "VideoPause — Video Pauses",
  TimeRemaining: "TimeRemaining — Time Before Finish",
};

export const YAMAHA_CMD_INFO = {
  "InCh/Fader/Level":
    "Sets the volume fader level of an input channel. Value: integer dB units (0 = 0dB/Unity, -32768 = silent). Ch = channel 1–40.",
  "InCh/Fader/On":
    "Mutes or un-mutes an input channel. Value: 1 = Active (sound on), 0 = Muted (silent). Ch = channel number.",
  "InCh/Fader/Smooth":
    'Smoothly fades a channel level. Value format: START,END,DURATION_MS — e.g. "0,-2000,2000" fades 0dB→-20dB in 2 seconds.',
  "Mix/Fader/Level":
    "Sets the master output level of an Aux/Mix bus. Mix = bus number 1–20.",
  "Mix/Fader/On":
    "Mutes or un-mutes an Aux/Mix bus output. Value: 1 = Active, 0 = Muted. Mix = bus number.",
  "Matrix/Fader/Level":
    "Sets the level of a Matrix output (overflow room, lobby, translation feed). Ch = matrix output number (1-4 on TF series).",
  "Matrix/Fader/On":
    "Mutes or un-mutes a Matrix output. Value: 1 = Active, 0 = Muted. Ch = matrix number (1-4).",
  "DCA/Fader/Level":
    "Sets the level of a DCA group — controls ALL channels assigned to it simultaneously. Ch = DCA 1–8.",
  "DCA/Fader/On":
    "Mutes or un-mutes an entire DCA group at once. Replace 10 individual mute rules with 1 DCA rule.",
  "St/Fader/Level":
    "Sets the main Stereo Master output fader level. Ch should be 1.",
  "St/Fader/On":
    "Mutes or un-mutes the Stereo Master output. Value: 1 = Active, 0 = Muted.",
  "InCh/ToMix/Level":
    "Sets the send level from a channel into an Aux bus. Ch = input channel, Mix = aux bus number.",
  "InCh/ToMix/On":
    "Enables or disables a channel's send into an Aux bus. Value: 1 = send active, 0 = send off.",
  "InCh/ToFX/Level":
    "Sets the send level from a channel to an FX processor. Mix = FX number (1 or 2 on TF series).",
  "InCh/ToFX/On":
    "Enables or disables a channel's send to an FX processor. Mix = FX number (1 or 2).",
  "FXRTN/Fader/Level":
    "Sets the fader level of an FX Return. Ch = 1 for FX1, Ch = 2 for FX2.",
  "FXRTN/Fader/On":
    "Mutes or un-mutes an FX Return channel. Ch = 1 for FX1, Ch = 2 for FX2.",
  "USB/Record/Start":
    "Starts recording to USB. Mix = the Aux bus number to record. Mixer ignores this if no USB is connected.",
  "USB/Play/Start":
    "Starts playback from a USB drive (intro music, hold music). Plays from Track 1 or the last selected track.",
  "USB/Play/Stop": "Stops USB audio playback.",
  ssrecall_ex:
    "Recalls a saved scene/snapshot from the mixer's memory. Value = scene number; the channel field is ignored.",
};

export const YAMAHA_CMD_LABELS = {
  "InCh/Fader/Level": "Input Channel — Fader Level",
  "InCh/Fader/On": "Input Channel — Mute On/Off",
  "InCh/Fader/Smooth": "Input Channel — Smooth Fade",
  "Mix/Fader/Level": "Aux/Mix Bus — Master Level",
  "Mix/Fader/On": "Aux/Mix Bus — Mute On/Off",
  "Matrix/Fader/Level": "Matrix Output — Level",
  "Matrix/Fader/On": "Matrix Output — Mute On/Off",
  "DCA/Fader/Level": "DCA Group — Level",
  "DCA/Fader/On": "DCA Group — Mute On/Off",
  "St/Fader/Level": "Stereo Master — Level",
  "St/Fader/On": "Stereo Master — Mute On/Off",
  "InCh/ToMix/Level": "Channel → Aux Send Level",
  "InCh/ToMix/On": "Channel → Aux Send On/Off",
  "InCh/ToFX/Level": "Channel → FX Send Level",
  "InCh/ToFX/On": "Channel → FX Send On/Off",
  "FXRTN/Fader/Level": "FX Return — Level",
  "FXRTN/Fader/On": "FX Return — Mute On/Off",
  "USB/Record/Start": "USB Recorder — Start",
  "USB/Play/Start": "USB Player — Start Playback",
  "USB/Play/Stop": "USB Player — Stop Playback",
  ssrecall_ex: "Scene Recall — Load Preset",
};

export const VMIX_FN_INFO = {
  SetVolume:
    'Sets the volume of a specific vMix input. Requires "Target Input #". Value: 0 (silent) to 100 (max).',
  SetMasterVolume:
    "Sets the Master output volume in vMix. Affects all outputs. Value: 0–100.",
  SetBusAVolume:
    "Sets vMix Bus A volume (typically headphone/monitor mix). Value: 0–100.",
  SetBusBVolume: "Sets vMix Bus B volume. Value: 0–100.",
  SetBusCVolume: "Sets vMix Bus C volume. Value: 0–100.",
  SetBusDVolume: "Sets vMix Bus D volume. Value: 0–100.",
  SetBusEVolume: "Sets vMix Bus E volume. Value: 0–100.",
  SetBusFVolume: "Sets vMix Bus F volume. Value: 0–100.",
  SetBusGVolume: "Sets vMix Bus G volume. Value: 0–100.",
};

export const VMIX_FN_LABELS = {
  SetVolume: "SetVolume — Specific Input",
  SetMasterVolume: "SetMasterVolume — Master Output",
  SetBusAVolume: "SetBusAVolume — Bus A",
  SetBusBVolume: "SetBusBVolume — Bus B",
  SetBusCVolume: "SetBusCVolume — Bus C",
  SetBusDVolume: "SetBusDVolume — Bus D",
  SetBusEVolume: "SetBusEVolume — Bus E",
  SetBusFVolume: "SetBusFVolume — Bus F",
  SetBusGVolume: "SetBusGVolume — Bus G",
};

export const DEFAULT_RULE_FORM = {
  name: "New Rule",
  listen_source: "vmix",
  trigger_event: "TransitionIn",
  vmix_input_number: null,
  vmix_input_name: "",
  threshold: null,
  release_threshold: null,
  silence_timeout_ms: null,
  time_threshold: null,
  action_target: "yamaha",
  yamaha_command: "InCh/Fader/Level",
  yamaha_channel: 1,
  yamaha_mix: 0,
  vmix_function: "SetVolume",
  vmix_target_input: null,
  parameter_value: "0",
  delay_ms: 0,
  is_active: true,
  is_multi_duck: false,
  duck_members: [],
};

export const DEFAULT_PRESETS = [
  {
    id: "cut-mute",
    label: "Cut LIVE → Mute",
    form: {
      name: "Cut LIVE → Mute Channel",
      listen_source: "vmix",
      trigger_event: "TransitionIn",
      vmix_input_number: null,
      action_target: "yamaha",
      yamaha_command: "InCh/Fader/On",
      yamaha_channel: 1,
      yamaha_mix: 0,
      parameter_value: "0",
      delay_ms: 0,
      is_active: true,
    },
  },
  {
    id: "video-duck",
    label: "Video → Duck Music",
    form: {
      name: "Video Play → Duck Music",
      listen_source: "vmix",
      trigger_event: "VideoPlay",
      vmix_input_number: null,
      action_target: "yamaha",
      yamaha_command: "InCh/Fader/Smooth",
      yamaha_channel: 1,
      yamaha_mix: 0,
      parameter_value: "-2000,2000",
      delay_ms: 0,
      is_active: true,
    },
  },
  {
    id: "mic-duck",
    label: "Mic → Duck Aux",
    form: {
      name: "Mic Threshold → Duck Aux",
      listen_source: "yamaha",
      trigger_event: "YamahaMeter",
      vmix_input_number: 1,
      threshold: -4000,
      release_threshold: -5000,
      silence_timeout_ms: 3000,
      action_target: "yamaha",
      yamaha_command: "Mix/Fader/Level",
      yamaha_channel: 1,
      yamaha_mix: 1,
      parameter_value: "-2000",
      delay_ms: 0,
      is_active: true,
    },
  },
  {
    id: "scene-recall",
    label: "Cut → Scene",
    form: {
      name: "Cut LIVE → Recall Scene",
      listen_source: "vmix",
      trigger_event: "TransitionIn",
      vmix_input_number: null,
      action_target: "yamaha",
      yamaha_command: "ssrecall_ex",
      yamaha_channel: 0,
      yamaha_mix: 0,
      parameter_value: "1",
      delay_ms: 0,
      is_active: true,
    },
  },
];

export const RULE_FILTERS = [
  { id: "all", label: "All" },
  { id: "grouped", label: "Grouped" },
  { id: "ungrouped", label: "Ungrouped" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "never_fired", label: "Never Fired" },
  { id: "vmix_listen", label: "vMix Listen" },
  { id: "yamaha_listen", label: "Yamaha Listen" },
  { id: "vmix_input", label: "vMix Input", needsInput: true },
];

export function formatLastFired(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

export function formatListenDetail(rule, vmixInputs = []) {
  if (rule.listen_source === "yamaha") {
    const thr = rule.threshold ?? -4000;
    const rel = rule.release_threshold ?? thr - 1000;
    const sil = rule.silence_timeout_ms ?? 3000;
    if (rule.is_multi_duck) {
      const members = Array.isArray(rule.duck_members) ? rule.duck_members : [];
      const chs = members.map((m) => m.monitor_channel).filter(Boolean);
      return {
        badge: "MULTI DUCK",
        badgeColor: "#39E58C",
        primary: `${members.length || 0} mic channel${members.length === 1 ? "" : "s"}`,
        secondary: chs.length ? `Ch ${chs.join(", ")} · Silence ${sil}ms` : `Silence ${sil}ms`,
        tertiary: "Expand row to see each mic meter and action",
      };
    }
    return {
      badge: "YAMAHA METER",
      badgeColor: "#F6B44B",
      primary: `Monitor Ch ${rule.vmix_input_number || "?"}`,
      secondary: `Attack ${thr / 100}dB · Release ${rel / 100}dB · Silence ${sil}ms`,
      tertiary: "Triggers when channel level crosses threshold",
    };
  }
  const inputLabel = rule.vmix_input_number
    ? vmixInputs.find((i) => i.number === rule.vmix_input_number)?.title
      ? `Input ${rule.vmix_input_number}: ${vmixInputs.find((i) => i.number === rule.vmix_input_number).title}`
      : `Input ${rule.vmix_input_number}`
    : "Any vMix Input";
  const eventLabel =
    VMIX_EVENT_LABELS[rule.trigger_event] || rule.trigger_event;
  return {
    badge: "VMIX EVENT",
    badgeColor: "#20D9FF",
    primary: eventLabel,
    secondary: inputLabel,
    tertiary:
      rule.trigger_event === "TimeRemaining" && rule.time_threshold
        ? `When ${rule.time_threshold} remains`
        : VMIX_EVENT_INFO[rule.trigger_event]?.slice(0, 80) || "",
  };
}

export function formatCommandDetail(rule) {
  if (rule.is_multi_duck && rule.listen_source === "yamaha") {
    const members = Array.isArray(rule.duck_members) ? rule.duck_members : [];
    const fadeParts = String(rule.parameter_value || "700,700").split(",");
    const attackRaw = parseInt(fadeParts[0], 10);
    const attack = Number.isFinite(attackRaw) && attackRaw >= 0 ? attackRaw : 700;
    const releaseRaw = parseInt(fadeParts[1], 10);
    const release =
      Number.isFinite(releaseRaw) && releaseRaw >= 0 ? releaseRaw : attack;
    return {
      badge: "PER-MIC CMD",
      badgeColor: "#39E58C",
      primary: "Each mic → own command",
      secondary: `Fade ${attack}/${release}ms · ${members.length} mic${members.length === 1 ? "" : "s"}`,
      tertiary: "Set actions in Command tab",
    };
  }
  if (rule.action_target === "vmix") {
    const fn = VMIX_FN_LABELS[rule.vmix_function] || rule.vmix_function;
    const target =
      rule.vmix_function === "SetVolume" && rule.vmix_target_input
        ? ` → Input ${rule.vmix_target_input}`
        : "";
    return {
      badge: "SPEAK VMIX",
      badgeColor: "#20D9FF",
      primary: `${fn}${target}`,
      secondary: `Value: ${rule.parameter_value}`,
      tertiary: VMIX_FN_INFO[rule.vmix_function] || "",
    };
  }
  const cmdLabel =
    YAMAHA_CMD_LABELS[rule.yamaha_command] || rule.yamaha_command;
  const ch = rule.yamaha_channel ? `Ch ${rule.yamaha_channel}` : "";
  const mix = rule.yamaha_mix ? ` · Mix ${rule.yamaha_mix}` : "";
  return {
    badge: "SPEAK YAMAHA",
    badgeColor: "#39E58C",
    primary: cmdLabel,
    secondary: `${ch}${mix} → ${rule.parameter_value}`,
    tertiary: YAMAHA_CMD_INFO[rule.yamaha_command] || "",
  };
}

export function ruleSearchText(rule) {
  return [
    rule.id,
    rule.name,
    rule.group_name,
    rule.group_id,
    rule.listen_source,
    rule.trigger_event,
    rule.action_target,
    rule.yamaha_command,
    rule.yamaha_channel,
    rule.yamaha_mix,
    rule.vmix_function,
    rule.vmix_target_input,
    rule.vmix_input_number,
    rule.vmix_input_name,
    rule.parameter_value,
    rule.time_threshold,
    VMIX_EVENT_LABELS[rule.trigger_event],
    YAMAHA_CMD_LABELS[rule.yamaha_command],
    VMIX_FN_LABELS[rule.vmix_function],
  ]
    .filter((v) => v != null && v !== "")
    .join(" ")
    .toLowerCase();
}

export function ruleMatchesSearch(rule, query) {
  if (!query?.trim()) return true;
  return ruleSearchText(rule).includes(query.trim().toLowerCase());
}

export function ruleMatchesFilter(rule, filterId, vmixInputFilter = null) {
  switch (filterId) {
    case "all":
      return true;
    case "grouped":
      return !!rule.group_id;
    case "ungrouped":
      return !rule.group_id;
    case "active":
      return rule.is_active;
    case "inactive":
      return !rule.is_active;
    case "never_fired":
      return !(rule.fire_count > 0);
    case "vmix_listen":
      return rule.listen_source === "vmix";
    case "yamaha_listen":
      return rule.listen_source === "yamaha";
    case "vmix_input":
      return (
        rule.listen_source === "vmix" &&
        vmixInputFilter != null &&
        String(rule.vmix_input_number) === String(vmixInputFilter)
      );
    default:
      return true;
  }
}

export function yamahaCmdNeedsMix(cmd) {
  return (
    cmd.includes("/ToMix") ||
    cmd.includes("/ToFX") ||
    cmd.includes("Mix/Fader") ||
    cmd.includes("USB/Record") ||
    cmd.includes("FXRTN")
  );
}

export function yamahaCmdNeedsChannel(cmd) {
  if (cmd === "ssrecall_ex") return false;
  return (
    !cmd.includes("St/Fader") &&
    !cmd.includes("Mix/Fader") &&
    !cmd.includes("USB/Play")
  );
}
