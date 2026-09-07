"use client";

import React, { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { DeepFilterNet3Core } from "deepfilternet3-noise-filter";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [outputVideoSrc, setOutputVideoSrc] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    setStatus("Loading FFmpeg WASM...");
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    setLoaded(true);
    setStatus("Ready");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
      setOutputVideoSrc(null);
    }
  };

  const processVideo = async () => {
    if (!videoSrc || !ffmpegRef.current) return;
    setProcessing(true);

    try {
      const ffmpeg = ffmpegRef.current;
      setStatus("Step 1/3: Extracting audio stream...");

      const inputBlob = await fetch(videoSrc).then((res) => res.blob());
      await ffmpeg.writeFile("input.mp4", await fetchFile(inputBlob));

      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-ar",
        "48000",
        "-ac",
        "2",
        "raw_audio.wav",
      ]);
      const rawAudioData = (await ffmpeg.readFile(
        "raw_audio.wav",
      )) as Uint8Array;

      setStatus("Step 2/3: Running AI Filtering & Studio Vocal Mastering...");

      const audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )({
        sampleRate: 48000,
      });

      const rawAudioBuffer = rawAudioData.buffer.slice(0);
      const audioBuffer = await audioCtx.decodeAudioData(rawAudioBuffer);

      const dfProcessor = new DeepFilterNet3Core({
        sampleRate: 48000,
        noiseReductionLevel: 8,
        assetConfig: {
          cdnUrl: "/deepfilternet",
        },
      } as any);

      await dfProcessor.initialize();

      const offlineCtx = new OfflineAudioContext(2, audioBuffer.length, 48000);

      const hpFilter = offlineCtx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.value = 75;

      const dfNode = await dfProcessor.createAudioWorkletNode(offlineCtx);

      const bodyRestorer = offlineCtx.createBiquadFilter();
      bodyRestorer.type = "peaking";
      bodyRestorer.frequency.value = 280;
      bodyRestorer.Q.value = 1.0;
      bodyRestorer.gain.value = 3.5;

      const harshnessSoften = offlineCtx.createBiquadFilter();
      harshnessSoften.type = "peaking";
      harshnessSoften.frequency.value = 5500;
      harshnessSoften.Q.value = 2.0;
      harshnessSoften.gain.value = -5.5;

      const sibilanceCap = offlineCtx.createBiquadFilter();
      sibilanceCap.type = "lowshelf";
      sibilanceCap.frequency.value = 8000;
      sibilanceCap.gain.value = -2.5;

      const WaveShaperNode = offlineCtx.createWaveShaper();
      WaveShaperNode.curve = makeAnalogueWarmthCurve(48000);

      const compressor = offlineCtx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 2.5;
      compressor.attack.value = 0.03;
      compressor.release.value = 0.18;

      const presenceEQ = offlineCtx.createBiquadFilter();
      presenceEQ.type = "highshelf";
      presenceEQ.frequency.value = 9500;
      presenceEQ.gain.value = 2.5;

      const makeUpGain = offlineCtx.createGain();
      makeUpGain.gain.value = 1.45;

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -1.0;
      limiter.knee.value = 0.0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;

      const convolver = offlineCtx.createConvolver();
      convolver.buffer = createSubtleRoomImpulse(offlineCtx);

      const dryGain = offlineCtx.createGain();
      const wetGain = offlineCtx.createGain();
      dryGain.gain.value = 0.92;
      wetGain.gain.value = 0.08;

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      source.connect(hpFilter);
      hpFilter.connect(dfNode);
      dfNode.connect(bodyRestorer);
      bodyRestorer.connect(harshnessSoften);
      harshnessSoften.connect(sibilanceCap);
      sibilanceCap.connect(WaveShaperNode);
      WaveShaperNode.connect(compressor);
      compressor.connect(presenceEQ);
      presenceEQ.connect(makeUpGain);
      makeUpGain.connect(limiter);

      limiter.connect(dryGain);
      limiter.connect(convolver);
      convolver.connect(wetGain);

      dryGain.connect(offlineCtx.destination);
      wetGain.connect(offlineCtx.destination);

      source.start();

      setStatus("Step 2/3: Rendering Crisp Studio Audio Master...");
      const renderedBuffer = await offlineCtx.startRendering();
      const channelData = renderedBuffer.getChannelData(0);

      setStatus("Step 3/3: Rebuilding clean audio & merging video...");

      const cleanedWavBytes = createWavFileBytes(channelData, 48000);

      await ffmpeg.writeFile("cleaned.wav", cleanedWavBytes);
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-i",
        "cleaned.wav",
        "-c:v",
        "copy",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        "output.mp4",
      ]);

      const outputData = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
      const outputBlob = new Blob([outputData.buffer], { type: "video/mp4" });
      setOutputVideoSrc(URL.createObjectURL(outputBlob));

      setStatus("Complete!");
    } catch (err) {
      console.error("Video processing error:", err);
      setStatus("Error during processing. Check console for details.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-8 sm:px-6 md:p-12 flex flex-col items-center justify-start">
      <header className="max-w-2xl text-center mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
          Browser Video Studio Enhancer
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-slate-400">
          Pro AI Noise Removal & Crisp Vocal Polish — 100% Client-Side
        </p>
      </header>

      {!loaded ? (
        <div className="w-full max-w-md bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8 text-center shadow-xl">
          <p className="text-sm text-slate-300 mb-6">
            Initialize the WebAssembly processing engine to get started.
          </p>
          <button
            onClick={loadFFmpeg}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-500/20"
          >
            Initialize Engine
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xl md:max-w-3xl flex flex-col gap-6">
          {/* File Upload Section */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-xl">
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
              Select Input Video:
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="block w-full text-xs sm:text-sm text-slate-300
                file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                file:text-xs file:sm:text-sm file:font-semibold
                file:bg-slate-700 file:text-slate-100
                hover:file:bg-slate-600 file:cursor-pointer cursor-pointer"
            />
          </div>

          {/* Status Bar */}
          <div className="bg-slate-800/40 border border-yellow-500/20 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-yellow-400">
              <span className="font-semibold text-slate-300">Status: </span>
              {status}
            </p>
          </div>

          {/* Video Grid Section */}
          {videoSrc && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Original Video Card */}
              <div className="flex flex-col gap-3 bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl shadow-xl">
                <p className="text-xs sm:text-sm font-semibold text-slate-300">
                  Original Video
                </p>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <video
                    src={videoSrc}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  onClick={processVideo}
                  disabled={processing}
                  className="mt-auto w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 active:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-lg hover:shadow-emerald-500/20"
                >
                  {processing ? "Mastering Vocal..." : "Process Studio Audio"}
                </button>
              </div>

              {/* Cleaned Result Card */}
              <div className="flex flex-col gap-3 bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl shadow-xl">
                <p className="text-xs sm:text-sm font-semibold text-emerald-400">
                  Cleaned Studio Master
                </p>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  {outputVideoSrc ? (
                    <video
                      src={outputVideoSrc}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-xs sm:text-sm text-slate-500">
                        {processing
                          ? "Processing audio pipeline..."
                          : "Click 'Process Studio Audio' to render result"}
                      </p>
                    </div>
                  )}
                </div>

                {outputVideoSrc ? (
                  <a
                    href={outputVideoSrc}
                    download="clean_video.mp4"
                    className="mt-auto w-full text-center bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all"
                  >
                    Download Master Video
                  </a>
                ) : (
                  <button
                    disabled
                    className="mt-auto w-full bg-slate-800 text-slate-600 py-3 rounded-xl font-semibold text-xs sm:text-sm cursor-not-allowed"
                  >
                    Awaiting Output
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function makeAnalogueWarmthCurve(sampleRate: number): Float32Array {
  const n_samples = sampleRate;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] =
      ((3 + 1.5) * x * 20 * deg) / (Math.PI + 1.5 * Math.abs(x * 20 * deg));
  }
  return curve;
}

function createSubtleRoomImpulse(ctx: OfflineAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = rate * 0.15;
  const decay = 2.5;
  const impulse = ctx.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = length - i;
    left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
  }
  return impulse;
}

function createWavFileBytes(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
