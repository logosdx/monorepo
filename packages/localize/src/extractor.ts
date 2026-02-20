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
