/**
 * Browser smoke test setup.
 *
 * Provides a helper to load individual IIFE bundles on demand.
 * Each test file loads only the bundle it needs to avoid global
 * variable conflicts between minified IIFE bundles.
 */

declare const __PACKAGES_ROOT__: string;

(window as any).__loadBundle = async function loadBundle(pkg: string): Promise<void> {

    const root = __PACKAGES_ROOT__;
    const src = `/@fs/${root}/${pkg}/dist/browser/bundle.js`;
    const res = await fetch(src);

    if (!res.ok) {

        const body = await res.text();
        throw new Error(
            `Failed to fetch ${pkg} bundle (${res.status}): ${body.slice(0, 200)}`
        );
    }

    const code = await res.text();
    const blob = new Blob([code], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {

        const script = document.createElement('script');
        script.src = blobUrl;
        script.onload = () => {

            URL.revokeObjectURL(blobUrl);
            resolve();
        };
        script.onerror = () => {

            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Failed to execute bundle: ${pkg}`));
        };
        document.head.appendChild(script);
    });
};
