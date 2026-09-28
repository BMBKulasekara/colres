import { MessageSquare, Mic, Paperclip } from 'lucide-react';
import { Avatar, MockWindow } from './primitives';

const waveform = [6, 12, 8, 14, 10, 16, 7, 12, 9, 5];

/** Collaboration deep-dive visual: team chat with a floating comment card. */
export function TeamChatMock() {
  return (
    <div className="relative pb-10 sm:pr-16 sm:pb-0">
      <MockWindow className="max-w-[360px]">
        <div className="flex items-center gap-2 border-slate-200 border-b px-4 py-3.5">
          <MessageSquare className="size-4 text-indigo-600" />
          <span className="font-semibold text-slate-900 text-sm">Team chat</span>
          <span className="ml-auto rounded-full bg-teal-50 px-2 py-0.5 text-teal-700 text-xs">
            3 online
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex gap-2.5">
            <Avatar initials="MR" tone="teal" />
            <div>
              <p className="text-slate-500 text-xs">
                <b className="font-semibold text-slate-900 text-sm">Maya</b> 10:42
              </p>
              <p className="mt-1 rounded-[4px_12px_12px_12px] border border-slate-200 bg-white px-3 py-2 text-slate-700 text-sm">
                Results table is in. Can someone check §IV?
              </p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Avatar initials="JS" tone="amber" />
            <div>
              <p className="text-slate-500 text-xs">
                <b className="font-semibold text-slate-900 text-sm">João</b> 10:44
              </p>
              <div className="mt-1 flex items-center gap-2.5 rounded-[4px_12px_12px_12px] border border-slate-200 bg-white px-3 py-2">
                <span className="rounded-md bg-rose-50 px-1.5 py-1 font-bold text-[10px] text-rose-500">
                  PDF
                </span>
                <span>
                  <span className="block font-semibold text-slate-900 text-[13px]">
                    reviewer-notes.pdf
                  </span>
                  <span className="block text-slate-500 text-xs">248 KB</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <span className="flex items-center gap-2 rounded-[12px_4px_12px_12px] bg-indigo-600 px-3 py-2 text-white">
              <Mic className="size-3.5" />
              <span aria-hidden className="flex items-center gap-0.5">
                {waveform.map((h, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars
                    key={i}
                    className="w-0.5 rounded-full bg-white/80"
                    style={{ height: h }}
                  />
                ))}
              </span>
              <span className="text-xs">0:18</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-slate-200 border-t px-4 py-3 text-slate-400 text-sm">
          <Paperclip className="size-4" />
          Message the team…
          <Mic className="ml-auto size-4" />
        </div>
      </MockWindow>

      <div className="absolute right-0 bottom-0 w-60 rounded-2xl border border-slate-200 bg-white p-4 shadow-float sm:top-12 sm:bottom-auto">
        <div className="flex items-center gap-2">
          <Avatar initials="AK" tone="indigo" />
          <span className="font-semibold text-slate-900 text-sm">Dr. Kumar</span>
        </div>
        <p className="mt-3 rounded-md bg-amber-100 px-2 py-1.5 font-serif text-[13px] text-slate-800">
          &ldquo;reduces communication by 38%&rdquo;
        </p>
        <p className="mt-2 text-slate-700 text-sm">Add the baseline you compared against.</p>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">Reply</span>
          <span className="rounded-md bg-teal-50 px-2.5 py-1 text-teal-700">Resolve</span>
        </div>
      </div>
    </div>
  );
}
