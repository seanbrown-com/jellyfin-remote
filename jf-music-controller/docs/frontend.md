# Frontend (Vite + React)

Source lives under [`web/`](../web/).

## Development

```bash
cd web
npm install
npm run dev
```

[`web/vite.config.ts`](../web/vite.config.ts) configures a dev-server proxy:

- Browser calls **`/api/...`** on the Vite origin (e.g. `http://127.0.0.1:5173`).
- Vite forwards those requests to **`http://127.0.0.1:8088`** (the Python BFF).

Run the BFF on 8088 in a separate terminal (see [installation.md](installation.md)).

## Production build

```bash
cd web
npm ci
npm run build
```

Output directory: **`web/dist/`** (see `build.outDir` in Vite config). The Python app serves this tree at the site root when `controller.static_dir` points to `web/dist` relative to the process working directory (or use an absolute path in config / `/admin/`).

## Technology

- **React 18** + **react-router-dom** for navigation  
- **TypeScript** + **Vite 5**  
- Styling: plain CSS in [`web/src/index.css`](../web/src/index.css) (Finamp-inspired dark theme)

## API client

The browser uses relative URLs such as `/api/library/views`. In dev, the proxy makes those hit the BFF; in production the same origin is the BFF.
