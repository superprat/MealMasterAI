# Modern Design System - Meal Planner Application

## Color Palette

### Light Mode
- **Primary**: `hsl(210, 35%, 52%)` - Modern muted blue, less saturated than the previous green
- **Background**: `hsl(0, 0%, 99%)` - Softer white for reduced eye strain
- **Foreground**: `hsl(220, 15%, 15%)` - Warmer dark text with subtle blue undertone
- **Muted**: `hsl(220, 12%, 95%)` - Neutral background for secondary elements
- **Border**: `hsl(220, 12%, 88%)` - Subtle borders that don't compete with content
- **Card**: Pure white for content areas

### Dark Mode
- **Primary**: `hsl(210, 40%, 58%)` - Slightly brighter blue for dark backgrounds
- **Background**: `hsl(220, 15%, 6%)` - Deep blue-tinted dark background
- **Foreground**: `hsl(220, 10%, 92%)` - Soft white text
- **Muted**: `hsl(220, 15%, 12%)` - Subtle dark background variations
- **Border**: `hsl(220, 15%, 18%)` - Visible but not harsh borders

### Meal Type Colors (Refined)
- **Breakfast**: `bg-amber-50 text-amber-700 border-amber-200` - Warm sunrise tones
- **Lunch**: `bg-emerald-50 text-emerald-700 border-emerald-200` - Fresh midday green
- **Snack**: `bg-violet-50 text-violet-700 border-violet-200` - Playful purple
- **Dinner**: `bg-indigo-50 text-indigo-700 border-indigo-200` - Evening blue

## Typography

### Font Stack
1. **Primary (sans)**: `Inter` - Clean, modern, highly readable
2. **Display (headings)**: `Cal Sans` - Distinctive sans-serif for headings and branding
3. **Monospace**: `Geist Mono` - Modern monospace for code/data

### Font Usage
- **Headlines**: `font-display font-semibold` - Cal Sans for visual hierarchy
- **Body Text**: `font-sans` - Inter for optimal readability
- **UI Elements**: Default to Inter for consistency

### Alternative Font Suggestions

#### Option 1: Sophisticated Minimal
- **Primary**: `Untitled Sans` or `ABC Diatype`
- **Display**: `Recoleta` or `Roc Grotesk`
- **Feel**: High-end, editorial, Swiss design influence

#### Option 2: Friendly Modern
- **Primary**: `DM Sans` or `Plus Jakarta Sans`
- **Display**: `Clash Display` or `Space Grotesk`
- **Feel**: Approachable, rounded, contemporary

#### Option 3: Tech Forward
- **Primary**: `Geist` or `Satoshi`
- **Display**: `Clash Display` or `General Sans`
- **Feel**: Technical, precise, startup-inspired

## Design Principles

### Reduced Saturation
- Moved away from bright, saturated colors
- Embraced neutral tones with subtle color hints
- Colors feel more professional and less overwhelming

### Improved Contrast
- Better text contrast ratios for accessibility
- Subtle border colors that define space without distraction
- Thoughtful use of color to guide user attention

### Modern Spacing
- Increased border radius to `0.75rem` for softer feel
- Consistent use of design tokens for spacing
- Card-based layouts with proper elevation

### Visual Hierarchy
- Display font for headings creates clear information hierarchy
- Consistent button styles and interactive states
- Proper use of muted colors for secondary information

## Implementation Notes

### CSS Variables
All colors are implemented as CSS custom properties, making theme switching seamless and maintaining consistency across components.

### Font Loading
Fonts are loaded via Google Fonts with `font-display: swap` for better performance. Fallbacks are carefully chosen system fonts.

### Responsive Considerations
- Font sizes scale appropriately across breakpoints
- Color contrast maintained in both light and dark modes
- Touch targets sized appropriately for mobile devices

### Accessibility
- WCAG AA compliant color contrast ratios
- Semantic color usage (destructive actions use red tones)
- Clear visual focus states for keyboard navigation

## Future Enhancements

1. **Animation System**: Consistent micro-interactions
2. **Component Variants**: Standardized size and style variants
3. **Color Token Expansion**: Semantic color tokens for specific use cases
4. **Dark Mode Toggle**: User-controlled theme switching
5. **Brand Colors**: Potential expansion for branded elements