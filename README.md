# PhotoSheet

Put up to 10 photos on a single print-ready PDF page. It all runs in the browser, so photos never leave the user's device.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # layout unit tests
npm run build    # type-check + production build into dist/
```

## How it works

- `src/lib/layout.ts`: a pure function that turns photo aspect ratios and page settings into boxes in PDF points. The preview and the PDF both use it. It has two modes:
  - **Auto** tries every way of splitting the photos into rows (in order, with no cropping) and keeps the most evenly sized, largest result.
  - **Grid** tries every column count and gives each photo an equal-sized cell. **Fit** keeps each whole photo inside its cell; **Fill** crops the photo from the center to fill the cell.

  With orientation set to Auto, it also tries both portrait and landscape pages.
- `src/lib/imageProcess.ts`: reads files one at a time (the browser applies EXIF rotation). iPhone HEIC photos are converted with `heic-to`, which loads only when needed. Each photo gets a 1600 px copy for the screen, and the original is kept for the PDF. When building the PDF, it applies the user's rotation, crops each photo to its box, and downscales it to 300 DPI for its printed size. Files over 50 MB and non-images are rejected with a message.
- `src/lib/pdf.ts`: builds the page with pdf-lib, and handles download and print. It's loaded on demand when the user exports. To print on computers, it loads the PDF into a hidden iframe.
- `src/lib/printSheet.ts`: printing on Android and iOS. Phone browsers can't print a PDF from inside a page, so this puts the same 300 DPI images on a hidden page-sized sheet and calls `window.print()`. That opens the phone's system print screen (Android printing services or AirPrint).
- `src/components/PhotoList.tsx`: drag to reorder with @dnd-kit (mouse, touch press-and-hold, or keyboard: Space, then the arrow keys, then Space).

## Deploy to Vercel

Push this folder to a GitHub repo, then go to vercel.com → **Add New Project** and import it. The Vite preset is detected automatically (build command `npm run build`, output folder `dist`). No environment variables are needed.
