---
"@logosdx/fetch": major
---

**BREAKING CHANGE**: HTTP methods now return `FetchResponse<T>` objects instead of raw data

All HTTP methods (`get`, `post`, `put`, etc.) now return enhanced response objects containing:
- `data`: Parsed response body (your original return value)
- `headers`: Response headers object  
- `status`: HTTP status code
- `request`: Original request object
- `config`: Typed configuration used for the request

**Migration:**
```typescript
// Before
const users = await api.get('/users');

// After - destructure for backward compatibility  
const { data: users } = await api.get('/users');

// Or access full response details
const response = await api.get('/users');
console.log('Data:', response.data);
console.log('Status:', response.status);
console.log('Headers:', response.headers.get('content-type'));
```

This provides better debugging capabilities and access to response metadata while maintaining backward compatibility through destructuring.
