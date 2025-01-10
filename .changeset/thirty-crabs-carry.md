---
"@logos-ui/utils": minor
---

`assertObject(val, assertions)` - Asserts the values in an object based on the provided assertations. The assertations are a map of paths to functions that return a tuple of a boolean and a message. This is intended to be used for testing and validation when there is no schema validator available.

`isOptional(val, check)` - Optional value check. If value is undefined or null, it is considered optional. If a function is provided, it is used to check the value. If a boolean is provided, it is used to check the value.

`reach(obj, path)` - Reaches into an object and returns the value at the end of the path.

`PathValue<T, P>` - A utility type that gets the value at a path in an object.
