"use client";

import {
  BUSINESS_END,
  BUSINESS_START,
  toMinutes,
} from "@/lib/timeSlots";

const STEP = 30;
const DAY_END = 23 * 60 + 30;

function formatTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} menit`;
  if (rest === 0) return `${hours} jam`;
  return `${hours} jam ${rest} menit`;
}

const businessStart = toMinutes(BUSINESS_START);
const businessEnd = toMinutes(BUSINESS_END);

function makeTimes(first: number, last: number) {
  return Array.from(
    { length: Math.floor((last - first) / STEP) + 1 },
    (_, index) => first + index * STEP
  );
}

export default function TimeRangePicker({
  startTime,
  endTime,
  onChange,
  getUnavailableReason,
}: {
  startTime: string;
  endTime: string;
  onChange: (startTime: string, endTime: string) => void;
  getUnavailableReason: (startTime: string, endTime: string) => string | null;
}) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const hasOvertime = start < businessStart || end > businessEnd;
  const duration = end - start;

  const startOptions = makeTimes(0, DAY_END - STEP);
  const endOptions = makeTimes(STEP, DAY_END);

  return (
    <fieldset className="min-w-0 rounded-xl border bg-muted/30 p-2.5 sm:hidden">
      <legend className="sr-only">Pilih rentang waktu booking</legend>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            2
          </span>
          <span className="text-xs font-semibold">Pilih jam</span>
        </div>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-sm">
          {formatDuration(duration)}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <TimeSelect
          label="Jam mulai"
          value={startTime}
          options={startOptions}
          getDisabledReason={(minutes) => {
            const nextStart = formatTime(minutes);
            const nextEndMinutes = end > minutes ? end : minutes + STEP;
            if (nextEndMinutes > DAY_END) return "Rentang melewati batas waktu";
            const nextEnd = formatTime(nextEndMinutes);
            return getUnavailableReason(nextStart, nextEnd);
          }}
          onChange={(nextStart) => {
            const nextStartMinutes = toMinutes(nextStart);
            const nextEndMinutes = end > nextStartMinutes ? end : nextStartMinutes + STEP;
            onChange(nextStart, formatTime(nextEndMinutes));
          }}
          isOvertime={(minutes) => minutes < businessStart || minutes >= businessEnd}
        />

        <TimeSelect
          label="Jam selesai"
          value={endTime}
          options={endOptions}
          getDisabledReason={(minutes) => {
            if (minutes <= start) return "Jam selesai harus setelah jam mulai";
            return getUnavailableReason(startTime, formatTime(minutes));
          }}
          onChange={(nextEnd) => onChange(startTime, nextEnd)}
          isOvertime={(minutes) => minutes < businessStart || minutes > businessEnd}
        />
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Pilihan bertanda OT berada di luar jam kerja {BUSINESS_START}–{BUSINESS_END} dan memerlukan persetujuan.
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-2" aria-live="polite">
        <span className="text-[10px] text-muted-foreground">Rentang dipilih</span>
        <span className="font-mono text-xs font-bold tabular-nums">
          {startTime}–{endTime}
        </span>
      </div>

      {hasOvertime && (
        <p className="mt-1.5 text-[10px] text-amber-800 dark:text-amber-300">
          Rentang ini memerlukan persetujuan overtime.
        </p>
      )}
    </fieldset>
  );
}

function TimeSelect({
  label,
  value,
  options,
  getDisabledReason,
  onChange,
  isOvertime,
}: {
  label: string;
  value: string;
  options: number[];
  getDisabledReason: (minutes: number) => string | null;
  onChange: (value: string) => void;
  isOvertime: (minutes: number) => boolean;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[10px] font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-lg border bg-background px-2 font-mono text-xs font-semibold tabular-nums shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((minutes) => {
          const optionValue = formatTime(minutes);
          const reason = getDisabledReason(minutes);
          const overtime = isOvertime(minutes);
          return (
            <option key={optionValue} value={optionValue} disabled={reason !== null}>
              {optionValue}{overtime ? " · OT" : ""}{reason ? ` · ${reason}` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}
