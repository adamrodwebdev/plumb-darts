/**
 * A formatted number never breaks across two lines ("0.3" at the end of one, "mm" on the next),
 * and French joins its digit groups and units with a narrow no-break space (U+202F), a glyph none
 * of the page's faces has: each would borrow it from another font. The no-break space every face
 * has takes both places, as the French copy itself writes it.
 */
export function unbreakable(text: string): string {
  return text.replace(/[  ]/g, ' ')
}
