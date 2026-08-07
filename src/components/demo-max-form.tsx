"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  activateDemoMaxMode,
  type DemoMaxActionState,
} from "@/app/settings/actions";

const INITIAL_STATE: DemoMaxActionState = { status: "idle", message: "" };

export default function DemoMaxForm() {
  const [state, formAction, pending] = useActionState(activateDemoMaxMode, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Demo code
        </span>
        <input
          type="password"
          name="demoCode"
          required
          minLength={1}
          maxLength={128}
          autoComplete="off"
          placeholder="Enter the presentation code"
          className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-600 dark:focus:ring-amber-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-amber-500 py-3 text-sm font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-400 active:bg-amber-600 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Unlocking..." : "🔓 Unlock everything"}
      </button>

      {state.message && (
        <div
          aria-live="polite"
          className={`rounded-xl px-3 py-2 text-xs font-medium leading-5 ${
            state.status === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          <p>{state.message}</p>
          {state.status === "success" && (
            <p className="mt-1">
              <Link className="underline" href="/collection">
                Open Collection
              </Link>{" "}
              ·{" "}
              <Link className="underline" href="/">
                Go to Home
              </Link>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
