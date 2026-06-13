import {
  CtaBand,
  Faq,
  FeatureGrid,
  Hero,
  MoatBand,
  MotionProvider,
  PageViewTracker,
  SecurityBand,
} from '@/features/marketing';

export default function HomePage() {
  // `dark` forces the marketing page to the dark token set regardless of the
  // app's light/dark toggle; explicit zinc-950 is the canvas.
  return (
    <div className="dark relative bg-zinc-950 text-white">
      <PageViewTracker />
      <MotionProvider>
        <Hero />
        <FeatureGrid />
        <MoatBand />
        <SecurityBand />
        <Faq />
        <CtaBand />
      </MotionProvider>
    </div>
  );
}
