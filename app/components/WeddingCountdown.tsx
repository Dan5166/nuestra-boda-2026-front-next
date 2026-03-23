"use client";

import { useEffect, useState } from "react";

const WEDDING_DATE = new Date("2026-04-19T12:30:00");

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
}

function getTimeLeft(): TimeLeft {
  const now = new Date();
  const diff = WEDDING_DATE.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    finished: false,
  };
}

interface TimeBoxProps {
  label: string;
  value: number;
}

function TimeBox({ label, value }: TimeBoxProps) {
  return (
    <div
      className="
        w-16 h-16 md:w-24 md:h-24
        bg-white/80 backdrop-blur
        rounded-xl md:rounded-2xl
        shadow-md
        flex flex-col items-center justify-center
      "
    >
      <span className="text-xl md:text-3xl font-bold text-[#d4af37] leading-none">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] md:text-sm text-gray-600 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

export default function WeddingCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTimeLeft(getTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;

  if (timeLeft.finished) {
    return (
      <div className="text-center text-xl md:text-3xl font-semibold text-white mb-8">
        💖 ¡Hoy es el gran día! 💖
      </div>
    );
  }

  return (
    <div className="flex justify-center mb-8">
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <TimeBox label="Días" value={timeLeft.days} />
        <TimeBox label="Horas" value={timeLeft.hours} />
        <TimeBox label="Min" value={timeLeft.minutes} />
        <TimeBox label="Seg" value={timeLeft.seconds} />
      </div>
    </div>
  );
}
