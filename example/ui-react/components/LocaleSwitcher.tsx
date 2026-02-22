import { useLocale } from '../providers.ts';

export function LocaleSwitcher() {

    const { locale, changeTo, locales, t } = useLocale();

    return (
        <div className="flex gap-2 mb-4 items-center">
            <span className="text-sm text-gray-500">
                {t('locale.label')}:
            </span>
            {locales.map(loc => (

                <button
                    key={loc.code}
                    onClick={() => changeTo(loc.code)}
                    className={`px-3 py-1 rounded-md text-xs cursor-pointer border-0 ${
                        loc.code === locale
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    {loc.text}
                </button>
            ))}
        </div>
    );
}
