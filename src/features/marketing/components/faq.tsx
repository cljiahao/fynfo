import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FAQ_ITEMS } from '../constants';
import { Reveal } from './reveal';

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 px-4 py-14 sm:px-6 md:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Questions, answered
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Everything worth knowing before you start.
          </p>
        </Reveal>

        <Reveal>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border-white/10"
              >
                <AccordionTrigger className="text-left text-base font-medium text-white hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-white/70">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
