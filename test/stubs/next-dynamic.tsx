import { createElement, type ComponentType } from 'react';

type Loader<P> = () => Promise<ComponentType<P>>;

// Deliberately does not model `loading` or `ssr`: the placeholder contract is
// covered by test/components/chart-lazy-placeholder.test.tsx.
// next/dynamic resolves asynchronously, which makes every test that renders a
// lazy chart wait for the chunk. The loader starts at module load, so by the
// time a test body renders, the real component is already resolved.
export default function dynamic<P extends object>(loader: Loader<P>) {
  let resolved: ComponentType<P> | null = null;
  void loader().then((component) => {
    resolved = component;
  });
  return function DynamicStub(props: P) {
    return resolved ? createElement(resolved, props) : null;
  };
}
