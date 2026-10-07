// `vite build --mode preview` produces the hosted preview: it starts in the
// demo, needs no server routing, and can't download files.
export const IS_PREVIEW = import.meta.env.MODE === 'preview'
