/** A specular glint that travels the auth card's rounded outline — see
 *  .glint-ring in globals.css for the actual recipe. Ported from Transfer's
 *  GlintBorder.tsx (components/upload/GlintBorder.tsx there); the mechanism
 *  is unchanged, just re-expressed as a Tailwind/CSS-variable component
 *  instead of a Mantine createStyles theme lookup. */
export function GlintBorder({ radius = 28 }: { radius?: number }) {
  return <div className="glint-ring" style={{ borderRadius: radius }} aria-hidden="true" />
}
