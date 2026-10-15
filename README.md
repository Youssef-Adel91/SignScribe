# SignScribe – web app (from the Figma file "SignScribe - Screens and Flow")

All 13 screens at the original 1440x900 size, with Figma's exact colors, spacing, Inter type and graphics.

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # production build in dist/ (open with any static server)

Prototype controls: click the buttons/chips in the design, use the pill at the bottom right to jump
between screens, ← / → for previous/next, ? or H for the gesture guide, Esc to close it.
You can open a screen directly with #1 … #13 in the URL.

Regenerating CSS after editing class names in src: `npm run css` (tools/gen_css.py).
