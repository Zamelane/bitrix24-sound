#!/usr/bin/env python3
"""Generate short royalty-free notification presets as MP3."""

from __future__ import annotations

import math
import struct
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sounds" / "presets"
SR = 44100


def write_wav(path: Path, samples: list[float]) -> None:
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, sample)) * 32767))
            for sample in samples
        )
        handle.writeframes(frames)


def fade(samples: list[float], fade_in: float = 0.01, fade_out: float = 0.05) -> list[float]:
    count = len(samples)
    fade_in_n = int(SR * fade_in)
    fade_out_n = int(SR * fade_out)
    result = list(samples)
    for index in range(min(fade_in_n, count)):
        result[index] *= index / fade_in_n
    for index in range(min(fade_out_n, count)):
        result[count - 1 - index] *= index / fade_out_n
    return result


def sine(freq: float, duration: float, volume: float = 0.45) -> list[float]:
    count = int(SR * duration)
    return [
        math.sin(2 * math.pi * freq * index / SR) * volume for index in range(count)
    ]


def pad(samples: list[float], leading: float = 0.0) -> list[float]:
    return [0.0] * int(SR * leading) + samples


def mix(*tracks: list[float]) -> list[float]:
    length = max(len(track) for track in tracks)
    result = [0.0] * length
    for track in tracks:
        for index, sample in enumerate(track):
            result[index] += sample
    peak = max((abs(sample) for sample in result), default=1.0) or 1.0
    if peak > 0.9:
        result = [sample * 0.9 / peak for sample in result]
    return result


def to_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(mp3_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wav_path.unlink()


def decaying_bell(duration: float = 0.55) -> list[float]:
    count = int(SR * duration)
    samples: list[float] = []
    for index in range(count):
        t = index / SR
        envelope = math.exp(-t * 5)
        sample = (
            math.sin(2 * math.pi * 784 * t)
            + 0.35 * math.sin(2 * math.pi * 1568 * t)
        ) * 0.4 * envelope
        samples.append(sample)
    return samples


def pulse() -> list[float]:
    count = int(SR * 0.4)
    burst = []
    for index in range(count):
        t = index / SR
        burst.append(
            (math.sin(2 * math.pi * 440 * t) + math.sin(2 * math.pi * 480 * t)) * 0.22
        )
    burst = fade(burst, 0.02, 0.04)
    gap = [0.0] * int(SR * 0.2)
    return burst + gap + burst


def classic_ring() -> list[float]:
    tone = fade(sine(425, 0.4, 0.38), 0.01, 0.04)
    gap = [0.0] * int(SR * 0.2)
    return tone + gap + tone + [0.0] * int(SR * 0.25)


def marimba() -> list[float]:
    notes = [523.25, 659.25, 783.99, 1046.5]
    parts = [
        pad(fade(sine(freq, 0.22, 0.28), 0.005, 0.12), index * 0.12)
        for index, freq in enumerate(notes)
    ]
    return mix(*parts)


def urgent() -> list[float]:
    beep = fade(sine(1400, 0.08, 0.4), 0.003, 0.02)
    gap = [0.0] * int(SR * 0.07)
    return (beep + gap) * 4


def glass() -> list[float]:
    def shimmer(freq: float, duration: float) -> list[float]:
        count = int(SR * duration)
        samples: list[float] = []
        for index in range(count):
            t = index / SR
            envelope = math.exp(-t * 3)
            samples.append(
                (
                    math.sin(2 * math.pi * freq * t)
                    + 0.25 * math.sin(2 * math.pi * freq * 2 * t)
                )
                * 0.35
                * envelope
            )
        return samples

    return mix(shimmer(1046.5, 0.7), pad(shimmer(1318.5, 0.7), 0.35))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    presets: dict[str, list[float]] = {
        "soft": fade(sine(523.25, 0.22, 0.35), 0.01, 0.08),
        "pop": fade(sine(1174.66, 0.08, 0.42), 0.003, 0.04),
        "bell": decaying_bell(),
        "digital": fade(sine(880, 0.07, 0.4), 0.005, 0.02)
        + [0.0] * int(SR * 0.06)
        + fade(sine(1174.66, 0.09, 0.4), 0.005, 0.03),
        "chime": mix(
            fade(sine(523.25, 0.16, 0.32), 0.005, 0.08),
            pad(fade(sine(659.25, 0.16, 0.32), 0.005, 0.08), 0.1),
            pad(fade(sine(783.99, 0.28, 0.32), 0.005, 0.14), 0.2),
        ),
        "pulse": pulse(),
        "classic": classic_ring(),
        "marimba": marimba(),
        "urgent": urgent(),
        "glass": glass(),
    }

    for name, samples in presets.items():
        wav_path = OUT / f"{name}.wav"
        mp3_path = OUT / f"{name}.mp3"
        write_wav(wav_path, samples)
        to_mp3(wav_path, mp3_path)
        print(f"wrote {mp3_path}")


if __name__ == "__main__":
    main()
