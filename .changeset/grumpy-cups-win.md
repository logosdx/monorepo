---
"@logosdx/utils": minor
---

## Utils

### Added

* `feat(utils): makeNestedConfig()` - Transform flat environment variables into nested configuration objects with automatic type coercion, supporting prefix stripping, custom separators, unit parsing, skip conversion, and memoization for 12-factor apps and containerized deployments
* `feat(utils): castValuesToTypes()` - Intelligently coerce string values to their appropriate types (booleans, numbers, units) with recursive nested object processing, optional unit parsing, and selective skip conversion for configuration parsing
* `feat(utils): parseTimeDuration()` - Parse human-readable time duration strings (`"5min"`, `"2hours"`, etc.) to milliseconds with flexible format support
* `feat(utils): formatTimeDuration()` - Format milliseconds to human-readable duration strings with auto-unit selection and configurable decimals
* `feat(utils): parseByteSize()` - Parse human-readable byte size strings (`"10mb"`, `"2.5gb"`, etc.) to bytes with flexible format support
* `feat(utils): formatByteSize()` - Format bytes to human-readable size strings with auto-unit selection and configurable decimals
* `feat(utils): isEnabledValue()` - Check if a value represents an enabled state (`true`, `"true"`, `"yes"`)
* `feat(utils): isDisabledValue()` - Check if a value represents a disabled state (`false`, `"false"`, `"no"`)
* `feat(utils): hasEnabledOrDisabledValue()` - Validate if a value is a recognized enabled or disabled value
* `feat(utils):` Time unit constants and convenience functions (`seconds()`, `minutes()`, `hours()`, `days()`, `weeks()`, `months()`, `years()`)
* `feat(utils):` Byte unit constants and convenience functions (`kilobytes()`, `megabytes()`, `gigabytes()`, `terabytes()`)

### Changed

* `docs(utils):` Added comprehensive documentation for environment variable parsing, configuration utilities, and unit conversion with real-world examples
* `test(utils):` Added extensive test coverage for configuration parsing, type coercion, and unit conversion utilities
