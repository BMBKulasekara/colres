'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/ui/components/ui/accordion';
import { Minus, Plus } from 'lucide-react';

export interface FaqItem {
  question: string;
  answer: string;
}

/** Single, collapsible accordion; the first answer starts open (spec p.12). */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible defaultValue="faq-0" className="border-slate-200 border-t">
      {items.map((item, i) => (
        <AccordionItem
          key={item.question}
          value={`faq-${i}`}
          className="border-slate-200 border-b last:border-b"
        >
          <AccordionTrigger
            className="py-6 font-semibold text-[17px] text-slate-900 hover:no-underline focus-visible:ring-indigo-500/50"
            icon={
              <span className="mt-0.5 shrink-0" aria-hidden>
                <Plus className="size-5 text-slate-400 group-data-[state=open]:hidden" />
                <Minus className="hidden size-5 text-indigo-600 group-data-[state=open]:block" />
              </span>
            }
          >
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="pr-10 pb-6 text-[15px] text-text-body leading-[26px]">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
