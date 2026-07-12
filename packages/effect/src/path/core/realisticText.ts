// Realistic-name text patterns — shaped like real-world path names rather than
// the full validated character space. Heads are alphanumeric (which also rules
// out `.`/`..` and `/` by construction); bodies add the separators common in
// real names. Segment and dotfile bodies allow dots; stem and extension bodies
// do not, so the generated extension stays the sole stem–extension split point.
//
// Consumed by the models' `Realistic` variant schemas (as candidate sources)
// and by `Path/Testing`'s realistic generators.
const alphanumeric = 'A-Za-z0-9'
const segmentBody = `${alphanumeric}._-`
const nameBody = `${alphanumeric}_-`

export const realisticSegmentPattern = new RegExp(`^[${alphanumeric}][${segmentBody}]{0,31}$`)
export const realisticDotfilePattern = new RegExp(`^\\.[${alphanumeric}][${segmentBody}]{0,30}$`)
export const realisticStemPattern = new RegExp(`^[${alphanumeric}][${nameBody}]{0,23}$`)
export const realisticExtensionPattern = new RegExp(`^\\.[${alphanumeric}][${nameBody}]{0,7}$`)
