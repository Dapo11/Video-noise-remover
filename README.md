# Browser Video Studio Enhancer 🎙️✨

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white" alt="WebAssembly" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
</p>

An open-source, 100% client-side web application built to transform noisy video recordings into clean, broadcast-ready audio without subscription paywalls or privacy compromises[cite: 1].

---

## 📖 The Story Behind the Project

> _"I was shooting a video outdoors in heavy rain. Even with a microphone, the background noise was overwhelming. When I looked for tools online to clean it up, everything was locked behind subscription paywalls like CapCut Pro. So, I decided to build my own solution locally."_

Searching online for background noise removal tools led to a frustrating wall of paywalls, restrictive trial limits, or paid software tiers[cite: 1]. Rather than paying a recurring fee for audio cleanup, I built a browser-based application that processes audio entirely in your browser[cite: 1]. What started as a quick fix evolved into a custom, studio-grade vocal mastering engine that rivals paid alternatives[cite: 1].

---

## 🛠️ Tech Stack & Engine Architecture

- **Framework:** Next.js (React) + Tailwind CSS for mobile-responsive design[cite: 1]
- **Video/Audio Demuxing:** `@ffmpeg/ffmpeg` (FFmpeg compiled to WebAssembly)[cite: 1]
- **AI Noise Filtering:** `DeepFilterNet3Core` (WASM-based deep learning noise suppression)[cite: 1]
- **Audio Mastering & DSP:** Native Browser **Web Audio API** (`OfflineAudioContext`, `BiquadFilterNode`, `WaveShaperNode`, `DynamicsCompressorNode`, `ConvolverNode`)[cite: 1]

---

## ⚙️ How It Works (Step-by-Step Pipeline)

1. **Client-Side Extraction:** The user uploads a video file, and FFmpeg WASM extracts the raw audio track into a 48kHz stereo WAV file directly in memory[cite: 1].
2. **AI Noise Suppression:** The audio signal passes through DeepFilterNet3 to isolate human speech formants and subtract background environmental noise[cite: 1].
3. **Multi-Stage DSP Vocal Polish:**
   - **High-Pass Filter:** Cuts low-frequency sub-bass rumble below 75 Hz[cite: 1].
   - **Chest Resonance Restorer:** Re-introduces warmth around 280 Hz to restore natural vocal body[cite: 1].
   - **Dual-Band De-Sibilance:** Tames harsh "S", "T", and "CH" consonant spikes between 5.5 kHz and 8.0 kHz[cite: 1].
   - **Analogue Tube Saturation:** Uses a non-linear WaveShaper curve to inject soft harmonic saturation into thin vocals[cite: 1].
   - **Air Boost & Dynamic Makeup:** Adds a smooth high-shelf boost above 9.5 kHz paired with +3.2 dB makeup gain and a 20:1 brickwall peak limiter to prevent clipping[cite: 1].
   - **Micro-Spatial Reflection:** Adds an 8% wet stereo convolution space to remove the sterile "isolated box" sound[cite: 1].
4. **Re-Muxing & Export:** FFmpeg WASM combines the pristine, processed audio back with the original video stream for instant local download[cite: 1].

---

## 🚧 Challenges Faced & Countermeasures

| Challenge                        | Cause                                                                                                 | Our Countermeasure                                                                                                     |
| :------------------------------- | :---------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Thin, "Robotic" Vocals**       | Aggressive AI noise suppression levels (20 dB+) stripped vocal formants and phase coherence[cite: 1]. | Dialed back noise suppression intensity to level 8 and added a dedicated 280 Hz chest resonance EQ filter[cite: 1].    |
| **Harsh Sibilance**              | Boosting high frequencies for "crispness" exacerbated sharp "S" and "T" sounds[cite: 1].              | Implemented a dual-stage notch and low-shelf filter targeting 5.8 kHz and 7.2 kHz before presence boosting[cite: 1].   |
| **Sterile / "Dry" Sound**        | Pure mono processing left speech feeling flat and unnatural[cite: 1].                                 | Processed the audio stream in true stereo with a 150 ms algorithmic room impulse convolver[cite: 1].                   |
| **Output Clipping & Low Volume** | High gain boosts caused digital distortion during FFmpeg muxing[cite: 1].                             | Added a fast-attack (1 ms) brickwall limiter node at -1.0 dBFS to ensure high output volume without clipping[cite: 1]. |

---

## 🏆 Why This Beats Existing Paid Tools

- **Zero Subscription Fees:** No monthly payments, export limits, or watermarks[cite: 1].
- **Complete Data Privacy:** Audio and video processing happen 100% locally inside your web browser[cite: 1]. Files are never uploaded to an external server or cloud provider[cite: 1].
- **Precision Signal Chain:** Combines neural noise suppression with analogue-style harmonic saturation, de-essing, and peak limiting for studio-quality vocal clarity[cite: 1].

---

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/video-studio-enhancer.git](https://github.com/your-username/video-studio-enhancer.git)
   cd video-studio-enhancer
   ```
