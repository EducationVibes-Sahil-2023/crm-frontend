"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { PRESENCE_STYLES, initials, type Contact } from "@/lib/chat";

export type CallMode = "audio" | "video";
type Phase = "connecting" | "active" | "ended" | "error";

// Real browser call: captures the camera/mic with getUserMedia and pipes the
// tracks through a live RTCPeerConnection. Without a backend signalling server
// we can't reach a remote device, so we wire a local loopback connection — the
// remote tile is a genuine WebRTC stream (the same media, relayed peer-to-peer
// in-browser). Swap the loopback for a signalling channel to make it multi-user.
export default function CallModal({
  contact,
  mode,
  onClose,
}: {
  contact: Contact;
  mode: CallMode;
  onClose: (durationSec: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0); // latest duration for hang-up handlers

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);
  const senderRef = useRef<RTCRtpSender | null>(null);
  const pcLocalRef = useRef<RTCPeerConnection | null>(null);
  const pcRemoteRef = useRef<RTCPeerConnection | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    camTrackRef.current?.stop();
    pcLocalRef.current?.close();
    pcRemoteRef.current?.close();
    streamRef.current = null;
    pcLocalRef.current = null;
    pcRemoteRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    setPhase("ended");
    cleanup();
    window.setTimeout(() => onClose(secondsRef.current), 700);
  }, [cleanup, onClose]);

  // Acquire media + establish the live peer connection on mount.
  useEffect(() => {
    let cancelled = false;
    const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video" ? { facingMode: "user" } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        camTrackRef.current = stream.getVideoTracks()[0] ?? null;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pcLocal = new RTCPeerConnection(ICE);
        const pcRemote = new RTCPeerConnection(ICE);
        pcLocalRef.current = pcLocal;
        pcRemoteRef.current = pcRemote;

        pcLocal.onicecandidate = (e) => e.candidate && pcRemote.addIceCandidate(e.candidate);
        pcRemote.onicecandidate = (e) => e.candidate && pcLocal.addIceCandidate(e.candidate);

        const remoteStream = new MediaStream();
        pcRemote.ontrack = (e) => {
          remoteStream.addTrack(e.track);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        };

        for (const track of stream.getTracks()) {
          const sender = pcLocal.addTrack(track, stream);
          if (track.kind === "video") senderRef.current = sender;
        }

        const offer = await pcLocal.createOffer();
        await pcLocal.setLocalDescription(offer);
        await pcRemote.setRemoteDescription(offer);
        const answer = await pcRemote.createAnswer();
        await pcRemote.setLocalDescription(answer);
        await pcLocal.setRemoteDescription(answer);

        // Short "ringing" beat before the call goes live.
        window.setTimeout(() => {
          if (!cancelled) setPhase("active");
        }, 1600);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setErrorMsg(
          name === "NotAllowedError"
            ? "Camera & microphone access was blocked. Allow permissions to start the call."
            : name === "NotFoundError"
              ? "No camera or microphone was found on this device."
              : "Couldn't start the call. Please check your devices and try again.",
        );
        setPhase("error");
      }
    }

    start();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mode, cleanup]);

  // Call timer.
  useEffect(() => {
    if (phase !== "active") return;
    const id = window.setInterval(
      () =>
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          return next;
        }),
      1000,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  // Escape to hang up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && endCall();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endCall]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }

  function toggleCam() {
    const next = !camOff;
    setCamOff(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
  }

  async function toggleShare() {
    try {
      if (!sharing) {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = display.getVideoTracks()[0];
        await senderRef.current?.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = display;
        setSharing(true);
        setCamOff(false);
        // When the user stops sharing from the browser UI, fall back to camera.
        screenTrack.onended = () => restoreCamera();
      } else {
        restoreCamera();
      }
    } catch {
      /* user cancelled the picker */
    }
  }

  function restoreCamera() {
    const cam = camTrackRef.current;
    if (cam && senderRef.current) senderRef.current.replaceTrack(cam);
    if (localVideoRef.current && streamRef.current) localVideoRef.current.srcObject = streamRef.current;
    setSharing(false);
  }

  const isVideo = mode === "video";
  const showVideoTiles = isVideo && phase === "active" && !camOff;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Ambient gradient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_15%,rgb(37_99_235_/_0.5),transparent_45%),radial-gradient(circle_at_85%_85%,rgb(79_70_229_/_0.45),transparent_45%)]" />

      {/* Remote / main stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Live remote video (hidden until we have a video call that's connected) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            showVideoTiles ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Avatar stage — audio calls, connecting, or camera off */}
        {!showVideoTiles && (
          <div className="relative z-10 flex flex-col items-center text-center text-white">
            <div className="relative">
              {phase === "connecting" && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
                  <span className="absolute -inset-3 animate-pulse rounded-full ring-2 ring-white/20" />
                </>
              )}
              <span
                className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${contact.avatarColor} text-4xl font-bold shadow-2xl`}
              >
                {initials(contact.name)}
              </span>
            </div>
            <h2 className="mt-6 text-2xl font-bold">{contact.name}</h2>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-white/70">
              {phase === "connecting" && "Ringing…"}
              {phase === "active" && (
                <>
                  <span className={`h-2 w-2 rounded-full ${PRESENCE_STYLES[contact.presence].dot}`} />
                  {isVideo ? (camOff ? "Camera off" : "Connecting video…") : "Voice call"} ·{" "}
                  {formatDuration(seconds)}
                </>
              )}
              {phase === "ended" && "Call ended"}
            </p>
            {phase === "error" && <p className="mt-4 max-w-sm text-sm text-rose-300">{errorMsg}</p>}
          </div>
        )}

        {/* Live label + timer overlay for video calls */}
        {showVideoTiles && (
          <div className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full bg-black/40 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {contact.name} · {formatDuration(seconds)}
          </div>
        )}

        {/* Local self-view (picture-in-picture) */}
        {isVideo && (
          <div className="absolute bottom-5 right-5 z-20 h-40 w-28 overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-900 shadow-2xl sm:h-44 sm:w-32">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full -scale-x-100 object-cover ${camOff ? "hidden" : ""}`}
            />
            {camOff && (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white/50">
                <Icon name="videoOff" className="h-7 w-7" />
              </div>
            )}
            <span className="absolute bottom-1.5 left-2 text-[11px] font-semibold text-white/90">You</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-10 pt-4 sm:gap-4">
        {phase === "error" ? (
          <button
            onClick={() => onClose(0)}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Close
          </button>
        ) : (
          <>
            <CtrlBtn
              label={muted ? "Unmute" : "Mute"}
              icon={muted ? "micOff" : "mic"}
              active={muted}
              onClick={toggleMute}
            />
            {isVideo && (
              <>
                <CtrlBtn
                  label={camOff ? "Turn on camera" : "Turn off camera"}
                  icon={camOff ? "videoOff" : "videoCam"}
                  active={camOff}
                  onClick={toggleCam}
                />
                <CtrlBtn
                  label={sharing ? "Stop sharing" : "Share screen"}
                  icon="screenShare"
                  active={sharing}
                  onClick={toggleShare}
                />
              </>
            )}
            {/* Hang up */}
            <button
              onClick={endCall}
              aria-label="End call"
              title="End call"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-700 active:scale-95"
            >
              <Icon name="phone" className="h-6 w-6 rotate-[135deg]" filled />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition active:scale-95 ${
        active ? "bg-white text-slate-900" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      <Icon name={icon} className="h-6 w-6" />
    </button>
  );
}

function formatDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
