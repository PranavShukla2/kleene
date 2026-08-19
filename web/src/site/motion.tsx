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

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

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
export function Lift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
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
