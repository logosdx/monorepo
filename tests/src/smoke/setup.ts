/**
 * Browser smoke test setup.
 *
 * Provides a helper to load individual IIFE bundles on demand.
 */

declare const __PACKAGES_ROOT__: string;

/** `?raw` returns the shipped bytes; a plain fetch gets Vite's `process.env.NODE_ENV` substitution. */
async function fetchPackageAsset(pkg: string, file: string): Promise<string> {

    const src = `/@fs/${__PACKAGES_ROOT__}/${pkg}/dist/browser/${file}?raw`;
    const asset = await import(/* @vite-ignore */ src);

    return asset.default;
}

(window as any).__fetchPackageAsset = fetchPackageAsset;

(window as any).__loadBundle = async function loadBundle(
    pkg: string,
    doc: Document = document
): Promise<void> {

    const code = await fetchPackageAsset(pkg, 'bundle.js');
    const blob = new Blob([code], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {

        const script = doc.createElement('script');
        script.src = blobUrl;
        script.onload = () => {

            URL.revokeObjectURL(blobUrl);
            resolve();
        };
        script.onerror = () => {

            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Failed to execute bundle: ${pkg}`));
        };
        doc.head.appendChild(script);
    });
};

(window as any).__loadStylesheet = async function loadStylesheet(
    pkg: string,
    file: string
): Promise<HTMLStyleElement> {

    const css = await fetchPackageAsset(pkg, file);

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    return style;
};
