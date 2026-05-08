// Shadcn's standard className helper. Used by every Shadcn component
// to merge conditional Tailwind classes with sane override semantics.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
