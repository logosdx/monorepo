import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const INDENT = '    ';

export const jsonToInterface = (
    obj: Record<string, unknown>,
    depth: number
): string => {

    const prefix = INDENT.repeat(depth);
    let output = '';

    for (const key of Object.keys(obj)) {

        const value = obj[key];

        if (Array.isArray(value)) {

            continue;
        }

        if (typeof value === 'object' && value !== null) {

            output += `${prefix}${key}: {\n`;
            output += jsonToInterface(value as Record<string, unknown>, depth + 1);
            output += `${prefix}};\n`;
        }
        else {

            output += `${prefix}${key}: string;\n`;
        }
    }

    return output;
};

export interface ScanResult {
    rootShape: Record<string, unknown> | null;
    namespaces: Record<string, Record<string, unknown>>;
    codes: string[];
}

export const scanDirectory = (dir: string, locale: string): ScanResult => {

    const codes = new Set<string>();
    const namespaces: Record<string, Record<string, unknown>> = {};
    let rootShape: Record<string, unknown> | null = null;

    const entries = readdirSync(dir);

    for (const entry of entries) {

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isFile() && entry.endsWith('.json')) {

            const code = entry.replace('.json', '');
            codes.add(code);

            if (code === locale) {

                const raw = readFileSync(fullPath, 'utf-8');
                rootShape = JSON.parse(raw);
            }
        }
        else if (stat.isDirectory()) {

            const nsEntries = readdirSync(fullPath);

            for (const nsEntry of nsEntries) {

                if (!nsEntry.endsWith('.json')) continue;

                const code = nsEntry.replace('.json', '');
                codes.add(code);

                if (code === locale) {

                    const raw = readFileSync(join(fullPath, nsEntry), 'utf-8');
                    namespaces[entry] = JSON.parse(raw);
                }
            }
        }
    }

    return { rootShape, namespaces, codes: Array.from(codes) };
};
