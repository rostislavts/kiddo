import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
export function date(value: Date | string | null) {
  return value
    ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}
