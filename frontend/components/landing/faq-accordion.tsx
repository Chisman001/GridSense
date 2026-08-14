"use client";

import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqGroup = {
  title: string;
  items: FaqItem[];
};

export function FaqAccordion({ groups }: { groups: FaqGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-5">
            {group.title}
          </p>
          {group.items.map((item, index) => {
            const id = `${group.title}-${index}`;
            const isOpen = openId === id;

            return (
              <div key={id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  id={`${id}-trigger`}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-panel`}
                  onClick={() => toggle(id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:px-5 sm:py-4"
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center text-slate-400 transition-transform duration-200 ${
                      isOpen ? "rotate-45 text-emerald-600" : ""
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                <div
                  id={`${id}-panel`}
                  role="region"
                  aria-labelledby={`${id}-trigger`}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-4 pb-4 text-sm leading-6 text-slate-600 sm:px-5 sm:pb-5">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
