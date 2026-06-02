import {
  CtaBand,
  Faq,
  FeatureGrid,
  Hero,
  SecurityBand,
} from '@/features/marketing';

export default function HomePage() {
  // `dark` forces the marketing page to the dark token set regardless of the
  // app's light/dark toggle; explicit zinc-950 is the canvas.
  return (
    <div className="dark relative bg-zinc-950 text-white">
      <Hero />
      <FeatureGrid />
      <SecurityBand />
      <Faq />
      <CtaBand />
    </div>
  );
}
