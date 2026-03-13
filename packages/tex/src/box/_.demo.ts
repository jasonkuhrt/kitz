/**
 * Demo of Box color features.
 *
 * This file demonstrates the various ways to use colors and styles in Box.
 * Run with: bun src/box/_.demo.ts
 */

import { Box } from './_.js'

console.log('\n=== Box Color Demo ===\n')

// 1. Colored border edges
console.log('1. Colored border edges (using named colors):')
const box1 = new Box.Box({ content: 'Hello, World!' }).border$({
  edges: {
    top: { char: '─', color: { foreground: 'red' } },
    right: { char: '│', color: { foreground: 'blue' } },
    bottom: { char: '─', color: { foreground: 'green' } },
    left: { char: '│', color: { foreground: 'yellow' } },
  },
})
console.log(box1.toString())
console.log()

// 2. Colored corners with bold style
console.log('2. Colored corners with bold style:')
const box2 = new Box.Box({ content: 'Styled Corners' }).border$({
  edges: '─',
  corners: {
    topLeft: { char: '┌', color: { foreground: 'red' }, bold: true },
    topRight: { char: '┐', color: { foreground: 'blue' }, bold: true },
    bottomRight: { char: '┘', color: { foreground: 'green' }, bold: true },
    bottomLeft: { char: '└', color: { foreground: 'yellow' }, bold: true },
  },
})
console.log(box2.toString())
console.log()

// 3. Fully colored and styled border
console.log('3. Fully colored and styled border:')
const box3 = new Box.Box({ content: 'Fancy Box\nWith Multiple\nLines' }).border$({
  edges: {
    top: { char: '═', color: { foreground: 'cyan' }, bold: true },
    right: { char: '║', color: { foreground: 'magenta' }, dim: true },
    bottom: { char: '═', color: { foreground: 'cyan' }, bold: true },
    left: { char: '║', color: { foreground: 'magenta' }, dim: true },
  },
  corners: {
    topLeft: { char: '╔', color: { foreground: 'red' }, bold: true },
    topRight: { char: '╗', color: { foreground: 'blue' }, bold: true },
    bottomRight: { char: '╝', color: { foreground: 'green' }, bold: true },
    bottomLeft: { char: '╚', color: { foreground: 'yellow' }, bold: true },
  },
})
console.log(box3.toString())
console.log()

// 4. Styled content (StyledText)
console.log('4. Styled content:')
const box4 = new Box.Box({
  content: { text: 'Red Bold Text', color: { foreground: 'red' }, bold: true },
}).border$({ style: 'single' })
console.log(box4.toString())
console.log()

// 5. Mixed styled and plain content
console.log('5. Mixed styled and plain content:')
const box5 = new Box.Box({
  content: [
    'Plain text',
    { text: 'Red text', color: { foreground: 'red' } },
    { text: 'Bold blue text', color: { foreground: 'blue' }, bold: true },
    { text: 'Underlined green', color: { foreground: 'green' }, underline: true },
  ],
})
  .gap$(1)
  .border$({ style: 'double' })
console.log(box5.toString())
console.log()

// 6. RGB color values
console.log('6. RGB color values:')
const box6 = new Box.Box({ content: 'Custom RGB Colors' }).border$({
  edges: {
    top: { char: '─', color: { foreground: { r: 255, g: 87, b: 51 } } },
    right: { char: '│', color: { foreground: 'rgb 100 200 150' } },
    bottom: { char: '─', color: { foreground: '#33FF57' } },
    left: { char: '│', color: { foreground: '#FF33F5' } },
  },
})
console.log(box6.toString())
console.log()

// 7. Background colors
console.log('7. Background colors:')
const box7 = new Box.Box({ content: 'Background Colors' }).border$({
  edges: {
    top: { char: ' ', color: { foreground: 'white', background: 'blue' } },
    bottom: { char: ' ', color: { foreground: 'white', background: 'blue' } },
    left: { char: ' ', color: { foreground: 'black', background: 'yellow' } },
    right: { char: ' ', color: { foreground: 'black', background: 'yellow' } },
  },
})
console.log(box7.toString())
console.log()

// 8. Complex composition with colors
console.log('8. Complex composition with colors:')
const innerBox = new Box.Box({
  content: { text: 'Inner Content', color: { foreground: 'magenta' }, bold: true },
})
  .pad$([1, 2])
  .border$({
    edges: {
      top: { char: '─', color: { foreground: 'yellow' } },
      right: { char: '│', color: { foreground: 'yellow' } },
      bottom: { char: '─', color: { foreground: 'yellow' } },
      left: { char: '│', color: { foreground: 'yellow' } },
    },
  })

const outerBox = new Box.Box({
  content: [
    { text: 'Header', color: { foreground: 'cyan' }, bold: true },
    innerBox,
    { text: 'Footer', color: { foreground: 'green' }, italic: true },
  ],
})
  .gap$(1)
  .pad$([1, 2])
  .border$({
    edges: {
      top: { char: '═', color: { foreground: 'blue' }, bold: true },
      right: { char: '║', color: { foreground: 'blue' }, bold: true },
      bottom: { char: '═', color: { foreground: 'blue' }, bold: true },
      left: { char: '║', color: { foreground: 'blue' }, bold: true },
    },
  })
console.log(outerBox.toString())
console.log()

console.log('=== End of Demo ===\n')
