/**
 * Motion primitives for the marketing surface.
 *
 * Four components, deliberately. Every page below the workbench uses these and nothing else,
 * so the whole site shares one set of durations and one spring — which is the difference
 * between a site that feels designed and one where each section animates to its own taste.
 *
 * ## Why these live apart from the canvas's motion
 *
 * Design-system §1.3: *motion explains causality, or it doesn't happen*. On the canvas that
 * rule is absolute — a state moves because an algorithm moved it. On a landing page there is
 * no causality to explain, and motion is doing a different job: establishing hierarchy, and
 * telling the eye what arrived first. So these use a spring with a little overshoot, which
 * would be actively wrong on a diagram, and the two vocabularies never mix.
 *
 * ## Reduced motion
 *
 * Every component here degrades to *plain, immediately visible content* rather than to a
 * faster animation. `useReducedMotion` is read once per component and the transform is dropped
 * entirely, because an element that slides 24px in 10ms is a flicker, not an accommodation.
 */

import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  type Variants,
} from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { SPRING, TRAVEL } from '@/site/spring';

/**
 * Content that arrives when it is scrolled to.
 *
 * `once` is deliberate. A section that re-animates every time it scrolls back into view turns
 * a long page into a fairground, and re-reading something you have already read should not
 * make it move again.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const still = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={still ? false : { opacity: 0, y: TRAVEL }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * A group whose children arrive one after another.
 *
 * The stagger is what makes a grid of cards read as *a grid* rather than as six things that
 * happened to appear. Pair with {@link RevealItem} for the children.
 */
export function RevealGroup({
  children,
  className,
  gap = 0.06,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Seconds between children. Above about 0.1 the last card feels late. */
  gap?: number;
  as?: 'div' | 'ul' | 'section';
}) {
  const still = useReducedMotion();
  const Tag = motion[as];

  const variants: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: still ? 0 : gap } },
  };

  return (
    <Tag
      className={className}
      variants={variants}
      initial={still ? 'shown' : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </Tag>
  );
}

/** One child of a {@link RevealGroup}. */
export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  const still = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      variants={{
        hidden: still ? {} : { opacity: 0, y: TRAVEL },
        shown: { opacity: 1, y: 0, transition: SPRING },
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * Something that leans towards the pointer.
 *
 * Used on the primary calls to action and nowhere else. It is a strong effect and it stops
 * being charming the third time it appears on one screen.
 */
export function Lift({ children, className }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={still ? undefined : { scale: 1.03 }}
      whileTap={still ? undefined : { scale: 0.98 }}
      transition={SPRING}
    >
      {children}
    </motion.div>
  );
}

/**
 * A number that counts up when it is scrolled to.
 *
 * Takes the *rendered* string rather than a number, so `92 KB`, `300+` and `₹0` all work
 * without the caller decomposing them. The digits animate and everything around them is
 * pinned — which is the whole trick, because a count-up that also animated its unit would
 * read as a value still being computed rather than one arriving.
 *
 * Falls back to the final string immediately under reduced motion, and — more importantly —
 * renders the final string in the DOM the whole time. A screen reader announcing a number
 * mid-tick would be reading a value that was never true.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  // A *positive* margin, unlike everything else here: this one fires slightly before the
  // number is on screen. The others wait until an element is properly in view because arriving
  // early looks like nothing happened — but a counter that starts late is briefly legible at
  // zero, and "0 tests" is a false claim rather than a missed animation.
  const inView = useInView(ref, { once: true, margin: '180px' });

  // Split into the number and whatever brackets it, so `92 KB` counts and ` KB` does not.
  const match = /^(\D*)(\d[\d,]*)(.*)$/.exec(value);
  const [, before = '', digits = '', after = ''] = match ?? [];
  const target = Number(digits.replace(/,/g, ''));
  const countable = match !== null;

  const [shown, setShown] = useState(still || !countable ? target : 0);

  useEffect(() => {
    if (still || !countable || !inView) return;

    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => {
        setShown(Math.round(n));
      },
    });
    return () => {
      controls.stop();
    };
    // `countable` rather than `match`: the regex result is a fresh array every render, so
    // depending on it restarted the animation on each tick of its own `onUpdate` — which left
    // every counter pinned at zero, looking like the numbers were all wrong rather than
    // like the effect was.
  }, [inView, still, countable, target]);

  if (!countable) return <span className={className}>{value}</span>;

  return (
    <span ref={ref} className={className}>
      {/* The true value, for anything that reads rather than watches. */}
      <span className="sr-only">{value}</span>
      <span aria-hidden>
        {before}
        {shown.toLocaleString()}
        {after}
      </span>
    </span>
  );
}

/**
 * A card that lights up under the pointer.
 *
 * A radial highlight tracking the cursor, drawn *inside* the card's own bounds. It reads as
 * the surface catching light rather than as a hover state, which is the difference between a
 * grid that feels physical and one that feels like a table with a background colour.
 *
 * Pointer position is written to CSS custom properties rather than to React state — a card
 * that re-rendered on every mousemove would drop frames on a grid of nine, and none of this
 * is worth a single dropped frame.
 */
export function Spotlight({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={
        still
          ? undefined
          : (event) => {
              const box = ref.current?.getBoundingClientRect();
              if (!box) return;
              ref.current?.style.setProperty('--x', `${String(event.clientX - box.left)}px`);
              ref.current?.style.setProperty('--y', `${String(event.clientY - box.top)}px`);
            }
      }
      className={`k-spotlight ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A heading whose lines arrive one after another.
 *
 * Lines, not words. Word-by-word reveals are the house style of a certain kind of landing
 * page and they make a headline take longer to *read*, which is the opposite of what a
 * headline is for. By line, the eye is already moving in the direction the animation goes.
 *
 * Children are the lines. Anything inside a line — a gradient span, a full stop — moves with
 * it, so the shape of the sentence is never broken up.
 */
export function Lines({ children, className }: { children: ReactNode[]; className?: string }) {
  const still = useReducedMotion();

  return (
    <span className={className}>
      {children.map((line, index) => (
        <motion.span
          // Lines of a fixed headline. The index *is* the identity here — the lines never
          // reorder, and there is nothing else about a line to key on.
          key={index}
          className="block"
          initial={still ? false : { opacity: 0, y: '0.35em' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.08 + index * 0.09 }}
        >
          {line}
        </motion.span>
      ))}
    </span>
  );
}

/**
 * How far down the page the reader is, as a hairline.
 *
 * Belongs to the nav rather than the page: it is chrome, and design-system §1.1 wants chrome
 * to recede. A 2px line along the bottom edge of the bar is the quietest way to answer "how
 * much of this is left", which on a page this long is a question people actually have.
 */
export function ScrollProgress({ className = '' }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, { stiffness: 180, damping: 30, mass: 0.4 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX: width, transformOrigin: '0% 50%' }}
      className={`h-px bg-gradient-to-r from-k-aurora-1 via-k-aurora-3 to-k-aurora-2 ${className}`}
    />
  );
}
