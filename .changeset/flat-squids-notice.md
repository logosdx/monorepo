---
"@logosdx/fetch": patch
---

Fix retry logic throwing "Unexpected end of retry logic" instead of actual error on final attempt

When a request failed on the final retry attempt and `shouldRetry` returned `true`, the loop would increment `_attempt` past `maxAttempts`, exit the while loop, and throw a generic error instead of the actual fetch error. Changed the retry condition from `<=` to `<` to ensure the actual error is thrown after exhausting all attempts.
