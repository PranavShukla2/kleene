/**
 * The floating glass bar every page except the editor wears.
 *
 * Floating rather than pinned to the top edge, and that is the whole design of it: a bar that
 * sits *over* the page with a margin around it says the page continues underneath, which is
 * true — the aurora and the grid run behind it. A full-width bar welded to the viewport edge
 * would cut the page in two and throw away the depth the rest of the surface is built on.
 *
 * **The wordmark always goes home**, from every page including the editor. That is L5: a page
 * you can reach and not leave is the specific failure that makes a site feel broken rather
 * than unfinished, and it costs one link to avoid.
 *
 * The active item is marked by a pill that *slides* between items — one shared `layoutId`, so
 * the movement is a single element travelling rather than one fading out while another fades
 * in. That is design-system §1.3 holding even here: the pill moves because you moved it.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { Lift } from '@/site/motion';
import { SPRING } from '@/site/spring';
import type { Route } from '@/router';

const NAV: readonly { route: Route; label: string }[] = [
  { route: 'convert', label: 'Convert' },
  { route: 'examples', label: 'Examples' },
  { route: 'docs', label: 'Docs' },
  { route: 'pricing', label: 'Pricing' },
  { route: 'roadmap', label: 'Roadmap' },
  // About was reachable only from the footer, which is a page you have to already be
  // finished with the site to find. It is the page that answers "who made this and is it
  // serious", which is a question people have early rather than last.
  { route: 'about', label: 'About' },
];

export function Nav({
  current,
  onNavigate,
  themeLabel,
  onCycleTheme,
  onOpenPalette,
}: {
  current: Route;
  onNavigate: (to: Route) => void;
  themeLabel: string;
  onCycleTheme: () => void;
  onOpenPalette: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const still = useReducedMotion();

  // The bar tightens once the page has moved. Nothing but a shadow and a little padding, but
  // it is the cue that tells you the bar is floating rather than part of the hero.
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const go = (to: Route) => {
    setOpen(false);
    onNavigate(to);
  };

  return (
    <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.header
        initial={still ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        /*
          Fully rounded, not a rectangle with softened corners. A floating bar reads as an
          object sitting on the page, and objects that float have no corners to justify — the
          square-with-rounded-edges version looked like a panel that had come loose. Every
          control inside it is a pill for the same reason, so the shape language is one idea
          rather than three.
        */
        className={`k-glass mx-auto flex w-full max-w-6xl items-center gap-4 rounded-full px-3 transition-[padding,box-shadow] duration-(--duration-k-panel) sm:px-5 ${
          scrolled ? 'py-2' : 'py-2.5'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            go('overview');
          }}
          className="flex items-baseline gap-2.5 rounded-full px-1"
        >
          <span className="k-gradient-text font-mono text-lg font-semibold tracking-tight">
            kleene
          </span>
          <span className="hidden text-[13px] text-k-text-faint lg:inline">
            automata workbench
          </span>
        </button>

        <nav className="ml-1 hidden items-center gap-0.5 lg:flex" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                go(item.route);
              }}
              aria-current={current === item.route ? 'page' : undefined}
              className={`relative rounded-full px-3 py-1.5 text-sm transition-colors duration-(--duration-k-hover) ${
                current === item.route
                  ? 'font-medium text-k-text'
                  : 'text-k-text-muted hover:text-k-text'
              }`}
            >
              {current === item.route && (
                // One element, shared across all five buttons by `layoutId`, so switching
                // pages slides the pill rather than cross-fading two of them.
                <motion.span
                  layoutId="nav-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-k-primary/10 ring-1 ring-k-primary/20"
                  transition={SPRING}
                />
              )}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/*
            The palette's shortcut, made visible. ⌘K is only discoverable if something says so
            — every product that ships one and does not advertise it has a feature that four
            per cent of its users know about. It is also a real button, because a hint that
            cannot be clicked is a hint that excludes anyone on a touchscreen.
          */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Search pages, examples and expressions"
            className="hidden items-center gap-2 rounded-full border border-k-border px-3 py-1.5 text-xs text-k-text-faint transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text md:flex"
          >
            Search
            <kbd className="font-mono text-[10px] text-k-text-faint">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={onCycleTheme}
            aria-label={`Theme: ${themeLabel}. Click to change.`}
            className="hidden rounded-full border border-k-border px-3 py-1.5 font-mono text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text lg:block"
          >
            {themeLabel}
          </button>

          <Lift>
            <button
              type="button"
              onClick={() => {
                go('editor');
              }}
              className="k-glow rounded-full bg-k-primary px-4 py-1.5 text-sm font-medium text-white"
            >
              Open the editor
            </button>
          </Lift>

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => {
              setOpen((was) => !was);
            }}
            className="rounded-full border border-k-border px-3 py-1.5 font-mono text-sm text-k-text-muted lg:hidden"
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Sections"
            initial={still ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -8 }}
            transition={SPRING}
            className="k-glass mx-auto mt-2 flex w-full max-w-6xl flex-col rounded-3xl p-2 lg:hidden"
          >
            {[...NAV, { route: 'changelog' as Route, label: 'Changelog' }].map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => {
                  go(item.route);
                }}
                aria-current={current === item.route ? 'page' : undefined}
                className={`rounded-full px-4 py-2 text-left text-sm ${
                  current === item.route
                    ? 'bg-k-primary/10 font-medium text-k-text'
                    : 'text-k-text-muted'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onCycleTheme}
              className="mt-1 rounded-full border-t border-k-border px-4 py-2 text-left font-mono text-xs text-k-text-faint"
            >
              theme: {themeLabel}
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
