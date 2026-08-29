import { MicroLabel } from '@cpatgt/shared';
import { about } from '../content';
import { Photo } from './Photo';

export function WhatWeDo() {
  return (
    <section>
      <MicroLabel as="h2" size="lg" className="text-ink">
        {about.title}
      </MicroLabel>

      <div className="mt-7 grid grid-cols-3 gap-9">
        {about.features.map((feature, index) => (
          <article key={feature.title}>
            <Photo
              src={feature.photo}
              alt={feature.title}
              className="aspect-video w-full"
              offset={index * -13}
            />
            <h3 className="mt-5 text-[25px] font-semibold tracking-tight text-ink">
              {feature.title}
            </h3>
            <p className="mt-3 text-[17px] leading-[1.55] text-ink-muted">{feature.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
