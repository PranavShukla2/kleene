/**
 * Which page the app is showing.
 *
 * Thin on purpose: the two pages know nothing about each other, and neither knows it is being
 * routed. `Overview` takes a callback to open the editor and `Editor` is unchanged from when it
 * was the whole app — which is what makes adding roadmap §6.1's `/tools/*` pages later a case
 * in a switch rather than a refactor.
 *
 * The theme lives here rather than in either page, because it belongs to the *window*: cycling
 * it on the overview and then opening the editor must not reset it.
 */

import { Editor } from '@/App';
import { Overview } from '@/overview/Overview';
import { useRoute } from '@/router';
import { useTheme } from '@/theme';

export function Root() {
  const { route, go } = useRoute();
  const { choice, cycle } = useTheme();

  if (route === 'editor') return <Editor />;

  return (
    <Overview
      onOpenEditor={() => {
        go('editor');
      }}
      onOpenExample={(key) => {
        go('editor', `?example=${encodeURIComponent(key)}`);
      }}
      themeLabel={choice}
      onCycleTheme={cycle}
    />
  );
}
